import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { covered } from './v2-batch-actions';
type Kind = 'track' | 'arc' | 'via' | 'fill';
type Item = {
    id: string;
    kind: Kind;
    net: string;
    layer: number;
    locked: boolean;
    signature: string;
    native: {
        setState_PrimitiveLock(v: boolean): unknown;
        done(): Promise<unknown>;
    };
};
function present<T>(value: T | undefined): T {
    if (value === undefined) throw Error('V2_SCOPE_CHANGED');
    return value;
}
async function inventory(fills = false, only?: Item) {
    const map = new Map<string, Item>();
    const add = (p: Item['native'] & {
        getState_PrimitiveId(): string;
        getState_Net(): string | undefined;
        getState_PrimitiveLock(): boolean;
    }, kind: Kind, layer: number, shape: unknown) => { if (!p) throw Error('V2_SCOPE_CHANGED'); const id = p.getState_PrimitiveId(); if (!id || map.has(id))
        throw Error('V2_AMBIGUOUS_IDENTITY'); map.set(id, { id, kind, layer, net: p.getState_Net() ?? '', locked: p.getState_PrimitiveLock(), signature: canonical([kind, layer, p.getState_Net(), shape]), native: p }); };
    for (const p of (only ? only.kind === 'track' ? [present(await eda.pcb_PrimitiveLine.get(only.id))] : [] : array(await eda.pcb_PrimitiveLine.getAll())))
        add(p, 'track', p.getState_Layer(), [p.getState_StartX(), p.getState_StartY(), p.getState_EndX(), p.getState_EndY(), p.getState_LineWidth()]);
    for (const p of (only ? only.kind === 'arc' ? [present(await eda.pcb_PrimitiveArc.get(only.id))] : [] : array(await eda.pcb_PrimitiveArc.getAll())))
        add(p, 'arc', p.getState_Layer(), [p.getState_StartX(), p.getState_StartY(), p.getState_EndX(), p.getState_EndY(), p.getState_LineWidth(), p.getState_ArcAngle()]);
    for (const p of (only ? only.kind === 'via' ? [present(await eda.pcb_PrimitiveVia.get(only.id))] : [] : array(await eda.pcb_PrimitiveVia.getAll())))
        add(p, 'via', 12, [p.getState_X(), p.getState_Y(), p.getState_HoleDiameter(), p.getState_Diameter()]);
    if (fills)
        for (const p of (only ? only.kind === 'fill' ? [present(await eda.pcb_PrimitiveFill.get(only.id))] : [] : array(await eda.pcb_PrimitiveFill.getAll())))
            add(p, 'fill', p.getState_Layer(), [p.getState_ComplexPolygon().getSource(), p.getState_LineWidth()]);
    return map;
}
const deleteKind = (kind: Kind, ids: string[]) => kind === 'track' ? eda.pcb_PrimitiveLine.delete(ids) : kind === 'arc' ? eda.pcb_PrimitiveArc.delete(ids) : kind === 'via' ? eda.pcb_PrimitiveVia.delete(ids) : eda.pcb_PrimitiveFill.delete(ids);
interface Plan {
    toDelete: Record<'track' | 'arc' | 'via', string[]>;
    removed: Record<string, unknown>[];
    skippedLocked: string[];
    notFound: string[];
    notDeletable: Record<string, string>[];
}
export function routingDelete(plan?: (p: Record<string, unknown>) => Promise<Plan>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields(plan ? 'pcb.route.delete' : 'pcb.route.rip_up'), run: async (c) => {
            const p = c.request.input, before = await inventory(), raw = p.net ?? p.nets, nets = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw as string[] : null;
            const wanted = nets ? new Set(nets) : null;
            const source = plan ? await plan(p) : undefined;
            const ids: Record<'track' | 'arc' | 'via', string[]> = source?.toDelete ?? { track: [], arc: [], via: [] };
            if (!source)
                for (const item of before.values())
                    if (item.kind !== 'fill' && !item.locked && (!wanted || wanted.has(item.net)) && (item.kind === 'via' || item.layer === 1 || item.layer === 2 || item.layer >= 15 && item.layer <= 44))
                        ids[item.kind].push(item.id);
            const requested = new Set(Object.values(ids).flat());
            for (const id of requested)
                if (!before.has(id))
                    throw Error('V2_SCOPE_CHANGED');
            const ack: Record<string, {
                requested: number;
                ok: boolean;
            }> = {};
            c.prepare(async () => {
                const fresh = await inventory();
                if ([...fresh.keys()].some(id => !before.has(id)) || [...before].some(([id, x]) => !requested.has(id) && (!fresh.has(id) || fresh.get(id)!.signature !== x.signature || fresh.get(id)!.locked !== x.locked)) || [...requested].some(id => fresh.has(id) && fresh.get(id)!.signature !== before.get(id)!.signature))
                    return { changed: null, verification: unavailable() };
                const missing = [...requested].filter(id => !fresh.has(id)), survivors = [...requested].filter(id => fresh.has(id));
                let value: Record<string, unknown>;
                if (source) {
                    value = { deleted: { ...ack }, removed: source.removed.filter(x => missing.includes(x.primitiveId as string)), count: missing.length, skippedLocked: source.skippedLocked, notFound: source.notFound };
                    if (source.notDeletable.length) {
                        value.ok = false;
                        value.notDeletable = source.notDeletable;
                    }
                    if (survivors.length) {
                        value.ok = false;
                        value.notDeleted = survivors;
                        value.notDeletedReason = 'these primitives survived the delete (verified by readback)';
                    }
                }
                else
                    value = { nets: nets ?? 'all', lines: ack.tracks ?? { requested: ids.track.length, ok: ids.track.length === 0 }, arcs: ack.arcs ?? { requested: ids.arc.length, ok: ids.arc.length === 0 }, vias: ack.vias ?? { requested: ids.via.length, ok: ids.via.length === 0 } };
                return covered(value, requested.size, missing.length, missing.length > 0, ['fresh_requested_absence', 'unrelated_routing_geometry_and_lock']);
            });
            for (const kind of ['track', 'arc', 'via'] as const)
                if (ids[kind].length) {
                    try {
                        await c.effect(async () => { ack[kind + 's'] = { requested: ids[kind].length, ok: await deleteKind(kind, ids[kind]) }; });
                    }
                    catch {
                        break;
                    }
                }
            return c.verify();
        } };
}
export const trackLock: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('pcb.track.lock'), run: async (c) => {
        const p = c.request.input, locked = p.locked !== false, includeFills = p.includeFills !== false, all = p.all === true, raw = p.net ?? p.nets;
        const nets = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw as string[] : [];
        const want = nets.length ? new Set(nets.map(n => n.toUpperCase())) : null;
        const wantIDs = Array.isArray(p.primitiveIds) && p.primitiveIds.length ? new Set(p.primitiveIds as string[]) : null;
        if (!want && !wantIDs && !all)
            throw Error('MISSING_PAYLOAD_FIELD');
        const before = await inventory(includeFills), selected = new Set([...before.values()].filter(x => wantIDs?.has(x.id) || (want ? want.has(x.net.toUpperCase()) : all && x.net !== '')).map(x => x.id));
        c.prepare(async () => {
            const fresh = await inventory(includeFills);
            if (fresh.size !== before.size || [...before].some(([id, x]) => fresh.get(id)?.signature !== x.signature || !selected.has(id) && fresh.get(id)?.locked !== x.locked))
                return { changed: null, verification: unavailable() };
            const counts = { lines: 0, arcs: 0, vias: 0, fills: 0 }, failures: string[] = [];
            let changed = false;
            for (const id of selected) {
                const x = fresh.get(id)!;
                if (x.locked === locked)
                    counts[x.kind === 'track' ? 'lines' : x.kind === 'arc' ? 'arcs' : x.kind === 'via' ? 'vias' : 'fills']++;
                else
                    failures.push(id);
                changed ||= x.locked !== before.get(id)!.locked;
            }
            return covered({ locked, counts, total: selected.size - failures.length, failures }, selected.size, selected.size - failures.length, changed, ['fresh_lock_of_each_selected_identity', 'unrelated_geometry_and_lock']);
        });
        for (const id of selected) {
            const x = (await inventory(includeFills, before.get(id))).get(id);
            if (!x || x.signature !== before.get(id)!.signature)
                throw Error('V2_SCOPE_CHANGED');
            if (x.locked !== locked)
                try {
                    await c.effect(async () => { x.native.setState_PrimitiveLock(locked); await x.native.done(); });
                }
                catch { /* per-item fresh readback */ }
        }
        return c.verify();
    } };
