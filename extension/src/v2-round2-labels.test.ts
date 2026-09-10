import test from 'node:test';
import assert from 'node:assert/strict';
import { silkCreate } from './v2-silk-create';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
for (const mode of ['normal', 'wrong', 'missing', 'late', 'drift'] as const)
    test('label authoring native scope ' + mode, async () => {
        const rows: any[] = [];
        let calls = 0, release!: () => void;
        (globalThis as any).eda = { pcb_PrimitiveString: { getAll: async () => rows, create: async (...a: any[]) => { calls++; if (mode === 'late')
                    await new Promise<void>(r => release = r); const x = { getState_PrimitiveId: () => 'id', getState_Layer: () => a[0], getState_X: () => mode === 'wrong' ? 999 : a[1], getState_Y: () => a[2], getState_Text: () => a[3], getState_FontSize: () => a[5], getState_LineWidth: () => a[6], getState_Rotation: () => a[8], getState_Mirror: () => a[11] }; rows.push(x); return mode === 'missing' ? undefined : x; } } };
        const action = silkCreate('pcb.silk.netnames', async (_p, a) => { await a.create(3, 1, 2, 'N', '', 40, 6, 0 as never, 0, false, 0, false, false); return { total: 1 }; });
        const req: Request = { protocol: V2, action: 'pcb.silk.netnames', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { zone_rect: {} }, budget_ms: mode === 'late' ? 5 : 1000 };
        const ex = new ControlledExecutor(() => action, async () => mode === 'drift' ? { ...target, document_uuid: 'other' } : target), pending = ex.execute(req, 'digest');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            await assert.rejects(ex.execute({ ...req, operation_id: 'second' }, 'other'), /BARRIER/);
            release();
        }
        const result = await pending;
        assert.equal(result.verification.verdict, mode === 'normal' || mode === 'late' ? 'satisfied' : mode === 'wrong' ? 'partial' : mode === 'drift' ? 'unchanged' : 'unavailable');
        assert.equal(calls, mode === 'drift' ? 0 : 1);
        if (mode !== 'drift') {
            await ex.reconcile('o');
            assert.equal(calls, 1);
        }
    });
