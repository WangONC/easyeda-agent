// Deterministic adversarial evidence combinations, shared by Connector, MCP and Go.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const SEED = 0x53a3c0de;
const SIZE = 4096;
const clone = x => JSON.parse(JSON.stringify(x));
const corpus = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../internal/protocol/testdata/execution.json'), 'utf8'));
function generate(interpret, count = SIZE) {
 let state = SEED;
 const random = n => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % n; };
 const bases = corpus();
 const fast = bases.find(c => c.request.action === 'route.apply_batch' && c.want_outcome === 'COMPLETE' && !c.response.execution);
 const fields = ['verification', 'recovery', 'persistence', 'native_settled', 'write_attempted', 'request_satisfied', 'mutation_outcome', 'contract_hash', 'next_action', 'possible_effect', 'health_effect', 'affected_targets', 'item_results'];
 const values = [null, false, 0, 'false', [], {}, 'UNKNOWN_ENUM'];
 const cases = [];
 for (let i = 0; i < count; i++) {
  const c = clone(i % 3 === 0 ? fast : bases[random(bases.length)]);
  c.name = `seed_${SEED.toString(16)}_${i}`;
  delete c.want_outcome; delete c.want_satisfied;
  c.before = false;
  c.response.execution = interpret(c.request, c.response, false);
  // Metadata must survive all valid normalization routes.
  c.response.execution.operation_id = 'property-operation';
  c.response.execution.verification.evidence_refs.push('property:receipt');
  const kind = i % 8;
  if (kind === 0) {
   const field = fields[random(fields.length)];
   if (random(3) === 0) delete c.response.execution[field];
   else c.response.execution[field] = clone(values[random(values.length)]);
   // Also remove or null one mandatory field: malformed must fail closed regardless of other combinations.
   if(random(2))delete c.response.execution.request_satisfied;else c.response.execution.request_satisfied=null;
   c.malformed=true;
  } else if (kind === 1) {
   c.response.execution.mutation_outcome = 'UNCERTAIN';
   delete c.response.execution.decision_basis;
   const settled=random(3);if(settled===2)delete c.response.execution.native_settled;else c.response.execution.native_settled=settled===1;
   c.locked = true;
  } else if (kind === 2) {
   c.request.action = 'pcb.page.clear';c.request.payload = {dryRun:true};
   // Match the preview contract before introducing contradictory observations.
   c.response.execution = interpret(c.request, {id:c.request.id,ok:true,result:{}}, false);
   c.response.result = {mutation_started:true,deleted_ids:['sentinel']};
   c.effect = true;
  } else if (kind === 3) {
   c.response.execution.verification = {state:'AVAILABLE',coverage:'PARTIAL',required:['geometry'],observed:[],missing:['geometry'],evidence_refs:['missing:geometry']};
   c.locked = true;
  } else if (kind === 4) {
   c.response.result ||= {};
   const keys = ['mutation_started','readback_verified','native_settled','rollback_complete','created_ids','deleted_ids','item_results','revision_after'];
   c.response.result[keys[random(keys.length)]] = clone(values[random(values.length)]);
  } else if (kind === 5) {
   c.response.execution.recovery = {state:['RESTORED','PENDING','FAILED','UNKNOWN'][random(4)],evidence_refs:['recovery:receipt']};
   c.response.execution.persistence = {state:['UNKNOWN','DELIVERY_FAILED','PENDING_DELIVERY'][random(3)],evidence_refs:['persistence:receipt']};
  } else if (kind === 6) {
   c.response.execution.request_satisfied = true;
   c.response.execution.next_action = 'continue';
   c.response.execution.reason = 'stale success';
   c.response.result ||= {};c.response.result.readback_verified = false;
  } else {
   c.response.execution.verification.required = ['geometry'];
   c.response.execution.verification.observed = ['geometry'];
   c.response.execution.verification.missing = [];
   c.response.execution.verification.coverage = 'COMPLETE';
   if(random(2)){
    const bad=[{ok:'false'},{createdAt:'not-a-date'},{seq:'1'},{context:{documentUuid:7}},{warnings:[false]},{artifacts:[{size:'1'}]},{error:{code:7}},{result:[]}];
    c.response.execution.child_responses=[{id:'child',ok:true,...bad[random(bad.length)]}];c.malformed=true;
   }
  }
  // Vary independent outer acknowledgement, intent and transport identity.
  if (random(4) === 0) c.response.ok = !c.response.ok;
  if (random(7) === 0) c.request.contractHash = 'conflicting-contract';
  if (random(9) === 0) c.response.id = 'another-request';
  cases.push(c);
 }
 return cases;
}
function check(c, e) {
 const label = c.name;
 if (e.mutation_outcome === 'COMPLETE') {
  assert.equal(e.request_satisfied,true,label);assert.equal(e.next_action,'continue',label);
  assert.equal(e.possible_effect,true,label);assert.equal(e.native_settled,true,label);
  assert.equal(e.verification.state,'AVAILABLE',label);assert.equal(e.verification.coverage,'COMPLETE',label);
  assert.deepEqual(e.verification.missing,[],label);
  assert.ok(e.verification.required.every(x=>e.verification.observed.includes(x)),label);
 }
 if (!e.request_satisfied) assert.notEqual(e.next_action,'continue',label);
 if (['INVALID','CONFLICT','UNRESOLVED'].includes(e.decision_basis)) {
  assert.notEqual(e.mutation_outcome,'COMPLETE',label);assert.equal(e.request_satisfied,false,label);
  assert.equal(e.autosave_eligible,false,label);assert.equal(e.health_effect,'UNKNOWN',label);
  assert.equal(e.next_action,'reconcile_without_replay',label);
 }
 if(c.malformed){assert.notEqual(e.mutation_outcome,'COMPLETE',label);assert.equal(e.request_satisfied,false,label);}
 if(c.locked){assert.notEqual(e.mutation_outcome,'COMPLETE',label);assert.notEqual(e.mutation_outcome,'NO_WRITE',label);assert.equal(e.health_effect,'UNKNOWN',label);}
 if(c.effect){assert.equal(e.possible_effect,true,label);assert.notEqual(e.mutation_outcome,'NO_WRITE',label);}
 if(e.mutation_outcome==='NO_WRITE'){assert.equal(e.possible_effect,false,label);assert.equal(e.write_attempted,false,label);assert.equal(e.autosave_eligible,false,label);}
 assert.equal(typeof e.reason,'string',label);assert.ok(e.reason.length>0,label);
}
function run(interpret, authoringResult) {
 const cases=generate(interpret);
 for(const c of cases){
  const first=interpret(c.request,c.response,c.before);check(c,first);
  const repeated=interpret(c.request,{...c.response,execution:first},c.before);
  assert.deepEqual(repeated,first,`${c.name}: repeated interpretation`);
  if(authoringResult){
   const value=authoringResult(c.request.action,{ok:true,result:{...c.response,execution:first}},c.request.payload);
   const projected=value.ok?value.result.execution:value.error.execution;
   assert.deepEqual(projected,first,`${c.name}: MCP projection`);
   assert.equal(value.ok,first.request_satisfied,`${c.name}: MCP success`);
  }
 }
 return {seed:SEED,size:cases.length};
}
module.exports={SEED,SIZE,generate,check,run};
if(require.main===module){
 (async()=>{const {interpret}=await import('../mcp/src/execution.generated.mjs');
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(generate(interpret)));
 else {const {authoringResult}=await import('../mcp/src/authoring-result.mjs');console.log(run(interpret,authoringResult));}
 })().catch(e=>{console.error(e);process.exitCode=1;});
}
