import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { sourceAsset, sourceReceipt, sourceStorageKey, object } from './component-source';
import { canonical } from './fast-path';
import { covered } from './v2-batch-actions';
import { normalizeSchematicRotation, schematicComponentCreateRotation } from './schematic-rotation';
type Comp = Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number];
export function placeComponent(serialize: (c: Comp) => Record<string, unknown>, backfill: (a: Record<string, unknown>, b: Record<string, unknown>, o: {
    onlyExistingKeys: boolean;
}) => {
    merged: Record<string, unknown>;
    filled: string[];
}): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.component.place'), run: async (c) => {
            const p = c.request.input, uuid = p.uuid as string, lib = p.libraryUuid as string, device = await eda.lib_Device.get(uuid, lib), source = sourceAsset(device);
            if (source.uuid !== uuid || source.libraryUuid !== lib)
                throw Error('V2_SOURCE_IDENTITY');
            const all = async () => array<Comp>(await eda.sch_PrimitiveComponent.getAll());
            const before = new Map((await all()).map(x => [x.getState_PrimitiveId(), canonical(serialize(x))]));
            let id: string | undefined, attempted = false, receipt: string | undefined, supplier: string | undefined, filled: string[] = [];
            const expected: Record<string, unknown> = { x: p.x, y: p.y };
            for (const key of ['rotation', 'mirror', 'addIntoBom', 'addIntoPcb', 'designator', 'subPartName'])
                if (p[key] !== undefined && p[key] !== '')
                    expected[key] = p[key];
            if (typeof p.rotation === 'number')
                expected.rotation = normalizeSchematicRotation(p.rotation);
            const pull = async () => { const parts = await all(); if (!id || before.has(id))
                throw Error('V2_CREATED_ID_UNAVAILABLE'); const x = parts.find(x => x.getState_PrimitiveId() === id); if (!x)
                throw Error('V2_CREATED_COMPONENT_ABSENT'); return x; };
            c.prepare(async () => {
                const parts = await all();
                if (attempted && !id || !id || before.has(id) || parts.some(x => !before.has(x.getState_PrimitiveId()) && x.getState_PrimitiveId() !== id) || [...before].some(([key, s]) => canonical(parts.find(x => x.getState_PrimitiveId() === key) && serialize(parts.find(x => x.getState_PrimitiveId() === key)!)) !== s))
                    return { changed: null, verification: unavailable() };
                const fresh = parts.find(x => x.getState_PrimitiveId() === id);
                if (!fresh)
                    return { changed: null, verification: unavailable() };
                const state = serialize(fresh);
                const fields = Object.entries(expected), matched = fields.filter(([key, value]) => key === 'otherProperty' ? Object.entries(value as Record<string, unknown>).every(([k, v]) => Object.hasOwn(object(state.otherProperty), k) && String(object(state.otherProperty)[k]) === String(v)) : state[key] === value).length;
                const key = sourceStorageKey(c.request.target_ref.project_uuid!, c.request.target_ref.document_uuid!, id);
                const bound = !!receipt && eda.sys_Storage.getExtensionUserConfig(key) === receipt && sourceReceipt(state, device) === receipt && canonical(sourceAsset(await eda.lib_Device.get(uuid, lib))) === canonical(source);
                return covered({ primitiveId: id, component: state, sourceIdentity: { uuid, libraryUuid: lib, storage: 'host-extension-user-config', verified: bound }, ...(supplier ? { supplierIdBackfilled: supplier } : {}), ...(filled.length ? { otherPropertyBackfilled: [...filled].sort() } : {}) }, fields.length + 2, 1 + matched + Number(bound), true, ['fresh_created_identity', 'explicit_requested_component_fields', 'source_asset_and_instance_binding', 'unrelated_components_unchanged']);
            });
            // Current EasyEDA Host builds negate the rotation passed to create
            // (0→0, 90→270, 180→180, 270→90). Convert once at this Host write
            // boundary so public absolute/readback degrees require one create.
            await c.effect(async () => { attempted = true; const x = await eda.sch_PrimitiveComponent.create({ uuid, libraryUuid: lib }, p.x as number, p.y as number, p.subPartName as string | undefined, typeof p.rotation === 'number' ? schematicComponentCreateRotation(p.rotation) : undefined, p.mirror as boolean | undefined, p.addIntoBom as boolean | undefined, p.addIntoPcb as boolean | undefined); id = x?.getState_PrimitiveId(); });
            let fresh = await pull();
            if (p.designator)
                await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(id!, { designator: p.designator as string }); });
            fresh = await pull();
            const real = String(object(object(device).property).supplierId ?? '');
            if (!/^C\d+$/.test(fresh.getState_SupplierId() ?? '') && /^C\d+$/.test(real)) {
                expected.supplierId = real;
                try {
                    await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(id!, { supplierId: real }); });
                    fresh = await pull();
                    if (fresh.getState_SupplierId() === real)
                        supplier = real;
                }
                catch { /* verifier covers attempted backfill */ }
            }
            const current = object(fresh.getState_OtherProperty()), values = object(object(object(device).property).otherProperty);
            if (Object.keys(current).length && Object.keys(values).length) {
                const plan = backfill(current, values, { onlyExistingKeys: true });
                if (plan.filled.length) {
                    filled = plan.filled;
                    const patch = { otherProperty: plan.merged, ...(fresh.getState_Designator() ? { designator: fresh.getState_Designator() } : {}), ...(/^C\d+$/.test(fresh.getState_SupplierId() ?? '') ? { supplierId: fresh.getState_SupplierId() } : {}) };
                    Object.assign(expected, patch);
                    try {
                        await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(id!, patch as Parameters<typeof eda.sch_PrimitiveComponent.modify>[1]); });
                    }
                    catch { /* readback reports partial */ }
                }
            }
            fresh = await pull();
            receipt = sourceReceipt(serialize(fresh), device);
            if (receipt.length > 8192)
                throw Error('V2_SOURCE_RECEIPT_TOO_LARGE');
            const key = sourceStorageKey(c.request.target_ref.project_uuid!, c.request.target_ref.document_uuid!, id);
            await c.effect(() => eda.sys_Storage.setExtensionUserConfig(key, receipt!));
            return c.verify();
        } };
}
