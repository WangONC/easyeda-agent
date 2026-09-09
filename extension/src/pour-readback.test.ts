import test from 'node:test';
import assert from 'node:assert/strict';
import { readPourGeometry } from './pour-readback';

function fixture(sources: unknown[], failure = false) {
 let calls = 0;
 (globalThis as unknown as { eda: unknown }).eda = { pcb_PrimitivePoured: { getAll: async () => {
  calls++; if (failure) throw new Error('Host unavailable');
  return [{ getState_PourPrimitiveId: () => 'p', getState_PrimitiveId: () => 'filled-new-id',
   getState_PourFills: () => sources.map((source, i) => ({ id: `f${i}`, fill: true, lineWidth: 0, path: { getSource: () => source } })) }];
 } } };
 return { pours: [{ getState_PrimitiveId: () => 'p' }] as IPCB_PrimitivePour[], calls: () => calls };
}
test('native filled polygon including holes is preserved without claiming freshness', async () => {
 const source = [[0,0,'L',100,0,100,100,0,100],['CIRCLE',50,50,10]];
 const f = fixture([source]); const r = await readPourGeometry(f.pours, 16);
 assert.equal(r.complete, true); assert.equal(r.status, 'observed');
 assert.equal(r.freshness, 'unverified'); assert.equal(r.connectivity, 'unknown');
 assert.deepEqual(r.fills[0].source, source); assert.equal(f.calls(), 1);
});
test('count and byte budgets report incomplete instead of hiding omitted copper', async () => {
 let f = fixture([[0,0,'L',1,1],[2,2,'L',3,3]]);
 let r = await readPourGeometry(f.pours, 1);
 assert.equal(r.complete, false); assert.equal(r.omitted, 1); assert.equal(r.fills.length, 1);
 f = fixture([Array(100000).fill(12345)]); r = await readPourGeometry(f.pours, 16);
 assert.equal(r.complete, false); assert.equal(r.fills.length, 0); assert.equal(r.omitted, 1);
});
test('missing parent fill and unavailable API remain explicit', async () => {
 const f = fixture([]); f.pours.push({ getState_PrimitiveId: () => 'missing' } as IPCB_PrimitivePour);
 const r = await readPourGeometry(f.pours, 16);
 assert.equal(r.complete, false); assert.deepEqual(r.missing_pour_ids, ['missing']);
 const bad = fixture([], true); const failed = await readPourGeometry(bad.pours, 16);
 assert.equal(failed.status, 'unavailable'); assert.equal(failed.complete, false);
});
test('invalid limit rejected before a Host read', async () => {
 const f = fixture([]);
 for (const n of [0,65,1.5,NaN]) await assert.rejects(readPourGeometry(f.pours,n), /geometry_limit/);
 assert.equal(f.calls(), 0);
});
