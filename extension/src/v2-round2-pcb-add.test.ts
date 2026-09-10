import test from 'node:test';
import assert from 'node:assert/strict';
import { addPcbComponent } from './v2-add-pcb-component';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
for (const mode of ['normal', 'wrong', 'late', 'foreign-via', 'drift'] as const)
    test('PCB placement exact pad/via ownership ' + mode, async () => {
        let created = false, writes = 0, release!: () => void;
        const state = { x: 1, y: 2, layer: 1, designator: 'R1', uniqueId: 'u' }, padState = { net: '' };
        const comp = { getState_PrimitiveId: () => 'c', getState_X: () => state.x, getState_Y: () => state.y, getState_Layer: () => state.layer, getState_Rotation: () => 0, getState_Designator: () => state.designator, getState_UniqueId: () => state.uniqueId };
        const pad = { getState_PrimitiveId: () => 'cp', getState_PadNumber: () => '1', getState_Net: () => padState.net, getState_X: () => 1, getState_Y: () => 2 };
        const via = { getState_PrimitiveId: () => 'foreign', getState_Net: () => '', getState_X: () => 1, getState_Y: () => 2, getState_Diameter: () => 10, getState_HoleDiameter: () => 5 };
        (globalThis as any).eda = { lib_Device: { get: async () => ({ uuid: 'device', libraryUuid: 'lib' }) }, pcb_PrimitiveComponent: { getAll: async () => created ? [comp] : [], create: async () => { writes++; if (mode === 'late')
                    await new Promise<void>(r => release = r); created = true; return comp; }, getAllPinsByPrimitiveId: async () => [pad], modify: async (_id: string, p: object) => { writes++; Object.assign(state, p); return comp; } }, pcb_PrimitiveVia: { getAll: async () => created && mode === 'foreign-via' ? [via] : [] }, pcb_PrimitivePad: { modify: async (_id: string, p: object) => { writes++; if (mode !== 'wrong')
                    Object.assign(padState, p); return pad; } }, pcb_Document: { startCalculatingRatline: async () => { writes++; return true; } } };
        const req: Request = { protocol: V2, action: 'pcb.add_component', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { device: { uuid: 'device', libraryUuid: 'lib' }, x: 1, y: 2, nets: { '1': 'N' } }, budget_ms: mode === 'late' ? 5 : 1000 };
        const ex = new ControlledExecutor(() => addPcbComponent(() => ({ width: 20, height: 20 })), async () => mode === 'drift' ? { ...target, document_uuid: 'other' } : target), pending = ex.execute(req, 'digest');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            release();
        }
        const result = await pending;
        assert.equal(result.verification.verdict, mode === 'normal' ? 'satisfied' : mode === 'foreign-via' ? 'unavailable' : mode === 'drift' ? 'unchanged' : 'partial');
        const count = writes;
        if (mode !== 'drift')
            await ex.reconcile('o');
        assert.equal(writes, count);
        if (mode === 'late')
            assert.equal(writes, 1);
    });
