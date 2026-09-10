import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical, fastPath } from './fast-path';
import { nativePort } from './fast-path-native';
import { logicalPlaneId } from './plane-lifecycle';
import { covered } from './v2-batch-actions';
const source = (p: IPCB_PrimitivePour) => canonical([p.getState_PrimitiveId(), p.getState_PourName(), p.getState_Net(), p.getState_Layer(), p.getState_ComplexPolygon().getSource()]);
const region = (p: IPCB_PrimitivePoured) => canonical([p.getState_PrimitiveId(), p.getState_PourPrimitiveId(), p.getState_PourFills().map(f => [f.id, f.path.getSource(), f.fill, f.lineWidth])]);
export function rebuildPlanes(action: string, makePort: () => ReturnType<typeof nativePort> = nativePort): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'NATIVE_RECOMPUTE', validate: declaredReadFields(action), run: async (c) => {
            const p = c.request.input, t = c.request.target_ref;
            if (p.project_uuid !== undefined && p.project_uuid !== t.project_uuid || p.document_uuid !== undefined && p.document_uuid !== t.document_uuid)
                throw Error('V2_TARGET_MISMATCH');
            const logical = p.logical_ids as string[] | undefined;
            if (logical && (!logical.length || logical.length > 64 || new Set(logical).size !== logical.length))
                throw Error('V2_INVALID_LOGICAL_SCOPE');
            if (action === 'pcb.plane.refresh' && !logical)
                throw Error('V2_LOGICAL_SCOPE_REQUIRED');
            const before = array(await eda.pcb_PrimitivePour.getAll()), regions = array(await eda.pcb_PrimitivePoured.getAll()), oldRegions = new Map(regions.map(x => [x.getState_PrimitiveId(), region(x)]));
            const sources = new Map(before.map(x => [x.getState_PrimitiveId(), source(x)]));
            const selected = logical ? logical.map(handle => { const matches = before.filter(x => logicalPlaneId(x) === handle); if (matches.length !== 1)
                throw Error('V2_AMBIGUOUS_LOGICAL_PLANE'); return matches[0]; }) : before.filter(x => p.net === undefined || x.getState_Net() === p.net);
            const ids = new Set(selected.map(x => x.getState_PrimitiveId())), returned = new Map<string, string>(), attempted = new Set<string>();
            const port = makePort(), scope = { project_uuid: t.project_uuid, document_uuid: t.document_uuid }, initial = (await fastPath.snapshotData(port, scope)).data;
            if (p.base_revision !== undefined && p.base_revision !== initial.board_revision)
                throw Error('V2_REVISION_MISMATCH');
            c.prepare(async () => {
                const pours = array(await eda.pcb_PrimitivePour.getAll()), after = array(await eda.pcb_PrimitivePoured.getAll()), snapshot = (await fastPath.snapshotData(port, scope)).data;
                const unaffected = (x: typeof initial) => ({ components: x.components, pads: x.pads, traces: x.traces, vias: x.vias, copper_layers: x.copper_layers, rules: x.rules });
                if (canonical(unaffected(initial)) !== canonical(unaffected(snapshot)))
                    return { changed: null, verification: unavailable() };
                if (pours.length !== before.length || before.some(x => !pours.some(y => sources.get(x.getState_PrimitiveId()) === source(y))) || after.some(x => !ids.has(x.getState_PourPrimitiveId()) && oldRegions.get(x.getState_PrimitiveId()) !== region(x)) || regions.some(x => !ids.has(x.getState_PourPrimitiveId()) && !after.some(y => region(x) === region(y))))
                    return { changed: null, verification: unavailable() };
                const items = selected.map(x => { const id = x.getState_PrimitiveId(), rid = returned.get(id), fresh = after.find(y => y.getState_PrimitiveId() === rid && y.getState_PourPrimitiveId() === id); const verified = !!fresh && Array.isArray(fresh.getState_PourFills()) && fresh.getState_PourFills().every(f => !!f.id && Array.isArray(f.path.getSource())); return { logical_id: logicalPlaneId(x), net: x.getState_Net(), layer: Number(x.getState_Layer()), previous_native_id: id, current_native_id: id, recreated: false, region_id: rid, postcondition_verified: verified, attempted: attempted.has(id), connectivity: 'unknown' }; });
                if ([...attempted].some(id => !returned.has(id)))
                    return { value: { item_results: items }, changed: null, verification: unavailable() };
                const matched = items.filter(x => x.postcondition_verified).length, changed = canonical([...oldRegions].sort()) !== canonical(after.map(x => [x.getState_PrimitiveId(), region(x)]).sort());
                const value = logical ? { item_results: items, requested_scope: { logical_ids: logical }, actual_scope: 'selected native pour region rebuild; unrelated observed regions checked', freshness: 'observed', revision: snapshot.board_revision, revision_before: initial.board_revision, revision_after: snapshot.board_revision, connectivity: 'unknown', old_preflight_invalidated: changed, native_api_call_count: port.calls } : { pours: selected.length, rebuilt: matched };
                return covered(value, selected.length, matched, changed, ['native_returned_region_identity', 'fresh_region_to_pour_ownership_and_fill_shape', 'unrelated_regions_and_source_geometry', 'fresh_board_revision']);
            });
            for (const x of selected)
                try {
                    await c.effect(async () => { const id = x.getState_PrimitiveId(), fresh = array(await eda.pcb_PrimitivePour.getAll()).find(y => y.getState_PrimitiveId() === id); if (!fresh || source(fresh) !== sources.get(id))
                        throw Error('V2_PLANE_DRIFT'); attempted.add(id); const r = await fresh.rebuildCopperRegion(); if (r && r.getState_PourPrimitiveId() === id)
                        returned.set(id, r.getState_PrimitiveId()); });
                }
                catch { /* fresh verifier never rebuilds */ }
            return c.verify();
        } };
}
