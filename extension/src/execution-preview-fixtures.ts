/// <reference types="@jlceda/pro-api-types" />
import assert from 'node:assert/strict';
import contracts from './action-contracts.json';
import { runAction } from './actions';
// Actual handler receipts, with no live Host. Unknown native methods fail the test.
export async function previewFixtures() {
 const rows = [];
 const line=(i:number)=>({getState_PrimitiveId:()=> 'line'+i,getState_ComponentType:()=> 'component',getState_PrimitiveLock:()=>false,getState_Net:()=> 'N',getState_Layer:()=>1,getState_StartX:()=>i?100:0,getState_StartY:()=>0,getState_EndX:()=>100,getState_EndY:()=>i?100:0,getState_LineWidth:()=>10});
 for(const [action,c] of Object.entries(contracts))if(c.dry_run==='preview')for(const populated of [false,true]) {
  const calls:string[]=[];
  (globalThis as any).eda=new Proxy({}, {get:(_target,api:string)=>new Proxy({}, {get:(_obj,method:string)=>async()=>{
   calls.push(api+'.'+method);
   assert.ok(method.startsWith('get'), 'preview attempted native write: '+api+'.'+method);
   if(method==='getAllSelectedPrimitives_PrimitiveId')return populated?['line0','line1']:[];
   if(method==='getAll')return populated && ['pcb_PrimitiveLine','sch_PrimitiveComponent'].includes(api)?[line(0),line(1)]:[];
   return undefined;
  }})});
  try {const result=await runAction(action,{dryRun:true});
   assert.equal(result.result?.write_attempted,false,action);assert.equal(result.result?.native_settled,true,action);
   assert.ok(calls.length>0,action);assert.ok(calls.every(x=>x.split('.')[1].startsWith('get')),action);
   rows.push({name:'actual-preview:'+action+':'+populated,request:{id:'r',action,payload:{dryRun:true}},response:{id:'r',ok:true,...result},semantic:{proof:true}});
  }finally{delete (globalThis as any).eda;}
 }
 return rows;
}
