import test from 'node:test';import assert from 'node:assert/strict';import {projectV2} from './v2-projection.mjs';
for(const outcome of ['SUCCEEDED','NOT_APPLIED','PARTIAL','UNKNOWN','RETIRED_UNRESOLVED'])test('projection '+outcome,()=>{const result={protocol:'execution.v2',operation_id:'op',outcome,evidence_ref:'op',effects:{effect_started:false,state_changed:false,native_settled:true,effect_scope:'NONE',reconciled:false}};const projected=projectV2(result);assert.equal(projected.structuredContent,result);assert.equal(projected.isError,outcome!=='SUCCEEDED');assert.equal(JSON.parse(projected.content[0].text).outcome,outcome);});
test('legacy raw success is refused',()=>assert.throws(()=>projectV2({ok:true,verified:true}),/MALFORMED/));

test('incomplete V2 receipt is refused without inferring outcome',()=>assert.throws(()=>projectV2({protocol:'execution.v2',operation_id:'op',outcome:'SUCCEEDED'}),/MALFORMED/));

test('released UNKNOWN projects unchanged and remains an error outcome',()=>{
 const result={protocol:'execution.v2',operation_id:'op',outcome:'UNKNOWN',ownership_released:true,evidence_ref:'op',effects:{effect_started:true,state_changed:null,native_settled:true,effect_scope:'DESIGN_CONTENT',reconciled:true}};
 const projected=projectV2(result);
 assert.equal(projected.isError,true);
 assert.equal(projected.structuredContent,result);
 assert.equal(JSON.parse(projected.content[0].text).outcome,'UNKNOWN');
 assert.equal(projected.structuredContent.ownership_released,true);
});
