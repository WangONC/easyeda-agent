import test from 'node:test';
import assert from 'node:assert/strict';
import { rebindBoard } from './v2-board-actions';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'PROJECT' as const, session: 's', activation: 'a', project_uuid: 'p' };
for (const mode of ['normal', 'noop', 'reject', 'late', 'drift'] as const)
    test('board rebind business/compensation ' + mode, async () => {
        let rows: any[] = [{ name: 'Board', schematic: { uuid: mode === 'noop' ? 'new' : 'old' } }], writes = 0, creates = 0, release!: () => void;
        (globalThis as any).eda = { dmt_Schematic: { getSchematicInfo: async (uuid: string) => ({ uuid, parentProjectUuid: 'p' }) }, dmt_Board: { getAllBoardsInfo: async () => structuredClone(rows), getCurrentBoardInfo: async () => rows[0], deleteBoard: async (name: string) => { writes++; rows = rows.filter(x => x.name !== name); return true; }, createBoard: async (uuid: string) => { writes++; creates++; if (mode === 'late' && creates === 1)
                    await new Promise<void>(r => release = r); if (mode === 'reject' && creates === 1)
                    throw Error('native rejected'); const name = 'Auto' + creates; rows.push({ name, schematic: { uuid } }); return name; }, modifyBoardName: async (from: string, to: string) => { writes++; rows.find(x => x.name === from).name = to; return true; } } };
        const req: Request = { protocol: V2, action: 'board.rebind', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { schematicUuid: 'new' }, budget_ms: mode === 'late' ? 5 : 1000 };
        const ex = new ControlledExecutor(() => rebindBoard, async () => mode === 'drift' ? { ...target, project_uuid: 'other' } : target), pending = ex.execute(req, 'd');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            release();
        }
        const result = await pending;
        if (mode === 'normal' || mode === 'noop' || mode === 'late')
            assert.equal(result.verification.verdict, 'satisfied');
        else
            assert.notEqual(result.verification.verdict, 'satisfied');
        if (mode === 'reject') {
            assert.equal(creates, 2);
            assert.deepEqual(rows, [{ name: 'Board', schematic: { uuid: 'old' } }]);
        }
        if (mode === 'noop' || mode === 'drift')
            assert.equal(writes, 0);
        if (mode === 'late')
            assert.equal(creates, 1);
        const count = writes;
        if (mode !== 'drift' && mode !== 'noop')
            await ex.reconcile('o');
        assert.equal(writes, count);
    });
