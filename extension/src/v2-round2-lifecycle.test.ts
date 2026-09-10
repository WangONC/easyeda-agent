import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { nativeAction } from './actions';
const source = { scope: 'PROJECT' as const, session: 's', activation: 'a', project_uuid: 'old' };
const req = (action: string, input: Record<string, unknown>, id = 'o'): Request => ({ protocol: V2, action, action_revision: '1', schema: 's', request_id: 'r', operation_id: id, target_ref: source, input, budget_ms: 1000 });
for (const dest of ['new', 'foreign', 'old'])
    test('project navigation fixed destination ' + dest, async () => {
        let current = 'old', calls = 0;
        (globalThis as any).eda = { dmt_Project: { getCurrentProjectInfo: async () => ({ uuid: current }), getProjectInfo: async (id: string) => ({ uuid: id }), openProject: async () => { calls++; current = dest; return true; } } };
        const x = new ControlledExecutor(nativeAction, async () => ({ ...source, project_uuid: current }));
        const r = await x.execute(req('project.open', { project_uuid: 'new', expected_project_uuid: 'old', saved_current_project: true }), 'd');
        assert.equal(r.verification.verdict, dest === 'new' ? 'satisfied' : 'unavailable');
        assert.equal(calls, 1);
    });
test('navigation cannot rebind content mutation guard', async () => {
    let writes = 0;
    const x = new ControlledExecutor(() => ({ mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: () => { }, run: async (c) => { c.navigationTarget({ ...source, project_uuid: 'new' }); writes++; throw Error('unreachable'); } }), async () => source);
    const r = await x.execute(req('test', {}), 'd');
    assert.equal(r.effects.effect_started, false);
    assert.equal(writes, 0);
});
for (const valid of [true, false])
    test('project create returned UUID verified ' + valid, async () => {
        let writes = 0;
        (globalThis as any).eda = { dmt_Project: { getCurrentProjectInfo: async () => ({ uuid: 'old' }), createProject: async () => { writes++; return 'new'; }, getProjectInfo: async () => ({ uuid: valid ? 'new' : 'foreign', friendlyName: 'Name' }) } };
        const x = new ControlledExecutor(nativeAction, async () => source), request = req('project.create', { name: 'Name', expected_project_uuid: 'old', session_token: 'a', client_transaction_id: 'o' });
        const r = await x.execute(request, 'd');
        assert.equal(r.verification.verdict, valid ? 'satisfied' : 'unavailable');
        await x.reconcile('o');
        assert.equal(writes, 1);
    });
test('project create transaction alias mismatch refuses before native', async () => { let writes = 0; (globalThis as any).eda = { dmt_Project: { createProject: async () => writes++ } }; const x = new ControlledExecutor(nativeAction, async () => source); const r = await x.execute(req('project.create', { name: 'Name', expected_project_uuid: 'old', session_token: 'a', client_transaction_id: 'different' }), 'd'); assert.equal(r.effects.effect_started, false); assert.equal(writes, 0); });
