import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { nativeAction } from './actions';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
const req = (action: string, input: Record<string, unknown>, id = 'o'): Request => ({ protocol: V2, action, action_revision: '1', schema: 'test', request_id: 'r', operation_id: id, target_ref: target, input, budget_ms: 1000 });
function host(kind: string, remove: number) { let state = ['a', 'b', 'c']; let calls = 0; const port = { getAll: async () => state.map(id => ({ getState_PrimitiveId: () => id })), delete: async (ids: string | string[]) => { calls++; const list = typeof ids === 'string' ? [ids] : ids; state = state.filter(id => !list.slice(0, remove).includes(id)); return remove >= list.length; } }; (globalThis as any).eda = { [`pcb_Primitive${kind}`]: port }; return { port, count: () => calls }; }
for (const [kind, name] of [['Component', 'component'], ['Fill', 'fill'], ['Region', 'region'], ['Pour', 'pour']]) {
    for (const n of [0, 1, 2, 3])
        test(`${name} delete ${n}/3 coverage`, async () => { const h = host(kind, n), x = new ControlledExecutor(nativeAction, async () => target), r = req(`pcb.${name}.delete`, { primitiveIds: ['a', 'b', 'c'] }); const result = await x.execute(r, 'digest'); assert.equal(result.verification.satisfied, n); assert.equal(result.verification.residual, 3 - n); assert.equal(result.effects.state_changed, n > 0); await x.execute(r, 'digest'); assert.equal(h.count(), 1); });
    test(`${name} delete scalar, missing id no-op, malformed inventory`, async () => { const h = host(kind, 3); let x = new ControlledExecutor(nativeAction, async () => target); assert.equal((await x.execute(req(`pcb.${name}.delete`, { primitiveIds: 'missing' }), 'd')).verification.verdict, 'satisfied'); assert.equal(h.count(), 0); h.port.getAll = async () => undefined as any; x = new ControlledExecutor(nativeAction, async () => target); assert.equal((await x.execute(req(`pcb.${name}.delete`, { primitiveIds: 'a' }), 'd')).effects.effect_started, false); });
    test(`${name} delete wrong target refuses before effect`, async () => { const h = host(kind, 3); const x = new ControlledExecutor(nativeAction, async () => ({ ...target, document_uuid: 'foreign' })); const r = await x.execute(req(`pcb.${name}.delete`, { primitiveIds: 'a' }), 'd'); assert.equal(r.effects.effect_started, false); assert.equal(h.count(), 0); });
    test(`${name} late deletion readback never replays`, async () => { const h = host(kind, 3); let done!: () => void; const original = h.port.delete; h.port.delete = async (ids) => { await new Promise<void>(r => done = r); return original(ids); }; const x = new ControlledExecutor(nativeAction, async () => target); const request = req(`pcb.${name}.delete`, { primitiveIds: 'a' }); request.budget_ms = 5; const p = x.execute(request, 'd'); await new Promise(r => setTimeout(r, 20)); await assert.rejects(x.execute(req(`pcb.${name}.delete`, { primitiveIds: 'b' }, 'second'), 'e'), /BARRIER/); done(); const r = await p; assert.equal(r.effects.reconciled, true); assert.equal(r.verification.verdict, 'satisfied'); await x.reconcile('o'); assert.equal(h.count(), 1); });
}
for (const landed of [false, true])
    test('component lock fresh readback ' + landed, async () => {
        const state = new Map([['a', false], ['b', true]]);
        let count = 0;
        (globalThis as any).eda = { pcb_PrimitiveComponent: { get: async (ids: string[]) => ids.filter(id => state.has(id)).map(id => ({ getState_PrimitiveId: () => id, getState_PrimitiveLock: () => state.get(id), setState_PrimitiveLock: () => { }, done: async () => { count++; if (landed)
                        state.set(id, true); } })) } };
        const x = new ControlledExecutor(nativeAction, async () => target), r = await x.execute(req('pcb.component.lock', { primitiveIds: ['a', 'b', 'a'] }), 'd');
        assert.equal(r.verification.satisfied, landed ? 2 : 1);
        assert.equal(count, 1);
        await x.reconcile('o');
        assert.equal(count, 1);
    });
