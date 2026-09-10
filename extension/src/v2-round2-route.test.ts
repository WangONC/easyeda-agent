import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { routeBatch } from './v2-route-batch';
import { fastPath, type NativePort, type Primitive, type Operation } from './fast-path';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
const ops: Operation[] = [0, 1, 2].map(i => ({ type: 'add_trace', net: 'N', layer: 1, width: 6, points: [[i * 10, 0], [i * 10 + 5, 0]] }));
async function setup(mode: 'normal' | 'wrong' | 'missing' | 'late' = 'normal') {
    let traces: Primitive[] = [], calls = 0, release!: () => void;
    const port: NativePort = { calls: 0, context: async () => ({ projectUuid: 'p', documentUuid: 'd', documentType: 'pcb', tabId: 't' }), read: async () => ({ components: [], pads: [], traces: [...traces].reverse(), vias: [], fills: [], copper_layers: [1, 2] }), create: async (op) => { calls++; if (mode === 'late')
            await new Promise<void>(r => release = r); const id = 'created' + calls; traces.push({ id, kind: 'trace', net: op.net, layer: op.layer, width: mode === 'wrong' ? 99 : op.width, points: op.points }); return mode === 'missing' ? undefined : id; }, remove: async (_, id) => { traces = traces.filter(p => p.id !== id); return true; } };
    const base = (await fastPath.snapshotData(port, { project_uuid: 'p', document_uuid: 'd' })).data.board_revision;
    const req: Request = { protocol: V2, action: 'route.apply_batch', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'op', target_ref: target, input: { client_transaction_id: 'op', base_revision: base, plan_hash: 'plan', operations: ops }, budget_ms: 1000 };
    const x = new ControlledExecutor(() => routeBatch(() => port), async () => target);
    return { x, req, count: () => calls, release: () => release() };
}
for (const mode of ['normal', 'wrong', 'missing'] as const)
    test('V2 Fast explicit geometry ' + mode, async () => {
        const h = await setup(mode), r = await h.x.execute(h.req, 'digest');
        assert.equal(r.verification.verdict, mode === 'normal' ? 'satisfied' : mode === 'wrong' ? 'partial' : 'unavailable');
        const count = h.count();
        await h.x.execute(h.req, 'digest');
        await h.x.reconcile('op');
        assert.equal(h.count(), count);
    });
test('V2 Fast deadline late settle does not start second item or replay', async () => {
    const h = await setup('late');
    h.req.budget_ms = 10;
    const pending = h.x.execute(h.req, 'd');
    await new Promise(r => setTimeout(r, 30));
    await assert.rejects(h.x.execute({ ...h.req, operation_id: 'second' }, 'other'), /BARRIER/);
    h.release();
    const r = await pending;
    assert.equal(h.count(), 1);
    assert.equal(r.effects.reconciled, true);
    assert.equal(r.verification.verdict, 'partial');
    await h.x.reconcile('op');
    assert.equal(h.count(), 1);
});
test('V2 Fast foreign transaction and target rejected without write', async () => {
    const h = await setup();
    h.req.input.client_transaction_id = 'foreign';
    const r = await h.x.execute(h.req, 'd');
    assert.equal(r.effects.effect_started, false);
    assert.equal(h.count(), 0);
});
