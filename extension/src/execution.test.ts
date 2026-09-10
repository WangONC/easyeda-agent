import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret, validateContract } from './execution';
import { runAction } from './actions';
const cases = JSON.parse(readFileSync('../internal/protocol/testdata/execution.json', 'utf8'));
for (const c of cases)
    test('contract fixture: ' + c.name, () => { const before = JSON.stringify(c.response); const got = interpret(c.request, c.response, c.before); assert.equal(got.mutation_outcome || '', c.want_outcome); assert.equal(got.request_satisfied, c.want_satisfied); assert.equal(JSON.stringify(c.response), before); });
test('unsupported previews cause zero native calls', async () => {
    let calls = 0;
    Object.defineProperty(globalThis, 'eda', { configurable: true, get() { calls++; throw Error('native access'); } });
    try {
        for (const action of ['pcb.line.create', 'pcb.via.create', 'route.apply_batch'])
            await assert.rejects(runAction(action, { dryRun: true }), { code: 'INVALID_DRY_RUN' });
        assert.equal(calls, 0);
    }
    finally {
        delete (globalThis as any).eda;
    }
});
test('executor and hash fail closed', () => { assert.equal(validateContract({ action: 'pcb.plane.refresh' }), 'EXECUTOR_UNAVAILABLE'); assert.equal(validateContract({ action: 'pcb.line.create', contractHash: 'old' }), 'CONTRACT_MISMATCH'); });
