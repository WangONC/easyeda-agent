import test from 'node:test';
import assert from 'node:assert/strict';
import {ControlledExecutor,V2,type Request,type NativeAction} from './execution-v2';
import {deviceSetModel,titleBlockModify,differential,viewport,selectSchematic} from './v2-native-actions';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'schematic',tab_id:'t'};
for(const kind of ['device-model','titleblock','pair','viewport','selection'] as const)for(const mode of ['success','readback-failure','wrong-target','late-settle'] as const)test(`verified template ${kind}: ${mode}`,async()=>{
 let writes=0,settle!:()=>void;
 const wait=new Promise<void>(resolve=>{settle=resolve;});
 const write=async(fn:()=>void)=>{writes++;if(mode==='late-settle')await wait;if(mode!=='readback-failure')fn();};
 let action:NativeAction,input:Record<string,unknown>,host:unknown,binding:Request['target_ref']=target;
 if(kind==='device-model'){
  let device={uuid:'id',name:'part',association:{model3D:{uuid:'old',libraryUuid:'lib'} as unknown}};
  action=deviceSetModel;input={uuid:'id',expectedName:'part',clear:true};binding={scope:'LIBRARY',session:'s',activation:'a',library_uuid:'lib'};
  host={lib_Device:{get:async()=>structuredClone(device),modify:async()=>{await write(()=>{device.association.model3D=null;});return true;}}};
 }else if(kind==='titleblock'){
  let page={uuid:'d',showTitleBlock:true,titleBlockData:{Title:{value:'old'}}};action=titleBlockModify;input={titleBlockData:{Title:{value:'new'}}};
  host={dmt_Schematic:{getSchematicPageInfo:async()=>structuredClone(page),modifySchematicPageTitleBlock:async()=>{await write(()=>{page.titleBlockData.Title.value='new';});return true;}}};
 }else if(kind==='pair'){
  let pairs:unknown[]=[];action=differential('create');input={name:'pair',positiveNet:'P',negativeNet:'N'};
  host={pcb_Net:{getAllNetsName:async()=>['P','N']},pcb_Drc:{getAllDifferentialPairs:async()=>pairs,createDifferentialPair:async()=>{await write(()=>{pairs=[{name:'pair',positiveNet:'P',negativeNet:'N'}];});return true;}}};
 }else if(kind==='viewport'){
  action=viewport('fit');input={};host={dmt_EditorControl:{zoomToAllPrimitives:async()=>{await write(()=>{});return mode==='readback-failure'?{}:{left:0,right:10,top:10,bottom:0};}}};
 }else{
  let selected:string[]=[];action=selectSchematic;input={primitiveIds:'one'};host={sch_SelectControl:{getAllSelectedPrimitives_PrimitiveId:async()=>selected,doSelectPrimitives:async()=>{await write(()=>{selected=['one'];});}}};
 }
 (globalThis as unknown as {eda:unknown}).eda=host;
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:binding,input,budget_ms:mode==='late-settle'?10:10000};
 const executor=new ControlledExecutor(()=>action,async()=>mode==='wrong-target'?{...binding,activation:'foreign'}:binding);
 const pending=executor.execute(request,'digest');
 if(mode==='late-settle'){await new Promise(resolve=>setTimeout(resolve,25));await assert.rejects(executor.execute({...request,operation_id:'second'},'second'),/BARRIER/);settle();}
 const result=await pending;
 assert.equal(result.verification.verdict==='satisfied',mode==='success'||mode==='late-settle');assert.equal(writes,mode==='wrong-target'?0:1);
});
test('unknown titleblock field is ignored regardless of its unused value shape',async()=>{
 (globalThis as unknown as {eda:unknown}).eda={dmt_Schematic:{getSchematicPageInfo:async()=>({uuid:'d',showTitleBlock:true,titleBlockData:{Title:{value:'old'}}})}};
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{titleBlockData:{Unknown:123}},budget_ms:1000};
 const result=await new ControlledExecutor(()=>titleBlockModify,async()=>target).execute(request,'digest');
 assert.equal(result.verification.verdict,'satisfied');assert.equal(result.effects.effect_started,false);
});
