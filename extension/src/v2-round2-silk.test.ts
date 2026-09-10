import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { silkPatch } from './v2-silk-actions';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
for (const mode of ['settled-rejection', 'late-rejection', 'late-success'] as const)
    test('silk Host workaround ' + mode, async () => {
        const state = { x: 0, y: 0, layer: 3, mirror: false };
        let count = 0, done!: () => void;
        const item = { getState_PrimitiveId: () => 'id', getState_X: () => state.x, getState_Y: () => state.y, getState_Rotation: () => 0, getState_FontSize: () => 20, getState_LineWidth: () => 3, getState_Value: () => 'R1', getState_Layer: () => state.layer, getState_Mirror: () => state.mirror, getState_ParentPrimitiveId: () => 'component' };
        (globalThis as any).eda = { pcb_PrimitiveAttribute: { getAll: async () => [item], modify: async (id: string, patch: object) => { count++; if (count === 1) {
                    if (mode !== 'settled-rejection')
                        await new Promise<void>(r => done = r);
                    if (mode !== 'late-success')
                        throw Error('unsupported mirror');
                } Object.assign(state, patch); return item; } }, pcb_PrimitiveString: { getAll: async () => [] } };
        const action = silkPatch('pcb.silk.align', async () => ({ steps: [{ id: 'id', attribute: true, patch: { x: 10, layer: 4, mirror: true } }], value: {} }));
        const req: Request = { protocol: V2, action: 'pcb.silk.align', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'op', target_ref: target, input: {}, budget_ms: mode === 'settled-rejection' ? 1000 : 5 };
        const x = new ControlledExecutor(() => action, async () => target), pending = x.execute(req, 'd');
        if (mode !== 'settled-rejection') {
            await new Promise(r => setTimeout(r, 20));
            done();
        }
        const result = await pending;
        assert.equal(count, mode === 'settled-rejection' ? 2 : 1);
        assert.equal(result.verification.verdict, mode === 'late-rejection' ? 'unchanged' : 'satisfied');
        await x.reconcile('op');
        assert.equal(count, mode === 'settled-rejection' ? 2 : 1);
    });
