/// <reference types="@jlceda/pro-api-types" />
import { ActionError } from './protocol';
import { fastPath, type NativePort, type Observation, type Operation, type Primitive, type Point, type Box } from './fast-path';

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
   const regions = await call(() => eda.pcb_PrimitiveRegion.getAll());
   const polys = await call(() => eda.pcb_PrimitivePolyline.getAll());
   const layers = await call(() => eda.pcb_Layer.getAllLayers());
   const rules = await call(() => eda.pcb_Drc.getCurrentRuleConfiguration());
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
    components: components.map(c => ({ id: c.getState_PrimitiveId(), kind: 'component', designator: c.getState_Designator(), x: c.getState_X(), y: c.getState_Y(), rotation: c.getState_Rotation(), layer: Number(c.getState_Layer()), locked: c.getState_PrimitiveLock() })),
    pads: [...padMap.values()].map(p => {
     const shape = p.getState_Pad(); const x = p.getState_X(); const y = p.getState_Y();
     const w = Number(shape?.[1]); const h = Number(shape?.[2]); const angle = p.getState_Rotation() * Math.PI / 180;
     const dx = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
     const dy = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
     const supported = !(p.getState_SpecialPad()?.length) && shape && ['ELLIPSE', 'RECT', 'OVAL', 'ROUNDRECT'].includes(String(shape[0])) && w > 0 && h > 0 && Number.isFinite(dx + dy);
     return { id: p.getState_PrimitiveId(), kind: 'pad', net: p.getState_Net(), layer: Number(p.getState_Layer()), x, y,
      bbox: supported ? [x - dx, y - dy, x + dx, y + dy] as Box : undefined, unsupported: !supported,
      locked: p.getState_PrimitiveLock(), component_id: owners.get(p.getState_PrimitiveId()) };
    }),
    traces: lines.map(l => ({ id: l.getState_PrimitiveId(), kind: 'trace', net: l.getState_Net(), layer: Number(l.getState_Layer()), points: [[l.getState_StartX(), l.getState_StartY()], [l.getState_EndX(), l.getState_EndY()]] as Point[], width: l.getState_LineWidth(), locked: l.getState_PrimitiveLock() })),
    vias: vias.map(v => ({ id: v.getState_PrimitiveId(), kind: 'via', layer: 12, net: v.getState_Net(), x: v.getState_X(), y: v.getState_Y(), diameter: v.getState_Diameter(), hole: v.getState_HoleDiameter(), locked: v.getState_PrimitiveLock() })),
    fills: fills.map(f => ({ id: f.getState_PrimitiveId(), kind: 'fill', net: f.getState_Net(), layer: Number(f.getState_Layer()), bbox: polygonBox(f.getState_ComplexPolygon().getSource(), f.getState_LineWidth()), unsupported: !polygonBox(f.getState_ComplexPolygon().getSource(), f.getState_LineWidth()), locked: f.getState_PrimitiveLock() })),
    copper_layers: copper, rules,
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
   for (const a of arcs) result.traces.push({ id: a.getState_PrimitiveId(), kind: 'arc', net: a.getState_Net(), layer: Number(a.getState_Layer()), points: [[a.getState_StartX(), a.getState_StartY()], [a.getState_EndX(), a.getState_EndY()]], width: a.getState_LineWidth(), unsupported: true });
   for (const p of polys) result.traces.push({ id: p.getState_PrimitiveId(), kind: 'polyline', net: p.getState_Net(), layer: Number(p.getState_Layer()), unsupported: true });
   for (const p of pours) result.fills.push({ id: p.getState_PrimitiveId(), kind: 'pour', net: p.getState_Net(), layer: Number(p.getState_Layer()), unsupported: true });
   for (const r of regions) result.fills.push({ id: r.getState_PrimitiveId(), kind: 'region', layer: Number(r.getState_Layer()), unsupported: true });
   return result;
  },
  async create(o: Operation) {
   const p = o.type === 'add_trace'
    ? await call(() => eda.pcb_PrimitiveLine.create(o.net!, o.layer! as TPCB_LayersOfLine, o.points![0][0], o.points![0][1], o.points![1][0], o.points![1][1], o.width!))
    : await call(() => eda.pcb_PrimitiveVia.create(o.net!, o.x ?? 0, o.y ?? 0, o.hole!, o.diameter!));
   return p?.getState_PrimitiveId();
  },
  async remove(kind: string, id: string) {
   return kind === 'trace' ? call(() => eda.pcb_PrimitiveLine.delete([id])) : call(() => eda.pcb_PrimitiveVia.delete([id]));
  },
 };
 async function call<T>(f: () => T | Promise<T>): Promise<T> { port.calls++; return f(); }
 return port;
}
// Only linear closed polygon sources have a proven compact bound in V0.1.
function polygonBox(source: unknown, width: number): Box | undefined {
 if (!Array.isArray(source) || source.length < 6 || source.some(v => typeof v !== 'number' && v !== 'L')) return undefined;
 const nums = source.filter(v => typeof v === 'number') as number[];
 if (nums.length % 2 || nums.some(v => !Number.isFinite(v))) return undefined;
 const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
 return [Math.min(...xs) - width / 2, Math.min(...ys) - width / 2, Math.max(...xs) + width / 2, Math.max(...ys) + width / 2];
}
export const fastSnapshot = (p: Record<string, unknown>) => fastPath.snapshot(nativePort(), p);
export const fastApply = (p: Record<string, unknown>) => fastPath.apply(nativePort(), p);
