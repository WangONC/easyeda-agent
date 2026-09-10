import { type NativeAction, unavailable, observed } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { covered, idsOf } from './v2-batch-actions';
interface Primitive {
    getState_PrimitiveId(): string;
}
interface Kind {
    key: string;
    getAll(): Promise<Primitive[]>;
    del(ids: string[]): Promise<boolean>;
}
interface Tree {
    wireIds: string[];
    flagIds: string[];
    ownerIds: string[];
}
const labels: Record<string, string> = { part: 'components', netflag: 'netflags', netport: 'netports', netlabel: 'netlabels', nonElectrical_symbol: 'nonElectricalFlags', short_symbol: 'shortCircuitFlags', sheet: 'sheets' };
export function schematicDelete(mode: 'page' | 'primitives' | 'component', kinds: Kind[], cascadePlan: (ids: string[]) => Promise<Tree[]>): NativeAction {
    const action = mode === 'page' ? 'schematic.page.clear' : mode === 'primitives' ? 'schematic.primitives.delete' : 'schematic.component.delete';
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields(action), run: async (c) => {
            const p = c.request.input, preserve = p.preserveSheet !== false, dry = p.dryRun === true;
            const pull = async () => {
                const map = new Map<string, {
                    kind: string;
                    label: string;
                }>();
                const put = (id: string, kind: string, label: string) => { if (!id || map.has(id))
                    throw Error('V2_DUPLICATE_IDENTITY'); map.set(id, { kind, label }); };
                for (const x of array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll()))
                    put(x.getState_PrimitiveId(), 'components', labels[String(x.getState_ComponentType())] ?? 'components');
                for (const k of kinds)
                    for (const x of array(await k.getAll()))
                        put(x.getState_PrimitiveId(), k.key, k.key);
                return map;
            };
            const before = await pull();
            let requested = mode === 'page' ? [...before].filter(([, v]) => !preserve || v.label !== 'sheets').map(([id]) => id) : p.primitiveIds === undefined ? array(await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId()) : idsOf(p.primitiveIds);
            requested = [...new Set(requested)];
            if (mode === 'component' && requested.some(id => before.has(id) && before.get(id)!.kind !== 'components'))
                throw Error('V2_COMPONENT_IDENTITY');
            const trees = mode === 'component' && p.cascade !== false ? await cascadePlan(requested) : [];
            const planned = [...new Set([...requested, ...trees.flatMap(t => [...t.wireIds, ...t.flagIds])])];
            const plannedSet = new Set(planned);
            const notFound = requested.filter(id => !before.has(id));
            let passes = 0;
            const grouped = (ids: string[]) => { const out: Record<string, string[]> = {}; for (const id of ids) {
                const v = before.get(id);
                if (v)
                    (out[mode === 'page' ? v.label : v.kind] ??= []).push(id);
            } return out; };
            const verify = async () => {
                const after = await pull();
                if ([...after].some(([id, v]) => !before.has(id) || before.get(id)!.kind !== v.kind) || [...before.keys()].some(id => !plannedSet.has(id) && !after.has(id)))
                    return { changed: null, verification: unavailable() };
                const gone = planned.filter(id => before.has(id) && !after.has(id)), remaining = planned.filter(id => after.has(id)), survived = requested.filter(id => after.has(id));
                const deletedIds = grouped(gone), deleted = Object.fromEntries(Object.entries(grouped(planned)).map(([k, ids]) => [k, ids.filter(id => !after.has(id)).length]));
                let value: Record<string, unknown>;
                if (mode === 'component') {
                    const wires = trees.flatMap(t => t.wireIds), flags = trees.flatMap(t => t.flagIds);
                    value = { deleted: !survived.length, requested: requested.length, removed: requested.length - survived.length, ...(survived.length ? { survived } : {}), ...(p.cascade !== false ? { cascaded: { wires: wires.filter(id => !after.has(id)), flags: flags.filter(id => !after.has(id)) } } : {}), ...(remaining.length ? { partial: true, notApplied: remaining.map(id => ({ kind: before.get(id)?.kind, id })) } : {}) };
                }
                else if (mode === 'page')
                    value = { deleted, total: gone.length, enumerated: requested.length, remaining: remaining.length, passes, deletedIds: grouped(requested), preserveSheet: preserve, dryRun: false };
                else
                    value = { deleted, total: gone.length, requested: requested.length, deletedIds, ...(remaining.length ? { partial: true, survived: grouped(remaining), survivedTotal: remaining.length } : {}), ...(notFound.length ? { notFound } : {}) };
                return covered(value, planned.length, planned.length - remaining.length, gone.length > 0, ['fresh_complete_page_inventory', 'requested_absence', 'unrelated_identity_survival']);
            };
            c.prepare(verify);
            if (dry) {
                const groups = grouped(requested);
                return observed({ deleted: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])), total: requested.length, deletedIds: groups, passes: 0, remaining: requested.length, preserveSheet: preserve, dryRun: true }, ['fresh_page_delete_plan'], false);
            }
            const remove = async (ids: string[]) => { const groups: Record<string, string[]> = {}; for (const id of ids) {
                const x = before.get(id);
                if (x)
                    (groups[x.kind] ??= []).push(id);
            } for (const [kind, targets] of Object.entries(groups))
                for (let i = 0; i < targets.length; i += 50) {
                    const chunk = targets.slice(i, i + 50);
                    await c.effect(async () => { if (kind === 'components') {
                        await eda.sch_PrimitiveComponent.delete(chunk);
                        return;
                    } const generic = (eda as unknown as {
                        sch_PrimitiveObject?: {
                            delete?: (ids: string[]) => Promise<boolean>;
                        };
                    }).sch_PrimitiveObject; if (typeof generic?.delete === 'function')
                        await generic.delete(chunk);
                    else
                        await kinds.find(k => k.key === kind)!.del(chunk); });
                } };
            if (requested.some(id => before.has(id))) {
                passes = 1;
                await remove(requested);
            }
            if (trees.length) {
                const after = await pull();
                const eligible = trees.filter(t => t.ownerIds.every(id => !after.has(id)));
                await remove([...new Set(eligible.flatMap(t => [...t.wireIds, ...t.flagIds]))]);
            }
            return c.verify();
        } };
}
