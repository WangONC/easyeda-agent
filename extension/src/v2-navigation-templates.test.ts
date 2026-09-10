import test from 'node:test';
import assert from 'node:assert/strict';
import {ControlledExecutor,V2,type Request} from './execution-v2';
import {documentOpen,pageCreate,pageDelete,schematicRename,selectSchematic} from './v2-native-actions';
const target={scope:'PROJECT' as const,session:'s',activation:'a',project_uuid:'p'};
for(const kind of ['open','page-create','page-delete','rename'] as const)for(const mode of ['success','readback-failure','wrong-target','late-settle'] as const)test(`navigation/topology ${kind}: ${mode}`,async()=>{
 let pages=[{uuid:'page',name:'old',parentSchematicUuid:'schematic'}],current={uuid:'old',tabId:'old-tab',documentType:3},writes=0,settle!:()=>void;
 const wait=new Promise<void>(resolve=>{settle=resolve;});
 const change=async(fn:()=>void)=>{writes++;if(mode==='late-settle')await wait;if(mode!=='readback-failure')fn();};
 (globalThis as unknown as {eda:unknown}).eda={
  dmt_Pcb:{getAllPcbsInfo:async()=>[{uuid:'dest'}]},
  dmt_SelectControl:{getCurrentDocumentInfo:async()=>({...current})},
  dmt_EditorControl:{openDocument:async()=>{await change(()=>{current={uuid:'dest',tabId:'dest-tab',documentType:3};});return 'dest-tab';}},
  dmt_Schematic:{getAllSchematicPagesInfo:async()=>structuredClone(pages),getAllSchematicsInfo:async()=>[{uuid:'schematic',name:pages[0]?.name}],
   createSchematicPage:async()=>{await change(()=>{pages.push({uuid:'new-page',name:'new',parentSchematicUuid:'schematic'});});return 'new-page';},
   getSchematicPageInfo:async(id:string)=>structuredClone(pages.find(p=>p.uuid===id)),
   deleteSchematicPage:async()=>{await change(()=>{pages=[];});return true;},
   modifySchematicName:async()=>{await change(()=>{pages[0].name='new';});return true;},
  }
 };
 const action=kind==='open'?documentOpen:kind==='page-create'?pageCreate:kind==='page-delete'?pageDelete:schematicRename(false);
 const input=kind==='open'?{uuid:'dest'}:kind==='page-create'?{schematicUuid:'schematic'}:kind==='page-delete'?{pageUuid:'page'}:{schematicUuid:'schematic',name:'new'};
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input,budget_ms:mode==='late-settle'?10:1000};
 const executor=new ControlledExecutor(()=>action,async()=>mode==='wrong-target'?{...target,project_uuid:'foreign'}:target);
 const pending=executor.execute(request,'digest');
 if(mode==='late-settle'){await new Promise(resolve=>setTimeout(resolve,25));await assert.rejects(executor.execute({...request,operation_id:'second'},'second'),/BARRIER/);settle();}
 const result=await pending;
 assert.equal(result.verification.verdict==='satisfied',mode==='success'||mode==='late-settle');assert.equal(writes,mode==='wrong-target'?0:1);
});
for(const ids of ['one',['one','one'],[]])test(`selection preserves scalar/duplicate/empty input: ${JSON.stringify(ids)}`,async()=>{
 let selected:string[]=[];
 (globalThis as unknown as {eda:unknown}).eda={sch_SelectControl:{getAllSelectedPrimitives_PrimitiveId:async()=>selected,doSelectPrimitives:async(ids:string[])=>{selected=ids;}}};
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{primitiveIds:ids},budget_ms:1000};
 const result=await new ControlledExecutor(()=>selectSchematic,async()=>target).execute(request,'digest');
 assert.equal(result.verification.verdict,'satisfied');assert.deepEqual((result.value as {selectedPrimitiveIds:string[]}).selectedPrimitiveIds,ids.length?['one']:[]);
});
