import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeAction, runAction } from './actions';
import catalog from './v2-catalog.generated.json';

test('every generated native action has a native handler; legacy dispatcher stays closed', async () => {
 const names=Object.keys(catalog);
 assert.equal(names.length,81);
 for(const name of names){
  if(name==='system.health')continue; // daemon local
  assert.equal(nativeAction(name)?.mode,'V2_NATIVE',name);
  await assert.rejects(runAction(name,{}),{code:'V2_ACTION_NOT_MIGRATED'});
 }
 for(const name of ['route.apply_batch','debug.exec_js','schematic.component.replace']){
  assert.equal(nativeAction(name),undefined);
  await assert.rejects(runAction(name,{}),{code:'V2_ACTION_NOT_MIGRATED'});
 }
});
