import { wireGeometry } from './wire-geometry';
import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { sourceReceipt, sourceStorageKey, sourceAsset, object } from './component-source';
import { covered } from './v2-batch-actions';
type Comp = Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number];
interface Plan {
    primitiveId: string;
    snapshot: Record<string, unknown>;
    oldName?: string;
    oldDevice: {
        uuid: string;
        libraryUuid: string;
        via: string;
    };
    oldPins?: unknown[];
    oldSource: unknown;
    target: {
        uuid: string;
        libraryUuid: string;
        name?: string;
    };
    targetSource: unknown;
    x: number;
    y: number;
    rotation?: number;
    mirror?: boolean;
    addIntoBom?: boolean;
    addIntoPcb?: boolean;
    carryProps: Record<string, unknown>;
    rollbackProps: Record<string, unknown>;
    keepProperties: boolean;
    carried?: Record<string, unknown>;
}
export function replaceComponent(plan: (p: Record<string, unknown>) => Promise<Plan>, serialize: (x: Comp) => Record<string, unknown>, backfill: (a: Record<string, unknown>, b: Record<string, unknown>, o: {
    onlyExistingKeys: boolean;
}) => {
    merged: Record<string, unknown>;
    filled: string[];
}, pins: (id: string) => Promise<unknown[] | undefined>, difference: (a: any[], b: any[]) => {
    removed: unknown[];
    added: unknown[];
    moved: unknown[];
}): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.component.replace'), run: async (c) => {
            if (c.request.input.client_transaction_id !== undefined && c.request.input.client_transaction_id !== c.request.operation_id)
                throw Error('V2_TRANSACTION_ID_MISMATCH');
            const p = await plan(c.request.input), list = async () => array<Comp>(await eda.sch_PrimitiveComponent.getAll()), before = new Map((await list()).map(x => [x.getState_PrimitiveId(), canonical(serialize(x))]));
            const wireState = async () => canonical(array(await eda.sch_PrimitiveWire.getAll()).map(x => [x.getState_PrimitiveId(), wireGeometry(x.getState_Line(),true), x.getState_Net()]).sort());
            const wires = await wireState();
            let staged: string | undefined, restored: string | undefined, createAttempted = false, recoveryAttempted = false, rollbackAttempted = false;
            const receipts = new Map<string, string>();
            let expected: Record<string, unknown> = {};
            let finalContractReady = false;
            const pull = async (id: string) => { const found = (await list()).find(x => x.getState_PrimitiveId() === id); if (!found)
                throw Error('V2_COMPONENT_ABSENT'); return found; };
            const equal = (state: Record<string, unknown>, patch: Record<string, unknown>) => Object.entries(patch).every(([k, v]) => k === 'otherProperty' ? Object.entries(object(v)).every(([key, value]) => Object.hasOwn(object(state[k]), key) && String(object(state[k])[key]) === String(value)) : state[k] === v);
            const persist = async (id: string, source: unknown) => { const receipt = sourceReceipt(serialize(await pull(id)), source); if (receipt.length > 8192)
                throw Error('V2_SOURCE_TOO_LARGE'); const key = sourceStorageKey(c.request.target_ref.project_uuid!, c.request.target_ref.document_uuid!, id); await c.effect(async () => { await eda.sys_Storage.setExtensionUserConfig(key, receipt); receipts.set(id, receipt); }); };
            const bound = (id: string, x: Comp, source: unknown) => { const receipt = receipts.get(id); return !!receipt && sourceReceipt(serialize(x), source) === receipt && eda.sys_Storage.getExtensionUserConfig(sourceStorageKey(c.request.target_ref.project_uuid!, c.request.target_ref.document_uuid!, id)) === receipt; };
            c.prepare(async () => {
                const liveSource = sourceAsset(await eda.lib_Device.get(p.target.uuid, p.target.libraryUuid));
                if (canonical(liveSource) !== canonical(sourceAsset(p.targetSource)))
                    return { changed: null, verification: unavailable() };
                const fresh = await list(), map = new Map(fresh.map(x => [x.getState_PrimitiveId(), x]));
                if (createAttempted && !staged || recoveryAttempted && !restored || staged && before.has(staged) || restored && before.has(restored) || fresh.some(x => !before.has(x.getState_PrimitiveId()) && x.getState_PrimitiveId() !== staged && x.getState_PrimitiveId() !== restored) || [...before].some(([id, v]) => id !== p.primitiveId && (!map.has(id) || canonical(serialize(map.get(id)!)) !== v)) || await wireState() !== wires)
                    return { changed: null, verification: unavailable() };
                const replacement = staged ? map.get(staged) : undefined, original = map.get(p.primitiveId), recovered = restored ? map.get(restored) : original;
                const rollbackComplete = rollbackAttempted && !replacement && !!recovered && equal(serialize(recovered), { ...p.rollbackProps, x: p.x, y: p.y, ...(p.rotation !== undefined ? { rotation: p.rotation } : {}), ...(p.mirror !== undefined ? { mirror: p.mirror } : {}), ...(p.addIntoBom !== undefined ? { addIntoBom: p.addIntoBom } : {}), ...(p.addIntoPcb !== undefined ? { addIntoPcb: p.addIntoPcb } : {}) }) && (restored ? bound(restored, recovered, p.oldSource) : canonical(serialize(recovered)) === before.get(p.primitiveId));
                if (rollbackComplete)
                    return covered({ previousPrimitiveId: p.primitiveId, primitiveId: recovered!.getState_PrimitiveId(), component: serialize(recovered!), rollbackAttempted, rollbackComplete }, 3, 0, restored !== undefined, ['fresh_compensation_instance_and_source', 'staged_absence', 'wires_unchanged']);
                const newPins = staged && replacement ? await pins(staged) : undefined;
                const matched = finalContractReady && !!replacement && equal(serialize(replacement), expected) && bound(staged!, replacement, p.targetSource) && !!newPins;
                let pinDiff: Record<string, unknown> = { available: false };
                if (p.oldPins && newPins) {
                    const d = difference(p.oldPins, newPins);
                    pinDiff = { available: true, oldCount: p.oldPins.length, newCount: newPins.length, removed: d.removed.slice(0, 20), added: d.added.slice(0, 20), moved: d.moved.slice(0, 20), removedCount: d.removed.length, addedCount: d.added.length, movedCount: d.moved.length };
                }
                return covered({ primitiveId: staged, previousPrimitiveId: p.primitiveId, previousDevice: { uuid: p.oldDevice.uuid, libraryUuid: p.oldDevice.libraryUuid, resolvedVia: p.oldDevice.via, ...(p.oldName ? { name: p.oldName } : {}) }, device: p.target, pinDiff, component: replacement ? serialize(replacement) : undefined, rollbackAttempted, rollbackComplete: false }, 3, Number(!!replacement) + Number(matched) + Number(!original), !!replacement || !original, ['fresh_replacement_fields_and_source', 'fresh_original_absence', 'pin_geometry_diff', 'unrelated_components_and_wires']);
            });
            try {
                await c.effect(async () => { createAttempted = true; staged = (await eda.sch_PrimitiveComponent.create(p.target, p.x, p.y, undefined, p.rotation, p.mirror, p.addIntoBom, p.addIntoPcb))?.getState_PrimitiveId(); });
                if (!staged || before.has(staged))
                    throw Error('V2_STAGED_ID_UNAVAILABLE');
                const initial = serialize(await pull(staged)), sourceProps = object(object(object(p.targetSource).property).otherProperty), props = backfill(object(initial.otherProperty), sourceProps, { onlyExistingKeys: true }).merged;
                if (sourceProps.Value !== undefined && sourceProps.Value !== null && sourceProps.Value !== '')
                    props.Value = sourceProps.Value;
                const supplier = String(object(object(p.targetSource).property).supplierId ?? '');
                expected = { x: p.x, y: p.y, ...(p.rotation !== undefined ? { rotation: p.rotation } : {}), ...(p.mirror !== undefined ? { mirror: p.mirror } : {}), ...(p.addIntoBom !== undefined ? { addIntoBom: p.addIntoBom } : {}), ...(p.addIntoPcb !== undefined ? { addIntoPcb: p.addIntoPcb } : {}), otherProperty: { ...props, ...(p.keepProperties ? p.carried : {}) }, ...(/^C\d+$/.test(supplier) ? { supplierId: supplier } : {}) };
                await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(staged!, { otherProperty: props, ...(/^C\d+$/.test(supplier) ? { supplierId: supplier } : {}) } as never); });
                await persist(staged, p.targetSource);
                const stagedState = serialize(await pull(staged));
                if (!equal(stagedState, { ...expected, otherProperty: props }) || !await pins(staged))
                    throw Error('V2_STAGED_VERIFICATION_FAILED');
                // Freeze the final postcondition before the destructive step; a late delete
                // must never certify the temporary staged identity as the replacement.
                Object.assign(expected, p.carryProps, { otherProperty: { ...props, ...(p.keepProperties ? p.carried : {}) } });
                finalContractReady = true;
                if (await wireState() !== wires)
                    throw Error('V2_WIRE_DRIFT');
                await c.effect(async () => { if (canonical(serialize(await pull(p.primitiveId))) !== before.get(p.primitiveId))
                    throw Error('V2_ORIGINAL_DRIFT'); await eda.sch_PrimitiveComponent.delete(p.primitiveId); });
                if ((await list()).some(x => x.getState_PrimitiveId() === p.primitiveId))
                    throw Error('V2_ORIGINAL_SURVIVED');
                await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(staged!, expected as never); });
                await persist(staged, p.targetSource);
                const finalState = await pull(staged);
                if (!equal(serialize(finalState), expected) || !bound(staged, finalState, p.targetSource))
                    throw Error('V2_FINAL_REPLACEMENT_MISMATCH');
            }
            catch {
                // Reconcile exact identities before compensation. No create with missing ID,
                // no mutation in the reconciler, and deadline admission prevents late cleanup.
                if (staged && !before.has(staged))
                    try {
                        const state = await list();
                        if (state.some(x => !before.has(x.getState_PrimitiveId()) && x.getState_PrimitiveId() !== staged))
                            throw Error('V2_UNKNOWN_RESIDUAL');
                        await c.effect(async () => { rollbackAttempted = true; await eda.sch_PrimitiveComponent.delete(staged!); });
                        if ((await list()).some(x => x.getState_PrimitiveId() === staged))
                            throw Error('V2_STAGED_SURVIVED');
                        if (!(await list()).some(x => x.getState_PrimitiveId() === p.primitiveId)) {
                            await c.effect(async () => { recoveryAttempted = true; restored = (await eda.sch_PrimitiveComponent.create(p.oldDevice, p.x, p.y, p.snapshot.subPartName as string | undefined, p.rotation, p.mirror, p.addIntoBom, p.addIntoPcb))?.getState_PrimitiveId(); });
                            if (!restored || before.has(restored))
                                throw Error('V2_RECOVERY_ID_UNAVAILABLE');
                            await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(restored!, p.rollbackProps as never); });
                            await persist(restored, p.oldSource);
                        }
                    }
                    catch { /* explicit scope verifier retains unresolved compensation */ }
            }
            return c.verify();
        } };
}
