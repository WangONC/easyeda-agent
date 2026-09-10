import { retained } from './retained-business.test-support';
/// <reference types="@jlceda/pro-api-types" />
import test from 'node:test';
import assert from 'node:assert/strict';
import {schematicComponentPlace,schematicComponentsList} from './actions';
import {SOURCE_KEY,sourceReceipt} from './component-source';
const old='a'.repeat(32),next='b'.repeat(32),lib='LIB';
let hostNumber=0;
function host(mode='ok'){
 const project='p'+(++hostNumber);
 const devices:any={};for(const id of [old,next])devices[id]={uuid:id,libraryUuid:lib,name:id,association:{symbol:{uuid:'c'.repeat(32),libraryUuid:lib},footprint:{uuid:'d'.repeat(32),libraryUuid:lib}},subPartNames:['part.1']};
 const storage=new Map<string,any>();const rows=new Map<string,any>();const calls:string[]=[];let seq=0,failed=false;
 const primitive=(s:any):any=>new Proxy({}, {get:(_,key)=>typeof key==='string'&&key.startsWith('getState_')?()=>s[key.slice(9)]:undefined});
 const api:any={
 sys_Storage:{getExtensionUserConfig:(k:string)=>storage.get(k),setExtensionUserConfig:async(k:string,v:unknown)=>{storage.set(k,v);return true;}},
  sch_PrimitiveAttribute:{getAll:async(id:string)=>[{getState_Key:()=>SOURCE_KEY,getState_ParentPrimitiveId:()=>id,getState_PrimitiveId:()=>id+'-source'}],modify:async(id:string,p:any)=>{rows.get(id.replace('-source','')).OtherProperty[SOURCE_KEY]=p.value;return {}; }},
  dmt_Project:{getCurrentProjectInfo:async()=>({uuid:project})},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'page',documentType:1})},
  lib_Device:{get:async(id:string)=>devices[id]},
  sch_PrimitiveComponent:{
   create:async(dev:any,x:number,y:number)=>{calls.push('create:'+dev.uuid);if(mode==='unknown'&&dev.uuid===next)return undefined;
    const id='id'+(++seq),s:any={PrimitiveId:id,ComponentType:'part',Component:{uuid:dev.uuid.slice(0,16),libraryUuid:lib},Symbol:{uuid:'e'.repeat(16),libraryUuid:lib},Footprint:{uuid:'f'.repeat(16),libraryUuid:lib},SubPartName:'part.1',Designator:'R?',UniqueId:'',X:x,Y:y,Rotation:0,Mirror:false,OtherProperty:{},Name:'',SupplierId:''};rows.set(id,s);return primitive(s);},
   get:async(id:string)=>rows.has(id)?primitive(rows.get(id)):undefined,
   getAll:async()=>[...rows.values()].map(primitive),getAllPinsByPrimitiveId:async()=>[],
   modify:async(id:string,patch:any)=>{calls.push('modify:'+id);if(mode==='restore'&&!failed&&id==='id2'&&patch.designator==='R1'){failed=true;throw Error('injected restore failure');}const s=rows.get(id);for(const [k,v]of Object.entries(patch))s[k[0].toUpperCase()+k.slice(1)]=v;if(mode==='attribute'&&patch.otherProperty)s.OtherProperty[SOURCE_KEY]='';return primitive(s);},
   delete:async(id:string)=>{calls.push('delete:'+id);return rows.delete(id);}
  }
 };
 return {api,rows,calls,devices,storage};
}
for(const mode of ['ok','unknown','restore','attribute'])test('replace source closure '+mode,async()=>{
 const h=host(mode);(globalThis as any).eda=h.api;
 try{
  const placed:any=await schematicComponentPlace({uuid:old,libraryUuid:lib,x:1,y:2,designator:'R1'});assert.equal(placed.result.primitiveId,'id1');
  // Simulated save/reload retains only JSON-native persisted state.
  for(const [id,row]of h.rows)h.rows.set(id,JSON.parse(JSON.stringify(row)));
  const read:any=await schematicComponentsList({includeDeviceIdentity:true});assert.equal(read.result.components[0].device.uuid,old);
  h.calls.length=0;const r:any=await retained.schematicComponentReplace({primitiveId:'id1',deviceUuid:next,deviceLibraryUuid:lib});
  const beforeReplay=h.calls.length;const duplicate:any=await retained.schematicComponentReplace({primitiveId:'id1',deviceUuid:next,deviceLibraryUuid:lib});assert.equal(duplicate.result.duplicate,true);assert.equal(h.calls.length,beforeReplay);
  assert.equal(h.rows.size,1);assert.ok(h.calls.indexOf('create:'+next)<h.calls.indexOf('delete:id1')||!h.calls.includes('delete:id1'));
  const after:any=await schematicComponentsList({includeDeviceIdentity:true});
  assert.equal(after.result.components[0].device.uuid,(mode==='ok'||mode==='attribute')?next:old);
  if(mode==='ok'){assert.equal(r.result.status,'complete');assert.equal(after.result.components[0].designator,'R1');}
  if(mode==='unknown'){assert.equal(r.result.status,'uncertain');assert.equal(r.result.originalPreserved,true);assert.equal(h.calls.filter(c=>c.startsWith('create:')).length,1);}
  if(mode==='restore'){assert.equal(r.result.rollbackComplete,true);assert.equal(r.result.status,'partial');}
 }finally{delete (globalThis as any).eda;}
});
test('invalid saved identity refuses replacement before any create/delete',async()=>{
 const h=host();(globalThis as any).eda=h.api;try{
 await schematicComponentPlace({uuid:old,libraryUuid:lib,x:1,y:2});for(const key of h.storage.keys())h.storage.set(key,'{}');h.calls.length=0;
 await assert.rejects(()=>retained.schematicComponentReplace({primitiveId:'id1',deviceUuid:next,deviceLibraryUuid:lib}),/Cannot resolve/);assert.equal(h.calls.length,0);
 }finally{delete (globalThis as any).eda;}
});

test('in-flight duplicate cannot start a second native replacement',async()=>{
 const h=host();(globalThis as any).eda=h.api;try{
 await schematicComponentPlace({uuid:old,libraryUuid:lib,x:1,y:2});
 const native=h.api.sch_PrimitiveComponent.create;let release!:()=>void;let entered!:()=>void;
 const started=new Promise<void>(r=>entered=r);
 h.api.sch_PrimitiveComponent.create=async(...args:any[])=>{entered();await new Promise<void>(r=>release=r);return native(...args)};
 const payload={primitiveId:'id1',deviceUuid:next,deviceLibraryUuid:lib,client_transaction_id:'inflight'};
 const original=retained.schematicComponentReplace(payload);await started;
 const duplicate:any=await retained.schematicComponentReplace(payload);assert.equal(duplicate.result.status,'uncertain');assert.equal(duplicate.result.duplicate,true);
 release();assert.equal((await original).result?.status,'complete');assert.equal(h.rows.size,1);
 }finally{delete (globalThis as any).eda;}
});
test('failed persistent receipt write reports partial and never re-creates the placed component',async()=>{
 const h=host();h.api.sys_Storage.setExtensionUserConfig=async()=>false;(globalThis as any).eda=h.api;
 try{const r:any=await schematicComponentPlace({uuid:old,libraryUuid:lib,x:1,y:2});assert.equal(r.result.status,'partial');assert.equal(r.result.verified,false);assert.equal(h.rows.size,1);assert.equal(h.calls.filter(c=>c.startsWith('create:')).length,1);}finally{delete (globalThis as any).eda;}
});

// Model the real Host: create copies keys only; unrelated modify resets values.
function valueHost(fault = '') {
 const h = host();
 h.devices[old].property = { otherProperty: { Value: '3.3kΩ', Tolerance: '5%', Rating: 25 } };
 h.devices[next].property = { otherProperty: { Value: '22nF', Tolerance: '10%', Rating: 50 } };
 const create = h.api.sch_PrimitiveComponent.create;
 h.api.sch_PrimitiveComponent.create = async (...args: any[]) => {
  const c = await create(...args);
  const row = h.rows.get(c.getState_PrimitiveId());
  row.OtherProperty = { Value: '', Tolerance: '', Rating: '' };
  return c;
 };
 const modify = h.api.sch_PrimitiveComponent.modify;
 h.api.sch_PrimitiveComponent.modify = async (id: string, patch: any) => {
  const c = await modify(id, patch);
  const row = h.rows.get(id);
  if (!patch.otherProperty) row.OtherProperty = { Value: '', Tolerance: '', Rating: '' };
  if (id === 'id2' && (fault === 'stage' || (fault === 'final' && patch.designator === 'R1'))) {
   // A success-shaped modify return with a bad persisted value must not verify.
   row.OtherProperty = { ...row.OtherProperty, Value: '' };
  }
  return c;
 };
 return h;
}
for (const preserve of [false, true]) for (const oldValue of ['', '3.3kΩ']) {
 test(`replace projects target defaults; preserve=${preserve}, source=${oldValue}`, async () => {
  const h = valueHost(); (globalThis as any).eda = h.api;
  try {
   await schematicComponentPlace({uuid:old, libraryUuid:lib, x:1, y:2, designator:'R1'});
   h.rows.get('id1').OtherProperty.Value = oldValue;
   const r:any = await retained.schematicComponentReplace( {primitiveId:'id1', deviceUuid:next, deviceLibraryUuid:lib, keepProperties:preserve});
   assert.equal(r.result.status, 'complete'); assert.equal(r.result.verified, true);
   assert.equal(r.result.component.otherProperty.Value, preserve ? oldValue : '22nF');
   assert.equal(r.result.component.otherProperty.Tolerance, preserve ? '5%' : '10%');
   assert.equal(r.result.component.otherProperty.Rating, preserve ? 25 : 50);
  } finally { delete (globalThis as any).eda; }
 });
}
for (const fault of ['stage', 'final']) test(`replace rejects blank Value at ${fault} readback`, async () => {
 const h = valueHost(fault); (globalThis as any).eda = h.api;
 try {
  await schematicComponentPlace({uuid:old, libraryUuid:lib, x:1, y:2, designator:'R1'});
  h.calls.length=0;
  const payload={primitiveId:'id1', deviceUuid:next, deviceLibraryUuid:lib};
  const r:any=await retained.schematicComponentReplace( payload);
  assert.equal(r.result.verified,false); assert.equal(r.result.status,'partial');
  assert.match(r.result.reason,/Value readback mismatch/);
  assert.equal(h.rows.size,1);
  if(fault==='stage') {assert.equal(r.result.originalPreserved,true);assert.ok(h.rows.has('id1'));assert.ok(!h.calls.includes('delete:id1'));}
  const count=h.calls.length; const replay:any=await retained.schematicComponentReplace(payload);
  assert.equal(replay.result.duplicate,true);assert.equal(h.calls.length,count);
 } finally {delete (globalThis as any).eda;}
});
