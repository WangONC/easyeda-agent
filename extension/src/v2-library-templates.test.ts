import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type NativeAction, type Request } from './execution-v2';
import { createLibraryAsset, assetDelete, copyLibraryAsset } from './v2-native-actions';
const target={scope:'LIBRARY' as const,session:'s',activation:'a',library_uuid:'lib'};
const modes=['success','readback-failure','wrong-target','late-settle'] as const;
type Mode=typeof modes[number];
async function exercise(action:NativeAction,input:Record<string,unknown>,mode:Mode,install:(write:()=>Promise<void>,applied:boolean)=>unknown){
 let writes=0,settle!:()=>void;
 const pendingNative=new Promise<void>(resolve=>{settle=resolve;});
 const write=async()=>{writes++;if(mode==='late-settle')await pendingNative;};
 (globalThis as unknown as {eda:unknown}).eda=install(write,mode!=='readback-failure');
 const executor=new ControlledExecutor(()=>action,async()=>mode==='wrong-target'?{...target,library_uuid:'foreign'}:target);
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input,budget_ms:mode==='late-settle'?10:1000};
 const pending=executor.execute(request,'digest');
 if(mode==='late-settle'){
  await new Promise(resolve=>setTimeout(resolve,25));
  await assert.rejects(executor.execute({...request,operation_id:'second'},'second'),/BARRIER/);
  settle();
 }
 const result=await pending;
 assert.equal(result.verification.verdict==='satisfied',mode==='success'||mode==='late-settle');
 assert.equal(writes,mode==='wrong-target'?0:1);
 if(mode==='late-settle')assert.equal(result.effects.reconciled,true);
}
for(const kind of ['symbol','footprint','device'] as const)for(const mode of modes)test(`library create ${kind}: ${mode}`,()=>{
 const input:Record<string,unknown>={name:'part',classification:['Parts'],description:'description'};
 if(kind==='device'){input.symbol={uuid:'s',libraryUuid:'source'};input.property={designator:'U'};}
 return exercise(createLibraryAsset(kind),input,mode,(write,applied)=>{
  let asset:unknown;
  const api={create:async(_lib:string,name:string,classification:unknown,associationOrType:unknown,description?:string,property?:unknown)=>{
   await write();if(applied)asset={uuid:'new',name,classification,description:kind==='footprint'?associationOrType:description,...(kind==='device'?{association:associationOrType,property}:{})};return 'new';
  },get:async()=>asset};
  return {[kind==='symbol'?'lib_Symbol':kind==='footprint'?'lib_Footprint':'lib_Device']:api};
 });
});
for(const kind of ['footprint','device','model3d'] as const)for(const mode of modes)test(`library delete ${kind}: ${mode}`,()=>exercise(assetDelete(kind),{uuid:'id',expectedName:'part'},mode,(write,applied)=>{
 let asset:unknown={uuid:'id',name:'part'};
 const api={get:async()=>asset,delete:async()=>{await write();if(applied)asset=undefined;return true;}};
 return {[kind==='footprint'?'lib_Footprint':kind==='device'?'lib_Device':'lib_3DModel']:api};
}));
for(const kind of ['footprint','model3d'] as const)for(const mode of modes)test(`library copy ${kind}: ${mode}`,()=>exercise(copyLibraryAsset(kind),{uuid:'source-id',sourceLibraryUuid:'source',name:'copy',classification:['Parts']},mode,(write,applied)=>{
 let copied:unknown;
 const api={get:async(id:string)=>id==='source-id'?{uuid:id,libraryUuid:'source',name:'original'}:copied,copy:async(_id:string,_source:string,lib:string,classification:unknown,name:string)=>{
  await write();if(applied)copied={uuid:'copy-id',libraryUuid:lib,name,classification};return 'copy-id';
 }};
 return {[kind==='footprint'?'lib_Footprint':'lib_3DModel']:api};
}));
