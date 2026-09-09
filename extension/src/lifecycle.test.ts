import test from 'node:test';
import assert from 'node:assert/strict';
import { projectList,projectCreate,projectOpen,schematicCreate } from './lifecycle';
function host(){
 let current='old';let creates=0;
 const api={dmt_Project:{getAllProjectsUuid:async()=>['old','new'],getCurrentProjectInfo:async()=>({uuid:current}),
  createProject:async()=>{creates++;return 'new'},getProjectInfo:async(uuid:string)=>({uuid}),openProject:async(uuid:string)=>{current=uuid;return true}},
  dmt_Schematic:{getAllSchematicsInfo:async()=>[{uuid:'sch',parentProjectUuid:current,page:[{uuid:'page'}]}],createSchematic:async()=> 'sch',getSchematicInfo:async()=>({uuid:'sch',parentProjectUuid:current,page:[]})}};
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
 assert.equal(r.result!.status,'complete');assert.equal(r.result!.schematic_uuid,'sch');assert.deepEqual(r.result!.pages,[{uuid:'page'}]);
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

// EDA 3.2 Personal projects expose the owner UUID in current.teamUuid.
// That readback field must never implicitly become a create destination.
test('Personal current owner never populates native create team or folder arguments', async()=>{
 const h=host(); const calls:unknown[][]=[];
 Object.assign(h.api.dmt_Project, {
  getCurrentProjectInfo:async()=>({uuid:'old',teamUuid:'personal-owner'}),
  getAllProjectsUuid:async()=>[],
  createProject:async(...args:unknown[])=>{calls.push(args);return 'new';},
 });
 const token=(await projectList({})).result!.session_token;
 const p={name:'personal-root',expected_project_uuid:'old',session_token:token,client_transaction_id:'personal-owner-regression'};
 assert.equal((await projectCreate(p)).result!.status,'complete');
 assert.deepEqual(calls,[['personal-root',undefined,undefined,undefined]]);
 assert.equal((await projectCreate(p)).result!.duplicate,true);
 assert.equal(calls.length,1);
});

test('explicit real Team and Folder destinations are passed unchanged, never converted to Personal', async()=>{
 const h=host(); const calls:unknown[][]=[];
 Object.assign(h.api.dmt_Project,{
  getCurrentProjectInfo:async()=>({uuid:'old',teamUuid:'personal-owner'}),
  createProject:async(...args:unknown[])=>{calls.push(args);return 'new';},
 });
 const token=(await projectList({})).result!.session_token;
 for(const folder of [undefined,'writable-folder']) {
  const p={name:'team-fixture',expected_project_uuid:'old',session_token:token,client_transaction_id:`team-scope-${folder}`,team_uuid:'real-team',...(folder?{folder_uuid:folder}:{})};
  assert.equal((await projectCreate(p)).result!.status,'complete');
 }
 assert.deepEqual(calls,[['team-fixture',undefined,'real-team',undefined],['team-fixture',undefined,'real-team','writable-folder']]);
});

test('native undefined stays uncertain without scope fallback or blind replay', async()=>{
 const h=host();let calls=0;
 Object.assign(h.api.dmt_Project,{createProject:async()=>{calls++;return undefined;}});
 const token=(await projectList({})).result!.session_token;
 const p={name:'scope-rejected',team_uuid:'personal-owner',expected_project_uuid:'old',session_token:token,client_transaction_id:'scope-rejected-no-replay'};
 assert.equal((await projectCreate(p)).result!.status,'uncertain');
 assert.equal((await projectCreate(p)).result!.duplicate,true);
 assert.equal(calls,1);
});

test('first schematic reuses existing Host initialization without native create',async()=>{
 const h=host();let calls=0;h.api.dmt_Schematic.createSchematic=async()=>{calls++;return 'unexpected'};
 const token=(await projectList({})).result!.session_token;const p={expected_project_uuid:'old',session_token:token,client_transaction_id:'reuse-first'};
 const r=await schematicCreate(p);assert.equal(r.result!.verified,true);assert.equal(r.result!.reused,true);assert.equal(calls,0);
});
test('create UUID survives immediate detail failure and reconciles through inventory',async()=>{
 const h=host();let calls=0;Object.assign(h.api,{dmt_Board:{getBoardInfo:async()=>({name:'Board1'})}});
 h.api.dmt_Schematic.createSchematic=async()=>{calls++;return 'sch'};h.api.dmt_Schematic.getSchematicInfo=async()=>{throw Error('Symbol not ready')};
 const token=(await projectList({})).result!.session_token;const p={expected_project_uuid:'old',session_token:token,client_transaction_id:'reconcile-created-uuid',board_name:'Board1'};
 const r=await schematicCreate(p);assert.equal(r.result!.verified,true);assert.equal(r.result!.schematic_uuid,'sch');await schematicCreate(p);assert.equal(calls,1);
});

test('opening an existing multi-schematic project does not impose first-container uniqueness',async()=>{
 const h=host();Object.assign(h.api.dmt_Schematic,{getAllSchematicsInfo:async()=>{throw Error('should not settle ordinary navigation')}});
 const r=await projectOpen({project_uuid:'existing-multi',expected_project_uuid:'old',saved_current_project:true});
 assert.equal(r.result!.status,'complete');assert.equal(r.result!.initial_schematic_state,'not_requested');
});
