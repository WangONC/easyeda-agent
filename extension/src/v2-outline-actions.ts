import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';
interface Item {
    kind: 'poly' | 'line' | 'arc';
    layer: number;
    signature: string;
}
async function inventory() { const out = new Map<string, Item>(); const add = (id: string, kind: Item['kind'], layer: number, data: unknown) => { if (!id || out.has(id))
    throw Error('V2_AMBIGUOUS_PRIMITIVE'); out.set(id, { kind, layer, signature: JSON.stringify(data) }); }; for (const p of array(await eda.pcb_PrimitivePolyline.getAll()))
    add(p.getState_PrimitiveId(), 'poly', p.getState_Layer(), [p.getState_Layer(), p.getState_Polygon().getSource(), p.getState_LineWidth(), p.getState_PrimitiveLock()]); for (const p of array(await eda.pcb_PrimitiveLine.getAll()))
    add(p.getState_PrimitiveId(), 'line', p.getState_Layer(), [p.getState_Layer(), p.getState_Net(), p.getState_StartX(), p.getState_StartY(), p.getState_EndX(), p.getState_EndY(), p.getState_LineWidth(), p.getState_PrimitiveLock()]); for (const p of array(await eda.pcb_PrimitiveArc.getAll()))
    add(p.getState_PrimitiveId(), 'arc', p.getState_Layer(), [p.getState_Layer(), p.getState_Net(), p.getState_StartX(), p.getState_StartY(), p.getState_EndX(), p.getState_EndY(), p.getState_ArcAngle(), p.getState_LineWidth(), p.getState_PrimitiveLock()]); return out; }
export function outline(mode: 'set' | 'clear', inside: (x: number, y: number, ring: [
    number,
    number
][]) => boolean): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('pcb.outline.' + mode), run: async (c) => {
            const p = c.request.input;
            let points: [
                number,
                number
            ][] = [];
            if (mode === 'set') {
                if (!Array.isArray(p.points) || p.points.length < 3 || !p.points.every(x => Array.isArray(x) && x.length >= 2 && typeof x[0] === 'number' && typeof x[1] === 'number' && Number.isFinite(x[0] + x[1])))
                    throw Error('V2_INVALID_OUTLINE');
                points = p.points.map(x => [x[0], x[1]]);
            }
            const polygon = mode === 'set' ? eda.pcb_MathPolygon.createPolygon([points[0][0], points[0][1], 'L', ...points.slice(1).flat(), ...points[0]] as TPCB_PolygonSourceArray) : undefined;
            if (mode === 'set' && !polygon)
                throw Error('V2_INVALID_POLYGON');
            const width = (p.lineWidth as number | undefined) ?? 10;
            const before = await inventory(), remove = new Map([...before].filter(([, x]) => x.layer === 11 && (mode === 'clear' || p.replace !== false)));
            let id: string | undefined, attempted = false, zoomed = false;
            c.prepare(async () => {
                const after = await inventory();
                if (attempted && (!id || before.has(id)))
                    return { changed: null, verification: unavailable() };
                if ([...before].some(([key, x]) => !remove.has(key) && after.get(key)?.signature !== x.signature) || [...after.keys()].some(key => !before.has(key) && key !== id))
                    return { changed: null, verification: unavailable() };
                const gone = [...remove.keys()].filter(key => !after.has(key));
                let matched = 0;
                if (mode === 'set' && id) {
                    const fresh = await eda.pcb_PrimitivePolyline.get(id);
                    matched = Number(!!fresh && fresh.getState_PrimitiveId() === id && fresh.getState_Layer() === 11 && fresh.getState_PrimitiveLock() === true && fresh.getState_LineWidth() === width && JSON.stringify(fresh.getState_Polygon().getSource()) === JSON.stringify(polygon!.getSource()));
                }
                let value: Record<string, unknown> = { removed: gone.length };
                if (mode === 'set') {
                    const outside: string[] = [];
                    let enclosure = true;
                    try {
                        for (const comp of array(await eda.pcb_PrimitiveComponent.getAll())) {
                            const box = await eda.pcb_Primitive.getPrimitivesBBox([comp.getState_PrimitiveId()]);
                            if (!box) {
                                enclosure = false;
                                continue;
                            }
                            if (![[box.minX, box.minY], [box.minX, box.maxY], [box.maxX, box.minY], [box.maxX, box.maxY]].every(([x, y]) => inside(x, y, points)))
                                outside.push(comp.getState_Designator() ?? comp.getState_PrimitiveId());
                        }
                    }
                    catch {
                        enclosure = false;
                    }
                    value = { outlineId: id, segments: points.length, zoomed, bbox: { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) }, allInside: enclosure ? outside.length === 0 : null, outside };
                }
                return covered(value, remove.size + (mode === 'set' ? 1 : 0), gone.length + matched, gone.length > 0 || !!id && after.has(id), ['fresh_exact_outline_polygon_width_lock', 'old_outline_absence', 'unrelated_primitive_geometry_unchanged']);
            });
            for (const kind of ['poly', 'line', 'arc'] as const) {
                const ids = [...remove].filter(([, x]) => x.kind === kind).map(([id]) => id);
                if (ids.length)
                    try {
                        await c.effect(() => kind === 'poly' ? eda.pcb_PrimitivePolyline.delete(ids) : kind === 'line' ? eda.pcb_PrimitiveLine.delete(ids) : eda.pcb_PrimitiveArc.delete(ids));
                    }
                    catch { /* fresh coverage determines partial; no repeated delete */ }
            }
            if (mode === 'set') {
                await c.effect(async () => { attempted = true; const made = await eda.pcb_PrimitivePolyline.create('', 11, polygon!, width, true); id = made?.getState_PrimitiveId(); });
                try {
                    await c.effect(async () => { zoomed = await eda.pcb_Document.zoomToBoardOutline(); });
                }
                catch { /* baseline optional viewport */ }
            }
            return c.verify();
        } };
}
