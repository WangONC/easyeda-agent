import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeAction, runAction } from './actions';
import catalog from './v2-catalog.generated.json';

test('every generated native action has a native handler; legacy dispatcher stays closed', async () => {
 const names=Object.keys(catalog);
 assert.equal(names.length,147);
 for(const name of names){
  if(name==='system.health')continue; // daemon local
  assert.equal(nativeAction(name)?.mode,'V2_NATIVE',name);
  await assert.rejects(runAction(name,{}),{code:'V2_ACTION_NOT_MIGRATED'});
 }
 for(const name of ['debug.exec_js','pcb.beautify','pcb.import_changes','pcb.import_autoroute','pcb.clear_routing','schematic.rebind.symbol','schematic.rebind.footprint']){
  assert.equal(nativeAction(name),undefined);
  await assert.rejects(runAction(name,{}),{code:'V2_ACTION_NOT_MIGRATED'});
 }
});
