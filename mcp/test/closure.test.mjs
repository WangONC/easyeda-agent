import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCallArgs} from '../src/core.mjs';
import {fastTools} from '../src/fast-path.mjs';
test('Closure capabilities map to existing or composed Go commands without shell geometry',()=>{
 for(const [action,command] of Object.entries({'route.tuning_plan':'tuning-plan','route.pair_plan':'pair-plan','pcb.routing_profile':'routing-profile','pcb.plane.refresh':'plane-refresh','pcb.drc.compare':'drc-compare','pcb.report':'report','pcb.manufacturing.export':'manufacturing-export'})){
  const args=buildCallArgs(action,{project:'p',doc:'d',window:'w',payload:{document_uuid:'d',project_uuid:'p'}});
  assert.deepEqual(args.slice(0,6),['--project','p','--doc','d','pcb',command]);assert.equal(JSON.parse(args[7]).document_uuid,'d');assert.ok(!args.includes('--force'));
 }
 assert.ok(fastTools().find(t=>t.name==='easyeda_route_preflight').inputSchema.properties.profile_id);
});

test('project bootstrap mapping preserves Personal omission and explicit Team scope',()=>{
 const current={uuid:'current-project',teamUuid:'personal-owner'};
 const payload={name:'personal',expected_project_uuid:current.uuid,session_token:'session',client_transaction_id:'personal-txn'};
 const input={window:'window',payload};
 const args=buildCallArgs('project.create',input);
 const mapped=JSON.parse(args[args.indexOf('--input')+1]);
 assert.deepEqual(mapped,payload);
 assert.ok(!Object.hasOwn(mapped,'team_uuid'));
 assert.ok(!Object.hasOwn(mapped,'folder_uuid'));
 const team={...payload,team_uuid:'real-team',folder_uuid:'real-folder'};
 const teamArgs=buildCallArgs('project.create',{window:'window',payload:team});
 assert.deepEqual(JSON.parse(teamArgs[teamArgs.indexOf('--input')+1]),team);
});
