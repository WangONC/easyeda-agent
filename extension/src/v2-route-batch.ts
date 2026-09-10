import { type NativeAction, unavailable } from './execution-v2';
import { canonical, fastPath, matchesOperation, validOperations, type NativePort, type Primitive, type Observation as BoardObservation } from './fast-path';
import { nativePort } from './fast-path-native';
import { declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';
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
                const unknown = [...attempted].some(i => ops[i].type.startsWith('add') && !created.has(i)) || createdIDs.size !== created.size || [...createdIDs].some(id => old.has(id)) || [...now.keys()].some(id => !old.has(id) && !createdIDs.has(id)) || [...old].some(([id, item]) => (!removed.has(id) || now.has(id)) && canonical(now.get(id)) !== canonical(item));
                const items = ops.map((op, index) => { const id = op.type.startsWith('delete') ? op.id : created.get(index); const matched = op.type.startsWith('delete') ? !now.has(id!) : !!id && matchesOperation(now.get(id), op); return { index, id, postcondition_satisfied: matched, attempted: attempted.has(index), error: errors.get(index) }; });
                const satisfied = items.filter(i => i.postcondition_satisfied).length;
                const value = { created_ids: [...createdIDs].filter(id => now.has(id)), deleted_ids: [...removed].filter(id => !now.has(id)), item_results: items, failed_index: failed, revision_before: before.board_revision, revision_after: after.board_revision, readback_verified: !unknown && satisfied === ops.length, rollback_attempted: rollbackAttempted, rollback_complete: rollbackAttempted && [...createdIDs].every(id => !now.has(id)) && [...removed].every(id => now.has(id)), warnings: unknown ? ['Residual scope is unknown; reconcile without replay.'] : [], native_api_call_count: n.calls };
                if (unknown)
                    return { value, changed: null, verification: unavailable() };
                const changed = canonical([...old]) !== canonical([...now]);
                return covered(value, ops.length, satisfied, changed, ['fresh_all_item_geometry_and_identity', 'unrelated_primitives_unchanged', 'no_unowned_created_primitive', 'fresh_board_revision']);
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
