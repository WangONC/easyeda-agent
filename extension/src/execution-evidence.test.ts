/// <reference types="@jlceda/pro-api-types" />
import assert from 'node:assert/strict';
import contracts from './action-contracts.json';
import { runAction } from './actions';
import { previewFixtures } from './execution-preview-fixtures';
import { test } from 'node:test';
import { interpret } from './execution';
const properties = require('../../scripts/execution-evidence-properties.cjs');
test('R4 inventory-driven independent semantic oracle, metadata and idempotence', () => { properties.run(interpret); });

test('all contract-supported previews close over actual handler receipts and conflicting adapters', async () => {
 const rows=await previewFixtures();assert.equal(rows.length,Object.values(contracts).filter(c=>c.dry_run==='preview').length*2);
 properties.runCases(properties.previewCases(rows),interpret);
});
test('every unsupported dryRun is refused before native dispatch', async () => {
 for(const [action,c] of Object.entries(contracts))if(c.dry_run!=='preview') {
  await assert.rejects(runAction(action,{dryRun:true}), /Execution contract refused before native calls/);
  const e=interpret({action,payload:{dryRun:true}},{ok:false},true);assert.equal(e.possible_effect,false,action);
 }
});
