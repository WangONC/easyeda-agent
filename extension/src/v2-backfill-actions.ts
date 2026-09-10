import { type NativeAction, observed, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { object } from './component-source';
import { covered } from './v2-batch-actions';
type Comp = Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number];
export function resolveLcsc(serialize: (c: Comp) => Record<string, unknown>, footprint: (s: Record<string, unknown>) => {
    name: string;
    uuid?: unknown;
    libraryUuid?: unknown;
}, resolve: (s: Record<string, unknown>) => Promise<{
    lcsc?: string;
    reason?: string;
    device?: {
        via: string;
    };
    candidates?: unknown;
}>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.component.resolve_lcsc'), run: async (c) => {
            const p = c.request.input, all = () => eda.sch_PrimitiveComponent.getAll(), before = array<Comp>(await all()), parts = before.filter(x => String(x.getState_ComponentType()) === 'part' && (!p.primitiveId || x.getState_PrimitiveId() === p.primitiveId));
            if (p.primitiveId && !parts.length)
                throw Error('INVALID_STATE');
            const items: Record<string, unknown>[] = [], unresolved: Record<string, unknown>[] = [], patches = new Map<string, {
                lcsc: string;
                item: Record<string, unknown>;
            }>(), cache = new Map<string, Awaited<ReturnType<typeof resolve>>>();
            for (const part of parts) {
                const state = serialize(part), fp = footprint(state), current = typeof state.supplierId === 'string' ? state.supplierId : '', designator = String(state.designator ?? '');
                if (/^C\d+$/.test(current)) {
                    items.push({ designator, lcsc: current, via: 'instance', footprint: fp.name });
                    continue;
                }
                const mpn = typeof state.manufacturerId === 'string' ? state.manufacturerId : '', key = canonical([current, mpn, typeof state.name === 'string' ? state.name : '', fp.uuid, fp.libraryUuid, fp.name.toLowerCase()]);
                let result = cache.get(key);
                if (!result) {
                    result = await resolve(state);
                    cache.set(key, result);
                }
                if (!result.lcsc) {
                    unresolved.push({ designator, mpn, footprint: fp.name, reason: result.reason ?? (result.device ? 'device resolved but carries no LCSC C-number' : 'no match'), ...(result.candidates ? { candidates: result.candidates } : {}) });
                    continue;
                }
                const item = { designator, lcsc: result.lcsc, via: result.device?.via, footprint: fp.name, previousSupplierId: current };
                items.push(item);
                patches.set(part.getState_PrimitiveId(), { lcsc: result.lcsc, item });
            }
            const value = () => ({ total: parts.length, resolvedCount: items.length, unresolvedCount: unresolved.length, items, ...(unresolved.length ? { unresolved } : {}), scope: 'activePage' });
            if (p.apply !== true)
                return observed(value(), ['fresh_resolver_inputs_and_explicit_unresolved']);
            const old = new Map(before.map(x => [x.getState_PrimitiveId(), serialize(x)]));
            c.prepare(async () => { const fresh = array<Comp>(await all()), map = new Map(fresh.map(x => [x.getState_PrimitiveId(), serialize(x)])); if (map.size !== old.size || [...old].some(([id, v]) => !map.has(id) || canonical(patches.has(id) ? { ...map.get(id), supplierId: v.supplierId } : map.get(id)) !== canonical(v)))
                return { changed: null, verification: unavailable() }; let count = 0, changed = false; for (const [id, patch] of patches) {
                const actual = map.get(id)!.supplierId;
                patch.item.applied = actual === patch.lcsc;
                if (patch.item.applied)
                    count++;
                changed ||= actual !== old.get(id)!.supplierId;
            } return covered({ ...value(), appliedCount: count }, patches.size, count, changed, ['fresh_resolved_supplier_ids', 'unrelated_component_fields_unchanged']); });
            for (const [id, patch] of patches)
                try {
                    await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(id, { supplierId: patch.lcsc }); });
                }
                catch { /* complete per-item readback */ }
            return c.verify();
        } };
}
export function attrsBackfill(plan: (a: Record<string, unknown>, b: Record<string, unknown>, o: {
    overwrite: boolean;
}) => {
    merged: Record<string, unknown>;
    filled: string[];
}): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('pcb.component.attrs_backfill'), run: async (c) => {
            const before = array(await eda.pcb_PrimitiveComponent.getAll()), noLcsc: string[] = [], parts = before.filter(x => { const designator = x.getState_Designator() ?? '', lcsc = x.getState_SupplierId() ?? ''; if (!designator)
                return false; if (/^C\d+$/.test(lcsc))
                return true; noLcsc.push(designator); return false; });
            const attrs = new Map<string, Record<string, unknown>>(), codes = [...new Set(parts.map(x => x.getState_SupplierId()!))];
            for (let i = 0; i < codes.length; i += 20)
                try {
                    for (const row of array(await eda.lib_Device.getByLcscIds(codes.slice(i, i + 20)))) {
                        const r = object(row), id = String(r.supplierId ?? object(r.otherProperty)['Supplier Part'] ?? '');
                        if (/^C\d+$/.test(id) && r.otherProperty)
                            attrs.set(id, object(r.otherProperty));
                    }
                }
                catch { /* unresolved is explicit */ }
            const patches = new Map<string, {
                designator: string;
                lcsc: string;
                filledKeys: string[];
                merged: Record<string, unknown>;
            }>(), unresolved: string[] = [];
            for (const part of parts) {
                const designator = part.getState_Designator()!, lcsc = part.getState_SupplierId()!, source = attrs.get(lcsc);
                if (!source) {
                    unresolved.push(designator);
                    continue;
                }
                const result = plan(object(part.getState_OtherProperty()), source, { overwrite: c.request.input.overwrite === true });
                if (result.filled.length)
                    patches.set(part.getState_PrimitiveId(), { designator, lcsc, filledKeys: result.filled.sort(), merged: result.merged });
            }
            const snapshot = (x: typeof before[number]) => ({ designator: x.getState_Designator(), lcsc: x.getState_SupplierId(), properties: object(x.getState_OtherProperty()), x: x.getState_X(), y: x.getState_Y(), rotation: x.getState_Rotation(), layer: x.getState_Layer(), uniqueId: x.getState_UniqueId() });
            const old = new Map(before.map(x => [x.getState_PrimitiveId(), snapshot(x)]));
            c.prepare(async () => { const fresh = new Map(array(await eda.pcb_PrimitiveComponent.getAll()).map(x => [x.getState_PrimitiveId(), snapshot(x)])); if (fresh.size !== old.size || [...old].some(([id, v]) => !fresh.has(id) || canonical(patches.has(id) ? { ...fresh.get(id), properties: v.properties } : fresh.get(id)) !== canonical(v)))
                return { changed: null, verification: unavailable() }; const updated: Record<string, unknown>[] = [], failed: string[] = []; let changed = false; for (const [id, patch] of patches) {
                const props = fresh.get(id)!.properties;
                if (Object.keys(props).length === Object.keys(patch.merged).length && Object.entries(patch.merged).every(([k, v]) => Object.hasOwn(props, k) && String(props[k]) === String(v)))
                    updated.push({ designator: patch.designator, lcsc: patch.lcsc, filledKeys: patch.filledKeys });
                else
                    failed.push(patch.designator);
                changed ||= canonical(props) !== canonical(old.get(id)!.properties);
            } return covered({ updatedCount: updated.length, partsWithLcsc: parts.length, updated, ...(unresolved.length ? { unresolvedDesignators: unresolved } : {}), ...(noLcsc.length ? { noLcscDesignators: noLcsc } : {}), ...(failed.length ? { failedDesignators: failed } : {}) }, patches.size, updated.length, changed, ['fresh_attribute_merge_and_identity', 'unrelated_component_fields']); });
            for (const [id, patch] of patches)
                try {
                    await c.effect(() => eda.pcb_PrimitiveComponent.modify(id, { designator: patch.designator, otherProperty: patch.merged }));
                }
                catch { /* per-item verification */ }
            return c.verify();
        } };
}
