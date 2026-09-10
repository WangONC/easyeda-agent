import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor,V2,type Request } from './execution-v2';
import { boardMutation,boardCopy } from './v2-native-actions';
const target={scope:'PROJECT' as const,session:'s',activation:'a',project_uuid:'p'};
for(const action of ['create','rename','delete','copy'] as const)for(const mode of ['success','readback-failure','wrong-target','late-settle'] as const)test(`board ${action}: ${mode}`,async()=>{
 let rows=[{name:'old',parentProjectUuid:'p',pcb:{uuid:'old-doc'}}];
 let writes=0,settle!:()=>void;
 const pendingNative=new Promise<void>(resolve=>{settle=resolve;});
 const write=async(change:()=>void)=>{writes++;if(mode==='late-settle')await pendingNative;if(mode!=='readback-failure')change();};
 (globalThis as unknown as {eda:unknown}).eda={
  dmt_Schematic:{getAllSchematicsInfo:async()=>[]},dmt_Pcb:{getAllPcbsInfo:async()=>[{uuid:'new-doc',parentProjectUuid:'p'}]},
  dmt_Board:{getAllBoardsInfo:async()=>structuredClone(rows),getBoardInfo:async(name:string)=>structuredClone(rows.find(b=>b.name===name)),
   createBoard:async()=>{await write(()=>{rows.push({name:'created',parentProjectUuid:'p',pcb:{uuid:'new-doc'}});});return 'created';},
   modifyBoardName:async()=>{await write(()=>{rows[0].name='new';});return true;},
   deleteBoard:async()=>{await write(()=>{rows=[];});return true;},
   copyBoard:async()=>{await write(()=>{rows.push({name:'copy',parentProjectUuid:'p',pcb:{uuid:'copy-doc'}});});return 'copy';},
  }
 };
 const native=action==='copy'?boardCopy:boardMutation(action);
 const executor=new ControlledExecutor(()=>native,async()=>mode==='wrong-target'?{...target,project_uuid:'foreign'}:target);
 const input=action==='create'?{pcbUuid:'new-doc'}:action==='rename'?{name:'old',newName:'new'}:{name:'old'};
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
 if(mode==='success')assert.ok((result.value as {boardName:string}).boardName);
});
