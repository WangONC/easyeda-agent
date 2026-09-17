import { type NativeAction, unavailable } from './execution-v2';
import { canonical, fastPath, matchesOperation, validOperations, type NativePort, type Primitive, type Observation as BoardObservation } from './fast-path';
import { nativePort } from './fast-path-native';
import { declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';
const GEOMETRY_EPSILON=1e-6;
const quantize=(value:number)=>Math.round(value/GEOMETRY_EPSILON);
type CopperInterval={start:number;end:number};
// Compare copper as a set of straight-line intervals, not as Host primitive
// identities. EasyEDA is allowed to merge/split adjacent collinear traces, but
// may not change net/layer/width or add/remove any branch of copper.
export function canonicalCopperGeometry(items:Primitive[]):string|null{
 const groups=new Map<string,CopperInterval[]>();
 for(const item of items){
  if(item.kind!=='trace'||typeof item.net!=='string'||!Number.isInteger(item.layer)||typeof item.width!=='number'||!Number.isFinite(item.width)||!Array.isArray(item.points)||item.points.length!==2)return null;
  let [[x1,y1],[x2,y2]]=item.points;
  if(![x1,y1,x2,y2].every(Number.isFinite))return null;
  let dx=x2-x1,dy=y2-y1;const length=Math.hypot(dx,dy);if(length<=GEOMETRY_EPSILON)return null;
  dx/=length;dy/=length;
  if(dx < -GEOMETRY_EPSILON || Math.abs(dx)<=GEOMETRY_EPSILON&&dy<0){dx=-dx;dy=-dy}
  const offset=-dy*x1+dx*y1;
  let start=dx*x1+dy*y1,end=dx*x2+dy*y2;if(start>end)[start,end]=[end,start];
  const key=JSON.stringify([item.net,item.layer,quantize(item.width),quantize(dx),quantize(dy),quantize(offset)]);
  const rows=groups.get(key)??[];rows.push({start,end});groups.set(key,rows);
 }
 const normalized=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,rows])=>{
  rows.sort((a,b)=>a.start-b.start||a.end-b.end);const merged:CopperInterval[]=[];
  for(const row of rows){const last=merged.at(-1);if(last&&row.start<=last.end+GEOMETRY_EPSILON)last.end=Math.max(last.end,row.end);else merged.push({...row})}
  return [key,merged.map(row=>[quantize(row.start),quantize(row.end)])];
 });
 return canonical(normalized);
}
export function copperGeometryEquivalent(expected:Primitive[],observed:Primitive[]):boolean{
 const left=canonicalCopperGeometry(expected),right=canonicalCopperGeometry(observed);
 return left!==null&&left===right;
}
function primitives(data: BoardObservation): Map<string, Primitive> {
    const found = new Map<string, Primitive>();
    for (const group of [data.components, data.pads, data.traces, data.vias, data.fills]) {
        if (!Array.isArray(group))
            throw Error('V2_INCOMPLETE_BOARD_OBSERVATION');
        for (const item of group) {
            if (!item.id || found.has(item.id))
                throw Error('V2_AMBIGUOUS_PRIMITIVE');
            found.set(item.id, item);
        }
    }
    return found;
}
// Uses Fast geometry and revision observation, not Fast's legacy transaction
// result or reducer. Every native invocation has an already registered verifier.
export function routeBatch(port: () => NativePort = nativePort): NativeAction {
    return {
        mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => { declaredReadFields('route.apply_batch')(p); validOperations(p.operations); }, run: async (c) => {
            const p = c.request.input;
            if (p.client_transaction_id !== c.request.operation_id)
                throw Error('V2_TRANSACTION_ID_MISMATCH');
            for (const [key, value] of Object.entries({ project_uuid: c.request.target_ref.project_uuid, document_uuid: c.request.target_ref.document_uuid }))
                if (p[key] !== undefined && p[key] !== value)
                    throw Error('V2_TARGET_MISMATCH');
            const bound = { ...p, project_uuid: c.request.target_ref.project_uuid, document_uuid: c.request.target_ref.document_uuid };
            validOperations(p.operations);
            const ops = p.operations, n = port();
            const before = (await fastPath.snapshotData(n, bound)).data, old = primitives(before);
            if (before.board_revision !== p.base_revision)
                throw Error('V2_REVISION_MISMATCH');
            const removed = new Set<string>();
            for (const op of ops) {
                if (op.type.startsWith('delete')) {
                    const item = old.get(op.id!);
                    if (!item || item.locked || item.kind !== op.type.slice(7) || (item.kind === 'trace' && !before.copper_layers.includes(item.layer!)))
                        throw Error('PROTECTED_OR_INVALID_DELETE');
                    removed.add(op.id!);
                }
                else if (op.type === 'add_via') {
                    if (![op.from_layer!, op.to_layer!, 1, 2].every(layer => before.copper_layers.includes(layer)))
                        throw Error('INVALID_COPPER_LAYER');
                }
                else if (!before.copper_layers.includes(op.layer!))
                    throw Error('INVALID_COPPER_LAYER');
            }
            const attempted = new Set<number>(), created = new Map<number, string>(), errors = new Map<number, string>();
            let failed: number | null = null, rollbackAttempted = false;
            c.prepare(async () => {
                const after = (await fastPath.snapshotData(n, bound)).data, now = primitives(after), createdIDs = new Set(created.values());
                const deletedTraceIDs=new Set(ops.filter(op=>op.type==='delete_trace').map(op=>op.id!));
                const expectedTraces=before.traces.filter(item=>item.kind==='trace'&&!deletedTraceIDs.has(item.id)).map(item=>structuredClone(item));
                const plannedTraceRows:{index:number;item:Primitive}[]=[];
                for(const [index,op] of ops.entries())if(op.type==='add_trace'){
                    const item:Primitive={id:'planned-'+index,kind:'trace',net:op.net,layer:op.layer,width:op.width,points:op.points};
                    plannedTraceRows.push({index,item});expectedTraces.push(item);
                }
                const observedTraces=after.traces.filter(item=>item.kind==='trace');
                const traceEquivalent=copperGeometryEquivalent(expectedTraces,observedTraces);
                // Full-board equivalence is necessary but not sufficient when a planned
                // trace is already covered by authoritative before copper. Require every
                // trace operation to make an independently observable canonical delta;
                // otherwise old same-net copper could mask a native no-op.
                const traceDeltaProvable=new Map<number,boolean>();
                for(const row of plannedTraceRows){
                    const without=expectedTraces.filter(item=>item!==row.item);
                    traceDeltaProvable.set(row.index,!copperGeometryEquivalent(expectedTraces,without));
                }
                for(const [index,op] of ops.entries())if(op.type==='delete_trace'){
                    const deleted=before.traces.find(item=>item.kind==='trace'&&item.id===op.id);
                    traceDeltaProvable.set(index,!!deleted&&!copperGeometryEquivalent(expectedTraces,[...expectedTraces,structuredClone(deleted)]));
                }
                const unknown = [...attempted].some(i => ops[i].type.startsWith('add') && !created.has(i))
                    || createdIDs.size !== created.size
                    || [...createdIDs].some(id => old.has(id))
                    // Trace IDs may be replaced by deterministic Host merge/split.
                    || [...now].some(([id,item]) => item.kind!=='trace'&&!old.has(id)&&!createdIDs.has(id))
                    || [...old].some(([id,item]) => item.kind!=='trace'&&(!removed.has(id)||now.has(id))&&canonical(now.get(id))!==canonical(item))
                    || [...created].some(([index,id])=>ops[index].type!=='add_trace'&&!now.has(id));
                const items = ops.map((op, index) => { const id = op.type.startsWith('delete') ? op.id : created.get(index); const matched = op.type==='add_trace'||op.type==='delete_trace' ? traceEquivalent&&traceDeltaProvable.get(index)===true : op.type.startsWith('delete') ? !now.has(id!) : !!id && matchesOperation(now.get(id), op); return { index, id, postcondition_satisfied: matched, attempted: attempted.has(index), verification:op.type.includes('trace')?'canonical_copper_geometry_delta':'exact_primitive',error: errors.get(index) }; });
                const satisfied = items.filter(i => i.postcondition_satisfied).length;
                const value = { created_ids: [...createdIDs].filter(id => now.has(id)), deleted_ids: [...removed].filter(id => !now.has(id)), item_results: items, failed_index: failed, revision_before: before.board_revision, revision_after: after.board_revision, canonical_trace_geometry_equivalent:traceEquivalent,unproven_trace_delta_indices:[...traceDeltaProvable].filter(([,proved])=>!proved).map(([index])=>index),planned_trace_segments:ops.filter(op=>op.type==='add_trace').length,observed_trace_primitives:observedTraces.length,readback_verified: !unknown && satisfied === ops.length, rollback_attempted: rollbackAttempted, rollback_complete: rollbackAttempted && [...createdIDs].every(id => !now.has(id)) && [...removed].every(id => now.has(id)), warnings: unknown ? ['Residual scope is unknown; reconcile without replay.'] : [], native_api_call_count: n.calls };
                if (unknown)
                    return { value, changed: null, verification: unavailable() };
                const changed = canonical([...old]) !== canonical([...now]);
                return covered(value, ops.length, satisfied, changed, ['canonical_before_plus_planned_delta_vs_after_copper', 'per_operation_copper_delta_not_preexisting', 'fresh_exact_net_layer_width', 'unrelated_primitives_unchanged', 'no_unplanned_copper_geometry', 'fresh_board_revision']);
            });
            for (let i = 0; i < ops.length; i++) {
                const op = ops[i];
                try {
                    await c.effect(async () => {
                        attempted.add(i);
                        if (op.type.startsWith('add')) {
                            const id = await n.create(op);
                            if (!id)
                                throw Error('CREATE_RETURNED_NO_ID');
                            created.set(i, id);
                            if (old.has(id) || [...created.values()].filter(x => x === id).length !== 1)
                                throw Error('V2_FOREIGN_CREATED_ID');
                        }
                        else if (!await n.remove(op.type.slice(7), op.id!))
                            throw Error('DELETE_NOT_CONFIRMED');
                    });
                }
                catch (e) {
                    failed = i;
                    errors.set(i, String(e));
                    break;
                }
            }
            if (failed !== null && created.size) {
                // Compensate only identities positively returned and still matching their
                // operation. Deadline admission can refuse this; reconciliation never writes.
                const fresh = primitives((await fastPath.snapshotData(n, bound)).data);
                if ([...attempted].every(i => !ops[i].type.startsWith('add') || created.has(i)) && [...fresh.keys()].every(id => old.has(id) || [...created.values()].includes(id))) {
                    for (const [index, id] of [...created].reverse()) {
                        if (old.has(id) || !matchesOperation(fresh.get(id), ops[index]))
                            break;
                        try {
                            await c.effect(async () => { rollbackAttempted = true; await n.remove(ops[index].type.slice(4), id); });
                        }
                        catch {
                            break;
                        }
                    }
                }
            }
            return c.verify();
        }
    };
}
