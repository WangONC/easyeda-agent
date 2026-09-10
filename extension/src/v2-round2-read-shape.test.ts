import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeAction } from './actions';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'schematic', tab_id: 't' };
for (const action of ['schematic.read', 'schematic.check'])
    test('missing netlist is not an empty qualified schematic ' + action, async () => {
        (globalThis as any).eda = { sch_PrimitiveComponent: { getAll: async () => [] }, sch_PrimitiveWire: { getAll: async () => [] }, sch_ManufactureData: { getNetlistFile: async () => undefined } };
        const req: Request = { protocol: V2, action, action_revision: '1', schema: 's', request_id: 'r', operation_id: 'o', target_ref: target, input: {}, budget_ms: 1000 };
        const result = await new ControlledExecutor(nativeAction, async () => target).execute(req, 'd');
        if (action === 'schematic.read')
            assert.notEqual(result.verification.verdict, 'satisfied');
        else {
            assert.equal((result.value as any).passed, null);
            assert.equal((result.value as any).incomplete, true);
        }
        assert.equal(result.effects.effect_started, false);
    });
