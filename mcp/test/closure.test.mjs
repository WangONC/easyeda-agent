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
