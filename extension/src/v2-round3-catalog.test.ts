import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from './v2-catalog.generated.json';
import {nativeAction} from './actions';
test('all 143 Connector-native validators reject foreign parameter without Host access',()=>{
 let hostAccess=0;
 (globalThis as any).eda=new Proxy({}, {get(){hostAccess++;throw Error('validation accessed Host');}});
 let checked=0;
 for(const action of Object.keys(catalog)){
  if(action==='system.health')continue;
  const handler=nativeAction(action);assert.ok(handler,action);
  assert.throws(()=>handler.validate({__foreign_parameter:true}),action);checked++;
 }
 assert.equal(checked,143);assert.equal(hostAccess,0);
});
