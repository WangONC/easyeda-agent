import test from 'node:test';
import assert from 'node:assert/strict';
import { footprintBuild } from './v2-library-build';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'LIBRARY' as const, session: 's', activation: 'a', library_uuid: 'lib' };
for (const mode of ['normal', 'wrong', 'late', 'bad-save', 'drift'] as const)
    test('footprint builder scope ' + mode, async () => {
        const pads: any[] = [];
        let calls = 0, release!: () => void;
        (globalThis as any).eda = { lib_Footprint: { get: async () => ({ uuid: 'asset' }), openInEditor: async () => 'tab' }, dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: 'asset', tabId: 'tab', documentType: 4 }) }, pcb_PrimitivePad: { getAll: async () => pads, create: async (...a: any[]) => { calls++; if (mode === 'late')
                    await new Promise<void>(r => release = r); const x = { getState_PrimitiveId: () => 'pad', getState_Layer: () => a[0], getState_PadNumber: () => a[1], getState_X: () => mode === 'wrong' ? 999 : a[2], getState_Y: () => a[3], getState_Rotation: () => a[4], getState_Pad: () => a[5], getState_Hole: () => a[7], getState_Metallization: () => a[11], getState_PadType: () => a[12] }; pads.push(x); return x; }, delete: async () => pads.splice(0) }, pcb_PrimitivePolyline: { getAll: async () => [] }, pcb_Document: { save: async () => mode === 'bad-save' ? undefined : true } };
        const action = footprintBuild(() => ({ pads: [{ number: '1', layer: 1, x: 0, y: 0, rotation: 0, shape: ['RECT', 20, 20] as never, hole: null, metallization: true, padType: 0 as never }], lines: [] }));
        const req: Request = { protocol: V2, action: 'library.footprint.build', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { uuid: 'asset', libraryUuid: 'lib', pads: [] }, budget_ms: mode === 'late' ? 5 : 1000 };
        const ex = new ControlledExecutor(() => action, async () => mode === 'drift' ? { ...target, library_uuid: 'other' } : target), pending = ex.execute(req, 'd');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            release();
        }
        const result = await pending;
        assert.equal(result.verification.verdict, mode === 'normal' ? 'satisfied' : mode === 'drift' ? 'unchanged' : 'partial');
        const count = calls;
        if (mode !== 'drift')
            await ex.reconcile('o');
        assert.equal(calls, count);
    });
