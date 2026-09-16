import { observeDrills } from './drill-inventory';
import { projectRegion } from './region-projection';
import { polygonRings, arcPoints, projectionError } from './compact-polygon';
import { projectPoured } from './poured-projection';
/// <reference types="@jlceda/pro-api-types" />
import { ActionError } from './protocol';
import { fastPath, type NativePort, type Observation, type Operation, type Placement, type Primitive, type Point, type Box } from './fast-path';

// Keep native calls here; state getters are synchronous projections, not API round trips.
export function nativePort(): NativePort {
 const port: NativePort = {
  calls: 0,
  async context() {
   const project = await call(() => eda.dmt_Project.getCurrentProjectInfo());
   const doc = await call(() => eda.dmt_SelectControl.getCurrentDocumentInfo());
   if (!project?.uuid || !doc?.uuid) throw new ActionError('DOCUMENT_GUARD', 'Current project/document unavailable');
   // Match the existing context helper, but fail closed instead of swallowing errors.
   return { projectUuid: project.uuid, documentUuid: doc.uuid, tabId: doc.tabId,
    documentType: Number(doc.documentType) === 3 ? 'pcb' : `type_${doc.documentType}` };
  },
  async read(): Promise<Observation> {
   const components = await call(() => eda.pcb_PrimitiveComponent.getAll());
   const pads = await call(() => eda.pcb_PrimitivePad.getAll());
   // getState_Pads IDs are footprint-local on Host 3.2.186 (e.g. e12),
   // while bulk Pad IDs are instance-qualified (component ID + e12).
   // Never key declarations by local ID: repeated footprints share those IDs.
   const expected = components.flatMap(c => (c.getState_Pads() ?? []).map(p => ({
    component: c.getState_PrimitiveId(), local: p.primitiveId, net: p.net,
   })));
   const localCounts = new Map<string, number>();
   for (const p of expected) localCounts.set(p.local, (localCounts.get(p.local) ?? 0) + 1);
   const padMap = new Map(pads.map(p => [p.getState_PrimitiveId(), p]));
   function resolve(ref: typeof expected[number]): string | undefined {
    // Also accept SDKs returning an already-qualified declaration. Match only
    // exact IDs and ownership, never suffix-only or net-only guesses.
    const matches = [ref.component + ref.local, ref.local].filter(id => {
     const p = padMap.get(id);
     if (!p || p.getState_Net() !== ref.net) return false;
     const owner = 'getState_ParentComponentPrimitiveId' in p
      ? (p as IPCB_PrimitiveComponentPad).getState_ParentComponentPrimitiveId() : undefined;
     if (owner && owner !== ref.component) return false;
     return id === ref.component + ref.local || owner === ref.component
      || localCounts.get(id) === 1;
    });
    return matches.length === 1 ? matches[0] : undefined;
   }
   // Independent-pad getAll may omit COMPONENT_PAD. Read once per distinct net,
   // never getAllPinsByPrimitiveId per component. Verify the declared IDs below.
   const missingNets = new Set(expected.filter(p => !resolve(p)).map(p => p.net));
   for (const net of missingNets) {
    const items = await call(() => eda.pcb_Net.getAllPrimitivesByNet(net, ['ComponentPad' as EPCB_PrimitiveType]));
    for (const item of items) {
     if ('getState_Pad' in item) padMap.set(item.getState_PrimitiveId(), item as IPCB_PrimitivePad);
    }
   }
   const owners = new Map<string, string>();
   for (const p of expected) {
    const id = resolve(p);
    if (id) owners.set(id, p.component);
   }
   const lines = await call(() => eda.pcb_PrimitiveLine.getAll());
   const arcs = await call(() => eda.pcb_PrimitiveArc.getAll());
   const vias = await call(() => eda.pcb_PrimitiveVia.getAll());
   const fills = await call(() => eda.pcb_PrimitiveFill.getAll());
   const pours = await call(() => eda.pcb_PrimitivePour.getAll());
   let poured: IPCB_PrimitivePoured[] | undefined;
   try { poured = await call(() => eda.pcb_PrimitivePoured.getAll()); } catch { /* explicit unsupported observation below */ }
   const regions = await call(() => eda.pcb_PrimitiveRegion.getAll());
   const polys = await call(() => eda.pcb_PrimitivePolyline.getAll());
   const layers = await call(() => eda.pcb_Layer.getAllLayers());
   let physical: unknown = null;
   try { physical=await call(()=>eda.pcb_Layer.getCurrentPhysicalStackingConfiguration())??null; } catch { /* profile validity remains UNKNOWN */ }
   const rules = await call(() => eda.pcb_Drc.getCurrentRuleConfiguration());
   const componentBoxes = new Map<string,Box>();
   if(eda.pcb_Primitive?.getPrimitivesBBox)await Promise.all(components.map(async c=>{const id=c.getState_PrimitiveId();const b=await call(()=>eda.pcb_Primitive.getPrimitivesBBox([id]));if(b&&[b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite))componentBoxes.set(id,[b.minX,b.minY,b.maxX,b.maxY]);}));
   const outlinePolys = polys.filter(p => Number(p.getState_Layer()) === 11);
   const outlineLines = lines.filter(p => Number(p.getState_Layer()) === 11);
   let outlineBox: Record<string, number> | null = null;
   if (outlinePolys.length) outlineBox = await call(() => eda.pcb_Primitive.getPrimitivesBBox(outlinePolys.map(p => p.getState_PrimitiveId()))) ?? null;
   else if (outlineLines.length) {
    const xs = outlineLines.flatMap(l => [l.getState_StartX(), l.getState_EndX()]);
    const ys = outlineLines.flatMap(l => [l.getState_StartY(), l.getState_EndY()]);
    outlineBox = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
   }
   const copper = layers.filter(l => (String(l.type) === 'SIGNAL' || String(l.type) === 'PLANE') && Number(l.layerStatus) !== 0).map(l => Number(l.id));
   const result: Observation = {
    components: components.map(c => ({ id: c.getState_PrimitiveId(), kind: 'component', designator: c.getState_Designator(), x: c.getState_X(), y: c.getState_Y(), rotation: c.getState_Rotation(), layer: Number(c.getState_Layer()), locked: c.getState_PrimitiveLock(), bbox:componentBoxes.get(c.getState_PrimitiveId()) })),
    pads: [...padMap.values()].map(p => {
     const shape = p.getState_Pad(); const x = p.getState_X(); const y = p.getState_Y();
     const w = Number(shape?.[1]); const h = Number(shape?.[2]); const angle = p.getState_Rotation() * Math.PI / 180;
     const dx = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
     const dy = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
     const supported = !(p.getState_SpecialPad()?.length) && shape && ['ELLIPSE', 'RECT', 'OVAL', 'ROUNDRECT'].includes(String(shape[0])) && w > 0 && h > 0 && Number.isFinite(dx + dy);
     return { id: p.getState_PrimitiveId(), kind: 'pad', net: p.getState_Net(), layer: Number(p.getState_Layer()), x, y,
      bbox: supported ? [x - dx, y - dy, x + dx, y + dy] as Box : undefined, unsupported: !supported,
      coverage: supported ? 'conservative' : 'unsupported', locked: p.getState_PrimitiveLock(), component_id: owners.get(p.getState_PrimitiveId()) };
    }),
    traces: lines.map(l => ({ id: l.getState_PrimitiveId(), kind: 'trace', net: l.getState_Net(), layer: Number(l.getState_Layer()), points: [[l.getState_StartX(), l.getState_StartY()], [l.getState_EndX(), l.getState_EndY()]] as Point[], width: l.getState_LineWidth(), locked: l.getState_PrimitiveLock() })),
    vias: vias.map(v => ({ id: v.getState_PrimitiveId(), kind: 'via', layer: 12, net: v.getState_Net(), x: v.getState_X(), y: v.getState_Y(), diameter: v.getState_Diameter(), hole: v.getState_HoleDiameter(), locked: v.getState_PrimitiveLock() })),
    fills: fills.map(f => { const rings=polygonRings(f.getState_ComplexPolygon().getSource()); return {id:f.getState_PrimitiveId(),kind:'fill',net:f.getState_Net(),layer:Number(f.getState_Layer()),rings,width:f.getState_LineWidth(),projection_error:projectionError,unsupported:!rings,coverage:rings?'conservative':'unsupported',locked:f.getState_PrimitiveLock()}; }),
    copper_layers: copper, rules, physical_stackup: physical,
drill_inventory: observeDrills([...padMap.values()],vias,components.every(c=>Array.isArray(c.getState_Pads())) && expected.every(p=>!!resolve(p)) && new Set(pads.map(p=>p.getState_PrimitiveId())).size===pads.length),
    outline_fingerprint_input: { outline: outlinePolys.length, segments: outlineLines.length, arcs: arcs.filter(a => Number(a.getState_Layer()) === 11).length, bbox: outlineBox },
    // Includes shape state that a compact bounding box intentionally loses.
    revision_geometry: {
     pads: [...padMap.values()].map(p => [p.getState_PrimitiveId(), p.getState_Pad(), p.getState_Rotation(), p.getState_Hole(), p.getState_SpecialPad()]).sort(),
     arcs: arcs.map(a => [a.getState_PrimitiveId(), a.getState_ArcAngle()]).sort(),
     fills: fills.map(f => [f.getState_PrimitiveId(), f.getState_ComplexPolygon().getSource()]).sort(),
     pours: pours.map(p => [p.getState_PrimitiveId(), p.getState_ComplexPolygon().getSource()]).sort(),
     polys: polys.map(p => [p.getState_PrimitiveId(), p.getState_Polygon().getSource()]).sort(),
     layers: layers.map(l => [l.id, l.type, l.layerStatus, l.locked]).sort(),
    },
    warnings: ['Observable geometry only; native plane/connectivity indexes may be stale. No reload or DRC is performed.'],
   };
   for (const c of components) if (!Array.isArray(c.getState_Pads())) result.pads.push({ id: `${c.getState_PrimitiveId()}:pads-unavailable`, kind: 'pad', layer: 12, component_id: c.getState_PrimitiveId(), unsupported: true });
   for (const p of expected) if (!resolve(p)) result.pads.push({ id: `${p.component}:missing-pad:${p.local}`, kind: 'pad', net: p.net, layer: 12, component_id: p.component, unsupported: true });
   // Unsupported copper is visible and causes preflight to fail closed on its layer.
   for (const a of arcs) {
    const points=arcPoints([a.getState_StartX(),a.getState_StartY()],[a.getState_EndX(),a.getState_EndY()],a.getState_ArcAngle());
    result.traces.push({id:a.getState_PrimitiveId(),kind:'arc',arc_angle:a.getState_ArcAngle(),net:a.getState_Net(),layer:Number(a.getState_Layer()),points,arc_length:points?Math.hypot(a.getState_EndX()-a.getState_StartX(),a.getState_EndY()-a.getState_StartY())/2/Math.abs(Math.sin(a.getState_ArcAngle()*Math.PI/360))*Math.abs(a.getState_ArcAngle()*Math.PI/180):undefined,width:a.getState_LineWidth(),projection_error:projectionError,unsupported:!points,coverage:points?'conservative':'unsupported'});
   }
   for (const p of polys) {
    if(Number(p.getState_Layer())===11) {
     const rings=polygonRings(p.getState_Polygon().getSource());
     result.fills.push({id:p.getState_PrimitiveId(),kind:'board_edge',layer:12,rings,projection_error:projectionError,unsupported:!rings,coverage:rings?'conservative':'unsupported'});
    } else result.traces.push({id:p.getState_PrimitiveId(),kind:'polyline',net:p.getState_Net(),layer:Number(p.getState_Layer()),unsupported:true});
   }
   if(!outlinePolys.length && (outlineLines.length || arcs.some(a=>Number(a.getState_Layer())===11))) result.fills.push({id:'outline:unsupported-loose-boundary',kind:'board_edge',layer:12,unsupported:true});
   for(const layer of layers) if(String(layer.type)==='PLANE'&&Number(layer.layerStatus)!==0) result.fills.push({id:`negative-plane:${layer.id}`,kind:'pour',layer:Number(layer.id),unsupported:true});
   if(!poured) result.fills.push({id:'poured:unavailable',kind:'pour',layer:12,unsupported:true});
   let hostVersion='';try { hostVersion=eda.sys_Environment.getEditorCurrentVersion(); } catch { /* unknown version cannot normalize native internal units */ }
   for(const p of pours) {
    const regions=poured?.filter(r=>r.getState_PourPrimitiveId()===p.getState_PrimitiveId());
    if(!regions?.length) {result.fills.push({id:p.getState_PrimitiveId(),kind:'pour',net:p.getState_Net(),layer:Number(p.getState_Layer()),unsupported:true});continue}
    for(const region of regions) result.fills.push(...projectPoured(p.getState_PrimitiveId(),p.getState_Net(),Number(p.getState_Layer()),region.getState_PourFills().map(f=>({id:f.id,source:f.path.getSource(),filled:f.fill,line_width:f.lineWidth})),hostVersion));
   }
   for(const region of poured??[]) if(!pours.some(p=>p.getState_PrimitiveId()===region.getState_PourPrimitiveId())) result.fills.push({id:region.getState_PrimitiveId(),kind:'pour',layer:12,unsupported:true});
   for (const r of regions) result.fills.push(projectRegion(r.getState_PrimitiveId(),Number(r.getState_Layer()),r.getState_ComplexPolygon().getSource(),r.getState_RuleType().map(Number),r.getState_LineWidth()));
   return result;
  },
  async create(o: Operation) {
   const p = o.type === 'add_arc'
    ? await call(() => eda.pcb_PrimitiveArc.create(o.net!,o.layer! as TPCB_LayersOfLine,o.points![0][0],o.points![0][1],o.points![1][0],o.points![1][1],o.arc_angle!,o.width!))
    : o.type === 'add_trace'
    ? await call(() => eda.pcb_PrimitiveLine.create(o.net!, o.layer! as TPCB_LayersOfLine, o.points![0][0], o.points![0][1], o.points![1][0], o.points![1][1], o.width!))
    : await call(() => eda.pcb_PrimitiveVia.create(o.net!, o.x ?? 0, o.y ?? 0, o.hole!, o.diameter!));
   return p?.getState_PrimitiveId();
  },
  async remove(kind: string, id: string) {
   return kind === 'arc' ? call(() => eda.pcb_PrimitiveArc.delete([id])) : kind === 'trace' ? call(() => eda.pcb_PrimitiveLine.delete([id])) : call(() => eda.pcb_PrimitiveVia.delete([id]));
  },
  async place(p:Placement) {
   await call(()=>eda.pcb_PrimitiveComponent.modify(p.primitiveId,{x:p.x,y:p.y,rotation:p.rotation,layer:p.layer as TPCB_LayersOfComponent,...(p.locked===undefined?{}:{primitiveLock:p.locked})}));
  },
 };
 async function call<T>(f: () => T | Promise<T>): Promise<T> { port.calls++; return f(); }
 return port;
}
export const fastSnapshot = (p: Record<string, unknown>) => fastPath.snapshot(nativePort(), p);
export const fastApply = (p: Record<string, unknown>) => fastPath.apply(nativePort(), p);
