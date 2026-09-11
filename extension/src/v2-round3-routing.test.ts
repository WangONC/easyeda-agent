import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { trackLock } from './v2-routing-actions';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
for(const mode of ['normal','missing','drift','partial'] as const) test('track lock scoped identity and bounded scans '+mode, async()=>{
 const states=new Map(Array.from({length:64},(_,i)=>[String(i),false]));let scans=0,gets=0,writes=0;
 const row=(id:string)=>({getState_PrimitiveId:()=>id,getState_Net:()=> 'N',getState_PrimitiveLock:()=>states.get(id)!,getState_Layer:()=>1,getState_StartX:()=>0,getState_StartY:()=>0,getState_EndX:()=>10,getState_EndY:()=>0,getState_LineWidth:()=>6,setState_PrimitiveLock:()=>{},done:async()=>{writes++;if(mode!=='partial'||Number(id)%2===0)states.set(id,true);}});
 (globalThis as any).eda={pcb_PrimitiveLine:{getAll:async()=>{scans++;return [...states.keys()].map(row);},get:async(id:string)=>{gets++;if(mode==='missing'&&id==='0')return undefined;return row(id);}},pcb_PrimitiveArc:{getAll:async()=>[]},pcb_PrimitiveVia:{getAll:async()=>[]},pcb_PrimitiveFill:{getAll:async()=>[]}};
 const request:Request={protocol:V2,action:'pcb.track.lock',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{all:true},budget_ms:1000};
 const ex=new ControlledExecutor(()=>trackLock,async()=>mode==='drift'?{...target,tab_id:'other'}:target);
 const result=await ex.execute(request,'digest');
 if(mode==='normal'||mode==='partial'){
  assert.equal(scans,2);assert.equal(gets,64);assert.equal(writes,64);
  assert.equal(result.verification.satisfied,mode==='normal'?64:32);
  assert.equal(result.verification.residual,mode==='normal'?0:32);
 }else{assert.equal(writes,0);assert.notEqual(result.verification.verdict,'satisfied');}
 const count=writes;await ex.execute(request,'digest');if(mode!=='drift')await ex.reconcile('o');assert.equal(writes,count);
});
