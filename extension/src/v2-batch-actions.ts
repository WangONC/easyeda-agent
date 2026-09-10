import { observed, unavailable, type NativeAction, type Observation } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
export function idsOf(raw: unknown): string[] {
    if (typeof raw === 'string')
        return [raw];
    if (Array.isArray(raw) && raw.every(x => typeof x === 'string'))
        return [...new Set(raw)];
    throw Error('V2_INVALID_INPUT:primitiveIds');
}
interface Identified {
    getState_PrimitiveId(): string;
}
function inventory<T extends Identified>(items: T[]): Map<string, T> {
    const map = new Map<string, T>();
    for (const item of array(items)) {
        const id = item.getState_PrimitiveId();
        if (!id || map.has(id))
            throw Error('V2_AMBIGUOUS_IDENTITY');
        map.set(id, item);
    }
    return map;
}
export function covered(value: unknown, required: number, satisfied: number, changed: boolean, checked: string[]): Observation {
    if (required === 0)
        return observed(value, [...checked, 'fresh_empty_requested_scope'], changed);
    return { value, changed, verification: { verdict: satisfied === required ? 'satisfied' : changed ? 'partial' : 'unchanged', complete: true, required, satisfied, residual: required - satisfied, checked } };
}
// The receipt covers every requested identity and verifies that unrelated IDs
// did not disappear. Native batch ACK is business data, never completion proof.
export function pcbDelete(kind: 'component' | 'fill' | 'region' | 'pour'): NativeAction {
    const action = `pcb.${kind}.delete`;
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => { declaredReadFields(action)(p); idsOf(p.primitiveIds); }, run: async (c) => {
            const ids = idsOf(c.request.input.primitiveIds), wanted = new Set(ids);
            const pull = async () => inventory<Identified>(kind === 'component' ? await eda.pcb_PrimitiveComponent.getAll() : kind === 'fill' ? await eda.pcb_PrimitiveFill.getAll() : kind === 'pour' ? await eda.pcb_PrimitivePour.getAll() : await eda.pcb_PrimitiveRegion.getAll());
            const before = await pull();
            let ack: unknown = false;
            const verify = async () => {
                const after = await pull();
                if ([...before.keys()].some(id => !wanted.has(id) && !after.has(id)) || [...after.keys()].some(id => !before.has(id)))
                    return { changed: null, verification: unavailable() };
                const survivors = ids.filter(id => after.has(id)), removed = ids.filter(id => before.has(id) && !after.has(id));
                return covered({ deleted: ack, ...(kind === 'component' ? {} : { primitiveIds: ids }), removed, survivors }, ids.length, ids.length - survivors.length, removed.length > 0, ['fresh_requested_absence', 'unrelated_identity_inventory']);
            };
            c.prepare(verify);
            if (ids.some(id => before.has(id)))
                await c.effect(async () => { ack = kind === 'component' ? await eda.pcb_PrimitiveComponent.delete(c.request.input.primitiveIds as string | string[]) : kind === 'fill' ? await eda.pcb_PrimitiveFill.delete(ids) : kind === 'pour' ? await eda.pcb_PrimitivePour.delete(ids) : await eda.pcb_PrimitiveRegion.delete(ids); });
            return c.verify();
        } };
}
export const componentLock: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => { declaredReadFields('pcb.component.lock')(p); if (!idsOf(p.primitiveIds).length)
        throw Error('V2_MISSING_INPUT:primitiveIds'); }, run: async (c) => {
        const ids = idsOf(c.request.input.primitiveIds), locked = c.request.input.locked ?? true;
        const pull = async () => inventory(await eda.pcb_PrimitiveComponent.get(ids));
        const before = await pull(), initial = new Map([...before].map(([id, p]) => [id, p.getState_PrimitiveLock()]));
        const missing = ids.filter(id => !before.has(id));
        const alreadyInState = ids.filter(id => initial.get(id) === locked);
        c.prepare(async () => {
            const after = await pull();
            if ([...after.keys()].some(id => !before.has(id)) || [...before.keys()].some(id => !after.has(id)))
                return { changed: null, verification: unavailable() };
            const applied = ids.filter(id => initial.has(id) && initial.get(id) !== locked && after.get(id)?.getState_PrimitiveLock() === locked);
            const notApplied = ids.filter(id => after.has(id) && after.get(id)!.getState_PrimitiveLock() !== locked);
            return covered({ locked, requested: ids.length, applied, alreadyInState, notApplied, missing, verified: !notApplied.length && !missing.length }, ids.length, ids.length - notApplied.length - missing.length, applied.length > 0, ['fresh_lock_by_identity', 'complete_requested_coverage']);
        });
        for (const [id, p] of before) {
            if (initial.get(id) === locked)
                continue;
            try {
                await c.effect(async () => { p.setState_PrimitiveLock(locked as boolean); await p.done(); });
            }
            catch { /* registered verifier accounts for failed and unstarted items */ }
        }
        return c.verify();
    } };
interface Move {
    primitiveId: string;
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
    [key: string]: unknown;
}
export function layout(action: string, plan: (p: Record<string, unknown>) => Promise<Record<string, unknown>>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields(action), run: async (c) => {
            const value = await plan(c.request.input), moves = (value.moved ?? value.snapped) as Move[];
            const unique = new Map<string, Move>();
            for (const m of moves) {
                if (!m.primitiveId || ![m.from.x, m.from.y, m.to.x, m.to.y].every(Number.isFinite))
                    throw Error('V2_INVALID_LAYOUT');
                const prev = unique.get(m.primitiveId);
                if (prev && JSON.stringify(prev) !== JSON.stringify(m))
                    throw Error('V2_CONFLICTING_LAYOUT');
                unique.set(m.primitiveId, m);
            }
            c.prepare(async () => {
                let satisfied = 0, changed = false;
                const residual: string[] = [];
                for (const m of unique.values()) {
                    const fresh = await eda.pcb_PrimitiveComponent.get(m.primitiveId);
                    if (!fresh || fresh.getState_PrimitiveId() !== m.primitiveId)
                        return { changed: null, verification: unavailable() };
                    const x = fresh.getState_X(), y = fresh.getState_Y();
                    if (!Number.isFinite(x) || !Number.isFinite(y))
                        return { changed: null, verification: unavailable() };
                    changed ||= x !== m.from.x || y !== m.from.y;
                    if (Math.abs(x - m.to.x) <= 1e-6 && Math.abs(y - m.to.y) <= 1e-6)
                        satisfied++;
                    else
                        residual.push(m.primitiveId);
                }
                return covered({ ...value, ...(residual.length ? { residual } : {}) }, unique.size, satisfied, changed, ['fresh_requested_position_by_identity', 'complete_layout_coverage']);
            });
            for (const m of unique.values()) {
                if (m.from.x === m.to.x && m.from.y === m.to.y)
                    continue;
                await c.effect(async () => { const current = await eda.pcb_PrimitiveComponent.get(m.primitiveId); if (!current || current.getState_PrimitiveId() !== m.primitiveId || current.getState_X() !== m.from.x || current.getState_Y() !== m.from.y)
                    throw Error('V2_LAYOUT_DRIFT'); await eda.pcb_PrimitiveComponent.modify(m.primitiveId, m.to); });
            }
            return c.verify();
        } };
}
export const stackup: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => { declaredReadFields('pcb.stackup.set')(p); if (p.count !== undefined && (!Number.isInteger(p.count) || (p.count as number) < 2 || (p.count as number) > 32 || (p.count as number) % 2))
        throw Error('V2_INVALID_COPPER_COUNT'); }, run: async (c) => {
        const p = c.request.input, aliases: Record<string, string> = { signal: 'SIGNAL', plane: 'PLANE', 'internal-electrical': 'PLANE', internal: 'PLANE', power: 'PLANE', ground: 'PLANE', gnd: 'PLANE' };
        const specs: Array<{
            id: number;
            prop: {
                name?: string;
                type?: string;
            };
        }> = [];
        for (const raw of (p.layers as unknown[] | undefined) ?? []) {
            if (!raw || typeof raw !== 'object')
                continue;
            const v = raw as Record<string, unknown>, id = v.id ?? v.layer;
            if (typeof id !== 'number' || !Number.isFinite(id))
                throw Error('V2_INVALID_LAYER');
            const prop: {
                name?: string;
                type?: string;
            } = {};
            if (typeof v.type === 'string') {
                prop.type = aliases[v.type.trim().toLowerCase()];
                if (!prop.type)
                    throw Error('V2_INVALID_LAYER_TYPE');
            }
            if (typeof v.name === 'string')
                prop.name = v.name;
            specs.push({ id, prop });
        }
        const before = array(await eda.pcb_Layer.getAllLayers()), countBefore = await eda.pcb_Layer.getTheNumberOfCopperLayers();
        let setCount: boolean | null = null;
        const modified: Record<string, unknown>[] = [];
        const expected = new Map<number, {
            name?: string;
            type?: string;
        }>();
        for (const s of specs)
            expected.set(s.id, { ...expected.get(s.id), ...s.prop });
        c.prepare(async () => { const layers = array(await eda.pcb_Layer.getAllLayers()), count = await eda.pcb_Layer.getTheNumberOfCopperLayers(); if (typeof count !== 'number')
            return { changed: null, verification: unavailable() }; let required = p.count === undefined ? 0 : 1, satisfied = p.count === undefined ? 0 : Number(count === p.count); const checked: string[] = []; if (p.count !== undefined)
            checked.push('fresh_copper_count'); for (const [id, prop] of expected) {
            const layer = layers.find(l => l.id === id);
            for (const [key, value] of Object.entries(prop)) {
                required++;
                checked.push(`layer:${id}:${key}`);
                if (layer && (layer as unknown as Record<string, unknown>)[key] === value)
                    satisfied++;
            }
        } return covered({ copperLayerCount: count, setCount, modified, layers }, required, satisfied, count !== countBefore || JSON.stringify(layers) !== JSON.stringify(before), checked); });
        if (p.count !== undefined && p.count !== countBefore)
            await c.effect(async () => { setCount = await eda.pcb_Layer.setTheNumberOfCopperLayers(p.count as 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16); });
        for (const s of specs) {
            const fresh = array(await eda.pcb_Layer.getAllLayers()).find(l => l.id === s.id);
            if (!fresh)
                throw Error('V2_LAYER_NOT_FOUND');
            if (Object.entries(s.prop).every(([k, v]) => (fresh as unknown as Record<string, unknown>)[k] === v)) {
                modified.push({ layer: s.id, ok: true, ...s.prop });
                continue;
            }
            await c.effect(async () => { const ok = await eda.pcb_Layer.modifyLayer(s.id as TPCB_LayersInTheSelectable, s.prop as {
                type?: TPCB_LayerTypesOfInnerLayer;
                name?: string;
            }); modified.push({ layer: s.id, ok, ...s.prop }); });
        }
        return c.verify();
    } };
