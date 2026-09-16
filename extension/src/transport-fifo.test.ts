/// <reference types="@jlceda/pro-api-types" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {observed, type NativeAction} from './execution-v2';
import catalog from './v2-catalog.generated.json';
type Frame={type:string;windowId?:string;transportId?:string;activationId?:string;result?:{operation_id:string;effects:{reconciled:boolean};verification:{verdict:string}};error?:{code:string}};
const sent:Frame[]=[];let onMessage:((event:{data:string})=>void)|undefined;let writes=0,legacyCalls=0;let nativeGate:Promise<void>|undefined;let freshReads=0;
(globalThis as Record<string,unknown>).EDMT_EditorDocumentType={HOME:0,PCB:3};
(globalThis as Record<string,unknown>).eda={
 sys_WebSocket:{register(_id:string,_url:string,receive:(event:{data:string})=>void){onMessage=receive;},send(_id:string,data:string){sent.push(JSON.parse(data));},close(){}},
 sys_Message:{showToastMessage(){}},sys_I18n:{text:(s:string)=>s},sys_Log:{add(){}},sys_Storage:{getExtensionUserConfig:()=>true},sys_Environment:{getEditorCurrentVersion:()=> '3.2.175-test'},
 dmt_Project:{getCurrentProjectInfo:async()=>({uuid:'p'})},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'d',documentType:3,tabId:'t',parentProjectUuid:'p'})}
};
const actions=require('./actions') as {nativeAction:(name:string)=>NativeAction|undefined;runAction:()=>Promise<unknown>};
actions.runAction=async()=>{legacyCalls++;return {ok:true};};
actions.nativeAction=(name:string)=>name==='document.current'?{mode:'V2_NATIVE',scope:'NONE',validate:()=>{},run:async()=>observed({uuid:'d'},['fresh_document'],false)}:{mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{
 c.prepare(async()=>{freshReads++;return observed({x:1},['fresh_x'],true);});
 await c.effect(async()=>{writes++;await (nativeGate??new Promise(r=>setTimeout(r,60)));});return c.verify();
}};
const transport=require('./transport') as {reconnect:()=>void;stop:(toast?:boolean)=>void};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(predicate:()=>boolean){for(let n=0;n<200&&!predicate();n++)await sleep(5);assert.ok(predicate(),'condition not reached');}
test('real transport preserves pending ownership through FIFO deadline and never enters legacy dispatch',async()=>{
 transport.reconnect();try{
  await until(()=>!!onMessage);const receive=(value:unknown)=>onMessage!({data:JSON.stringify(value)});
  receive({type:'handshake',service:'easyeda-agent'});await until(()=>sent.some(f=>f.type==='register'));
  const registration=sent.find(f=>f.type==='register')!;const id=registration.windowId!;
  const target_ref={scope:'DOCUMENT',session:registration.transportId!,activation:registration.activationId,project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
  const submit=(action:'pcb.component.modify'|'document.current',operation_id:string,budget_ms:number)=>{
   const spec=catalog[action];receive({type:'v2_request',digest:operation_id,deadline_unix_ms:Date.now()+budget_ms,request:{protocol:'execution.v2',action,action_revision:spec.revision,schema:spec.schema,request_id:operation_id,operation_id,target_ref,input:{},budget_ms}});
  };
  submit('pcb.component.modify','write',20);await until(()=>writes===1);
  submit('document.current','diagnostic',500);await until(()=>sent.some(f=>f.result?.operation_id==='diagnostic'));
  assert.ok(!sent.some(f=>f.result?.operation_id==='write'),'diagnostic must bypass the pending native');
  submit('pcb.component.modify','blocked',500);await sleep(10);assert.equal(writes,1);
  await until(()=>sent.some(f=>f.result?.operation_id==='write'));
  const proof=sent.find(f=>f.result?.operation_id==='write')!.result!;assert.equal(proof.effects.reconciled,true);
  submit('pcb.component.modify','still-blocked',500);await sleep(10);assert.equal(writes,1,'Connector must wait for daemon finalizer authority');
  receive({type:'v2_release',operation_id:'write',digest:'write'});
  submit('pcb.component.modify','next-authorized',500);await until(()=>writes===2);
  receive({type:'request',id:'legacy',action:'debug.exec_js',payload:{code:'anything'}});await sleep(5);
  assert.equal(legacyCalls,0);assert.ok(sent.some(f=>f.error?.code==='V2_ACTION_NOT_MIGRATED'));
  await until(()=>sent.some(f=>f.result?.operation_id==='next-authorized'));
  receive({type:'v2_release',operation_id:'next-authorized',digest:'next-authorized'});
 }finally{transport.stop(false);}
});

test('same physical window reconnect retains pending native ownership, rejects old transport requests, and reconciles without replay',async()=>{
 const connect=async()=>{const previous=onMessage;const before=sent.filter(f=>f.type==='register').length;transport.reconnect();await until(()=>onMessage!==previous);onMessage!({data:JSON.stringify({type:'handshake',service:'easyeda-agent'})});await until(()=>sent.filter(f=>f.type==='register').length>before);return sent.filter(f=>f.type==='register').at(-1)!;};
 const receive=(v:unknown)=>onMessage!({data:JSON.stringify(v)});
 let settle!:()=>void;nativeGate=new Promise(r=>{settle=r;});
 const initialWrites=writes;
 try {
  const first=await connect();
  const submit=(registration:Frame,id:string)=>{const spec=catalog['pcb.component.modify'];receive({type:'v2_request',digest:id,deadline_unix_ms:Date.now()+1000,request:{protocol:'execution.v2',action:'pcb.component.modify',action_revision:spec.revision,schema:spec.schema,request_id:id,operation_id:id,target_ref:{scope:'DOCUMENT',session:registration.transportId,activation:registration.activationId,project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'},input:{},budget_ms:1000}});};
  submit(first,'reconnect-owner');await until(()=>writes===initialWrites+1);
  const second=await connect();assert.equal(second.windowId,first.windowId);assert.equal(second.activationId,first.activationId);assert.notEqual(second.transportId,first.transportId);
  submit(first,'stale-transport');submit(second,'owner-blocked');await sleep(10);assert.equal(writes,initialWrites+1);
  settle();await until(()=>sent.some(f=>f.result?.operation_id==='reconnect-owner'));
  const reads=freshReads;receive({type:'v2_reconcile',operation_id:'reconnect-owner'});await until(()=>freshReads>reads);assert.equal(writes,initialWrites+1);
  submit(second,'settled-still-owned');await sleep(10);assert.equal(writes,initialWrites+1);
  receive({type:'v2_release',operation_id:'reconnect-owner',digest:'reconnect-owner'});
  submit(second,'reconnect-next');await until(()=>sent.some(f=>f.result?.operation_id==='reconnect-next'));assert.equal(writes,initialWrites+2);
  receive({type:'v2_release',operation_id:'reconnect-next',digest:'reconnect-next'});
 } finally {settle();nativeGate=undefined;transport.stop(false);}
});

test('daemon restart announcement reconnects in background with stable logical and activation identity',async()=>{
 const connect=async()=>{const previous=onMessage;const before=sent.filter(f=>f.type==='register').length;transport.reconnect();await until(()=>onMessage!==previous);onMessage!({data:JSON.stringify({type:'handshake',service:'easyeda-agent'})});await until(()=>sent.filter(f=>f.type==='register').length>before);return sent.filter(f=>f.type==='register').at(-1)!;};
 try{
  const first=await connect();
  const oldReceive=onMessage!;
  oldReceive({data:JSON.stringify({type:'daemon_restarting',retry_after_ms:500})});
  await until(()=>onMessage!==oldReceive);
  onMessage!({data:JSON.stringify({type:'handshake',service:'easyeda-agent'})});
  await until(()=>sent.filter(f=>f.type==='register').some(f=>f.transportId!==first.transportId&&f.windowId===first.windowId&&f.activationId===first.activationId));
  const second=sent.filter(f=>f.type==='register').at(-1)!;
  assert.equal(second.windowId,first.windowId);
  assert.equal(second.activationId,first.activationId);
  assert.notEqual(second.transportId,first.transportId);
 }finally{transport.stop(false);}
});
