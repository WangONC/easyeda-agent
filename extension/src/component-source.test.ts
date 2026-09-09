import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_KEY,sourceReceipt,resolveSource,sourceAsset} from './component-source';
const device={uuid:'a'.repeat(32),libraryUuid:'lib',association:{symbol:{uuid:'b'.repeat(32),libraryUuid:'lib'},footprint:{uuid:'c'.repeat(32),libraryUuid:'lib'}},subPartNames:['R.1']};
const snapshot={component:{uuid:'d'.repeat(16),libraryUuid:'lib'},symbol:{uuid:'e'.repeat(16),libraryUuid:'lib'},footprint:{uuid:'f'.repeat(16),libraryUuid:'lib'},subPartName:'R.1',otherProperty:{} as Record<string,unknown>};
test('source identity survives save/reload JSON and instance UUID remains distinct',async()=>{
 const s=structuredClone(snapshot);s.otherProperty[SOURCE_KEY]=sourceReceipt(s,device);
 const reloaded=JSON.parse(JSON.stringify(s));const r=await resolveSource(reloaded,async()=>device);
 assert.equal(r?.uuid,device.uuid);assert.notEqual(r?.uuid,reloaded.component.uuid);
});
test('unknown/16-character library source is refused',()=>{assert.throws(()=>sourceAsset({...device,uuid:'a'.repeat(16)}));});
test('changed instance or library association fails closed',async()=>{
 const s=structuredClone(snapshot);s.otherProperty[SOURCE_KEY]=sourceReceipt(s,device);
 await assert.rejects(()=>resolveSource({...s,symbol:{uuid:'x',libraryUuid:'lib'}},async()=>device),/binding/);
 await assert.rejects(()=>resolveSource(s,async()=>({...device,association:{...device.association,footprint:{uuid:'9'.repeat(32),libraryUuid:'lib'}}})),/changed/);
});
test('missing source does not invent identity; malformed source does not fall back',async()=>{
 assert.equal(await resolveSource(snapshot,async()=>{throw Error('not called')}),undefined);
 await assert.rejects(()=>resolveSource({...snapshot,otherProperty:{[SOURCE_KEY]:'{}'}},async()=>device));
});
