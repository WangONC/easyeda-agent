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
            const before = array(await eda.pcb_PrimitivePour.getAll());
            let regions:IPCB_PrimitivePoured[]=[];let regionsAvailable=true;
            try{regions=array(await eda.pcb_PrimitivePoured.getAll())}catch{regionsAvailable=false}
            const oldRegions = new Map(regions.map(x => [x.getState_PrimitiveId(), region(x)]));
            const sources = new Map(before.map(x => [x.getState_PrimitiveId(), source(x)]));
            const selected = logical ? logical.map(handle => { const matches = before.filter(x => logicalPlaneId(x) === handle); if (matches.length !== 1)
                throw Error('V2_AMBIGUOUS_LOGICAL_PLANE'); return matches[0]; }) : before.filter(x => p.net === undefined || x.getState_Net() === p.net);
            const ids = new Set(selected.map(x => x.getState_PrimitiveId())), returned = new Map<string, string>(), attempted = new Set<string>(), settled = new Set<string>();
            const port = makePort(), scope = { project_uuid: t.project_uuid, document_uuid: t.document_uuid }, initial = (await fastPath.snapshotData(port, scope)).data;
            if (p.base_revision !== undefined && p.base_revision !== initial.board_revision)
                throw Error('V2_REVISION_MISMATCH');
            c.prepare(async () => {
                const pours = array(await eda.pcb_PrimitivePour.getAll());let after:IPCB_PrimitivePoured[]=[];let afterRegionsAvailable=true;
                try{after=array(await eda.pcb_PrimitivePoured.getAll())}catch{afterRegionsAvailable=false}
                const snapshot = (await fastPath.snapshotData(port, scope)).data;
                const unaffected = (x: typeof initial) => ({ components: x.components, pads: x.pads, traces: x.traces, vias: x.vias, copper_layers: x.copper_layers, rules: x.rules });
                if (canonical(unaffected(initial)) !== canonical(unaffected(snapshot)))
                    return { changed: null, verification: unavailable() };
                const current=new Map(pours.map(x=>[x.getState_PrimitiveId(),x]));
                const unrelatedChanged=pours.some(x=>!sources.has(x.getState_PrimitiveId()))
                    || before.some(x=>!ids.has(x.getState_PrimitiveId())&&(!current.has(x.getState_PrimitiveId())||sources.get(x.getState_PrimitiveId())!==source(current.get(x.getState_PrimitiveId())!)))
                    || regionsAvailable&&afterRegionsAvailable&&(after.some(x => !ids.has(x.getState_PourPrimitiveId()) && oldRegions.get(x.getState_PrimitiveId()) !== region(x)) || regions.some(x => !ids.has(x.getState_PourPrimitiveId()) && !after.some(y => region(x) === region(y))));
                if (unrelatedChanged)
                    return { changed: null, verification: unavailable() };
                const revisionChanged=initial.board_revision!==snapshot.board_revision;
                const items = selected.map(x => { const id = x.getState_PrimitiveId(), rid = returned.get(id), freshRegion = after.find(y => y.getState_PrimitiveId() === rid && y.getState_PourPrimitiveId() === id),freshPour=current.get(id);const retained=!!freshPour&&source(freshPour)===sources.get(id);return { logical_id: logicalPlaneId(x), net: x.getState_Net(), layer: Number(x.getState_Layer()), previous_native_id: id, current_native_id:retained?id:null, recreated: false, region_id: rid??null,postcondition_verified:settled.has(id)&&retained,recompute_observed:!!freshRegion||revisionChanged,native_settled:settled.has(id),attempted: attempted.has(id), connectivity: 'unknown',connectivity_requires:'pcb.drc' }; });
                const matched = items.filter(x => x.postcondition_verified).length, changed = revisionChanged || canonical([...oldRegions].sort()) !== canonical(after.map(x => [x.getState_PrimitiveId(), region(x)]).sort()) || items.some(x=>x.current_native_id===null);
                const common={item_results:items,connectivity:'unknown',connectivity_requires:'pcb.drc',revision_before:initial.board_revision,revision_after:snapshot.board_revision,native_api_call_count:port.calls};
                const value = logical ? { ...common,requested_scope: { logical_ids: logical }, actual_scope: 'selected logical pour recompute; unrelated source geometry checked', freshness: 'observed', revision: snapshot.board_revision, old_preflight_invalidated: changed } : { ...common,pours: selected.length, rebuilt: matched };
                return covered(value, selected.length, matched, changed, ['native_recompute_settled','fresh_logical_pour_identity_and_source_geometry','unrelated_regions_and_source_geometry','fresh_board_revision','connectivity_deferred_to_drc']);
            });
            for (const x of selected)
                try {
                    await c.effect(async () => { const id = x.getState_PrimitiveId(), fresh = array(await eda.pcb_PrimitivePour.getAll()).find(y => y.getState_PrimitiveId() === id); if (!fresh || source(fresh) !== sources.get(id))
                        throw Error('V2_PLANE_DRIFT'); attempted.add(id); const r = await fresh.rebuildCopperRegion(); settled.add(id); if (r && r.getState_PourPrimitiveId() === id)
                        returned.set(id, r.getState_PrimitiveId()); });
                }
                catch { /* fresh verifier never rebuilds */ }
            return c.verify();
        } };
}
