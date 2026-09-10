import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMove } from './v2-group-move';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'schematic', tab_id: 't' };
for (const mode of ['normal', 'no-op', 'wrong', 'late', 'drift'] as const)
    test('group element scoped verification ' + mode, async () => {
        const state = { x: 1, y: 2 }, item = { getState_PrimitiveId: () => 'c', getState_Designator: () => 'R1' };
        let calls = 0, release!: () => void;
        (globalThis as any).eda = { sch_PrimitiveComponent: { getAll: async () => [item], modify: async (_id: string, patch: object) => { calls++; if (mode === 'late')
                    await new Promise<void>(r => release = r); if (mode !== 'wrong')
                    Object.assign(state, patch); return item; } }, sch_PrimitiveWire: { getAll: async () => [] } };
        const action = groupMove(async () => ({ elements: [{ id: 'c', comp: item as never }], flagPlans: [], allComponents: [item as never], allWires: [], wantIds: new Set(['c']), dx: mode === 'no-op' ? 0 : 3, dy: 0 }), () => ({ ...state }), x => x as number[]);
        const req: Request = { protocol: V2, action: 'schematic.group.move', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { primitiveIds: ['c'], dx: 3, dy: 0 }, budget_ms: mode === 'late' ? 5 : 1000 };
        const ex = new ControlledExecutor(() => action, async () => mode === 'drift' ? { ...target, document_uuid: 'other' } : target), pending = ex.execute(req, 'digest');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            await assert.rejects(ex.execute({ ...req, operation_id: 'second' }, 'other'), /BARRIER/);
            release();
        }
        const result = await pending;
        assert.equal(calls, mode === 'no-op' || mode === 'drift' ? 0 : 1);
        assert.equal(result.verification.verdict, mode === 'drift' || mode === 'wrong' ? 'unchanged' : 'satisfied');
        if (mode !== 'drift') {
            await ex.reconcile('o');
            assert.equal(calls, mode === 'no-op' ? 0 : 1);
        }
    });
for (const partial of [false, true])
    test('group merged wire retains segment geometry ' + partial, async () => {
        const state = new Map<string, number[]>([['old', [0, 0, 10, 0, 10, 0, 10, 10]]]);
        let creates = 0, deletes = 0;
        const wire = (id: string) => ({ getState_PrimitiveId: () => id, getState_Line: () => state.get(id)!, getState_Net: () => 'N', getState_Color: () => 'green', getState_LineWidth: () => 1, getState_LineType: () => 0 });
        (globalThis as any).eda = { sch_PrimitiveComponent: { getAll: async () => [] }, sch_PrimitiveWire: { getAll: async () => [...state.keys()].map(wire), delete: async (ids: string[]) => { deletes++; ids.forEach(id => state.delete(id)); return true; }, create: async (line: number[]) => { creates++; if (partial && creates === 2)
                    throw Error('settled rejection'); state.set('merged', [...(state.get('merged') ?? []), ...line]); return wire('merged'); } } };
        const action = groupMove(async () => ({ elements: [], flagPlans: [], allComponents: [], allWires: [wire('old') as never], wantIds: new Set(['old']), dx: 5, dy: 7 }), () => ({}), x => x as number[]);
        const req: Request = { protocol: V2, action: 'schematic.group.move', action_revision: '1', schema: 's', request_id: 'r', operation_id: 'o', target_ref: target, input: { primitiveIds: ['old'], dx: 5, dy: 7 }, budget_ms: 1000 };
        const ex = new ControlledExecutor(() => action, async () => target), result = await ex.execute(req, 'd');
        assert.equal(result.verification.verdict, partial ? 'unavailable' : 'satisfied');
        if (!partial)
            assert.deepEqual(state.get('merged'), [5, 7, 15, 7, 15, 7, 15, 17]);
        await ex.reconcile('o');
        assert.equal(creates, 2);
        assert.equal(deletes, 1);
    });
