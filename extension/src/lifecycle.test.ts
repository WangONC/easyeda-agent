import test from 'node:test';
import assert from 'node:assert/strict';
import { projectList,projectCreate,projectOpen,schematicCreate } from './lifecycle';
function host(){
 let current='old';let creates=0;
 const api={dmt_Project:{getAllProjectsUuid:async()=>['old','new'],getCurrentProjectInfo:async()=>({uuid:current}),
  createProject:async()=>{creates++;return 'new'},getProjectInfo:async(uuid:string)=>({uuid}),openProject:async(uuid:string)=>{current=uuid;return true}},
  dmt_Schematic:{createSchematic:async()=> 'sch',getSchematicInfo:async()=>({uuid:'sch',parentProjectUuid:current,page:[]})}};
 (globalThis as unknown as {eda:unknown}).eda=api;return {api,creates:()=>creates};
}
test('native bootstrap reads exact identity and duplicate create never replays',async()=>{
 const h=host();const token=(await projectList({})).result!.session_token;
 const p={name:'fixture',expected_project_uuid:'old',client_transaction_id:'bootstrap-test',session_token:token};
 assert.equal((await projectCreate(p)).result!.status,'complete');assert.equal(h.creates(),1);
 assert.equal((await projectCreate(p)).result!.duplicate,true);assert.equal(h.creates(),1);
 await assert.rejects(projectCreate({...p,name:'different'}),/arguments differ/);
 await assert.rejects(projectOpen({project_uuid:'new',expected_project_uuid:'old'}),/Save edited/);
 assert.equal((await projectOpen({project_uuid:'new',expected_project_uuid:'old',saved_current_project:true})).result!.project_uuid,'new');
 const r=await schematicCreate({expected_project_uuid:'new',client_transaction_id:'schematic-test',session_token:token});
 assert.equal(r.result!.status,'complete');assert.equal(r.result!.schematic_uuid,'sch');assert.deepEqual(r.result!.pages,[]);
});
test('stale session and wrong project never create; unavailable readback stays uncertain',async()=>{
 const h=host();const token=(await projectList({})).result!.session_token;
 await assert.rejects(projectCreate({name:'n',expected_project_uuid:'old',client_transaction_id:'stale',session_token:'old'}),/reconcile/);
 const r=await projectCreate({name:'n',expected_project_uuid:'wrong',client_transaction_id:'wrong-context',session_token:token});
 assert.equal(r.result!.status,'uncertain');assert.equal(h.creates(),0);
 h.api.dmt_Project.getProjectInfo=async()=>{throw new Error('readback failed')};
 const p={name:'n',expected_project_uuid:'old',client_transaction_id:'readback-fail',session_token:token};
 assert.equal((await projectCreate(p)).result!.status,'uncertain');assert.equal((await projectCreate(p)).result!.duplicate,true);assert.equal(h.creates(),1);
});
test('pending native create is not repeated',async()=>{
 const h=host();const token=(await projectList({})).result!.session_token;
 let release!:(v:string)=>void;h.api.dmt_Project.createProject=()=>new Promise<string>(resolve=>{release=resolve});
 const p={name:'n',expected_project_uuid:'old',client_transaction_id:'pending-test',session_token:token};
 const first=projectCreate(p);await Promise.resolve();await Promise.resolve();
 const duplicate=await projectCreate(p);assert.equal(duplicate.result!.status,'uncertain');
 release('new');assert.equal((await first).result!.status,'complete');
});

test('missing board is rejected before schematic native create',async()=>{
 const h=host();let writes=0;
 Object.assign(h.api,{dmt_Board:{getBoardInfo:async()=>undefined}});
 h.api.dmt_Schematic.createSchematic=async()=>{writes++;return 'unexpected'};
 const token=(await projectList({})).result!.session_token;
 const r=await schematicCreate({expected_project_uuid:'old',client_transaction_id:'missing-board',session_token:token,board_name:'missing'});
 assert.equal(r.result!.status,'failed');assert.equal(r.result!.mutation_started,false);assert.equal(writes,0);
});
