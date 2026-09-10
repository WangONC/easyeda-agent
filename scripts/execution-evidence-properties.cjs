// Oracle depends only on frozen semantic implications, never on reducer output.
const assert = require('node:assert/strict');
const inventory = require('../internal/protocol/execution-evidence.json');
const contracts = require('../extension/src/action-contracts.json');
const clone = x => JSON.parse(JSON.stringify(x));
const SEEDS = [0x53a3c0de, 0x14a4e001, 0x76c0ffee];
const oracle = require('./execution-semantic-oracle.cjs');
inventory.forEach(oracle.category);
const effects = inventory.filter(a => oracle.risk(a));
const proofs = inventory.filter(a => oracle.absence(a));
function prior(action, state) {
 const c=contracts[action];
 return { request_id:'r',contract_version:c.version,contract_hash:c.hash,
 verification:{state:'UNAVAILABLE',coverage:'PARTIAL',required:[],observed:[],missing:[],evidence_refs:['oracle:metadata']},
 recovery:{state:'NOT_REQUESTED'},persistence:{state:'NOT_REQUESTED'},
 request_satisfied:false,next_action:'inspect',reason:'input evidence',operation_id:'oracle-operation',
 ...(state==='uncertain'?{mutation_outcome:'UNCERTAIN',native_settled:false}:state==='no-write'?{mutation_outcome:'NO_WRITE',write_attempted:false}:{}) };
}
function generate() {
 const cases=[];
 const add=(name,action,result,semantic={},dryRun=false,execution, before=false)=>cases.push({name,request:{id:'r',action,payload:dryRun?{dryRun:true}:{}},response:{id:'r',ok:true,result,...(execution?{execution}:{})},before,semantic});
 // Automatically grows whenever an actual adapter is added. Includes both intents.
 for(const a of inventory) for(const intent of [false,true]) {
  const risk=oracle.risk(a);
  add('inventory:'+a.field+':'+a.test+':'+intent,'pcb.page.clear',{[a.field]:clone(a.sample)}, {risk,unsettled:oracle.unsettled(a),proof:false},intent);
 }
 for(const proof of proofs) for(const effect of effects) for(const intent of [false,true]) {
  // The same JSON field cannot simultaneously contain true and false: put proof in prior.
  const raw={[effect.field]:clone(effect.sample)};
  const p=prior('pcb.page.clear','no-write');
  if(effect.field!==proof.field)raw[proof.field]=clone(proof.sample);
  add('proof-conflict:'+proof.field+':'+effect.field+':'+effect.test+':'+intent,'pcb.page.clear',raw,{risk:true,conflict:true},intent,p);
 }
 // Raw absence is authoritative only for a contract-supported, handler-attested preview.
 for(const [action,c] of Object.entries(contracts))if(c.dry_run==='preview') {
  const proof={dryRun:true,write_attempted:false,native_settled:true};
  add('preview-proof:'+action,action,proof,{proof:true},true);
  add('preview-intent-only:'+action,action,{}, {},true);
  for(const a of effects)add('preview-proof-conflict:'+action+':'+a.field+':'+a.test,action,{...proof,[a.field]:clone(a.sample)},{risk:true,conflict:true},true);
 }
 add('legacy-absence-not-authoritative','pcb.component.modify',{write_attempted:false,native_settled:true},{},false);
 // Actual pre-dispatch refusal is a phase proof, not a request flag.
 add('phase-proof','pcb.page.clear',{}, {proof:true},false,undefined,true);
 for(const effect of effects) add('phase-conflict:'+effect.field+':'+effect.test,'pcb.page.clear',{[effect.field]:clone(effect.sample)},{risk:true,conflict:true},false,undefined,true);
 // The existing compound Fast pre-write proof is checked against every adapter too.
 const fastProof={status:'stale',mutation_started:false,created_ids:[],deleted_ids:[],item_results:[],readback_verified:false};
 add('fast-phase-proof','route.apply_batch',fastProof,{proof:true});
 for(const effect of effects) {
  // partial is explicitly a pre-write Fast status when accompanied by this full proof.
  if(effect.field==='status' && effect.test==='partial')continue;
  add('fast-proof-conflict:'+effect.field+':'+effect.test,'route.apply_batch',{...fastProof,[effect.field]:clone(effect.sample)},{risk:true,conflict:true});
 }
 for(const seed of SEEDS) {
  let state=seed;const random=n=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)%n;};
  for(let i=0;i<1024;i++) {
   const action=['pcb.page.clear','pcb.pour.rebuild','document.current'][random(3)], intent=action==='pcb.page.clear'&&!!random(2);
   const a=inventory[random(inventory.length)], result={[a.field]:clone(a.sample)};
   const semantic={risk:oracle.risk(a),unsettled:oracle.unsettled(a),proof:oracle.absence(a)};
   const settled=random(3);if(settled){result.native_settled=settled===1;if(settled===2){semantic.unsettled=true;semantic.risk=true;}}
   const p=prior(action,random(3)===0?'uncertain':'none');
   if(p.mutation_outcome==='UNCERTAIN'){semantic.locked=true;semantic.risk=true;}
   const verification=random(4);
   if(verification===1)p.verification={...p.verification,state:'AVAILABLE',coverage:'PARTIAL',required:['geometry'],missing:['geometry']};
   if(verification===2)p.verification=null;
   if(verification===3)p.verification={...p.verification,state:'AVAILABLE',coverage:'COMPLETE',required:contracts[action].verification.required,observed:contracts[action].verification.required};
   if(verification===1||verification===2)semantic.blocked=true;
   const recovery=random(4);if(recovery===1)p.recovery={state:'PENDING'};if(recovery===2)p.recovery=null;if(recovery===1||recovery===2)semantic.blocked=true;
   if(random(7)===0){result[a.field]=null;semantic.invalid=true;}
   // Oracle follows the independently selected dimensions after overwrites.
   semantic.unsettled = result.native_settled === false || (a.field === 'status' && result.status === 'uncertain') || (a.field === 'duplicate' && result.duplicate === true);
   semantic.risk = !!semantic.locked || semantic.unsettled || (!semantic.invalid && a.field !== 'native_settled' && oracle.risk(a));
   add('semantic:'+seed.toString(16)+':'+i,action,result,semantic,intent,p);
  }
 }
 return cases;
}
function check(c,e) {
 const s=c.semantic,label=c.name;
 if(s.risk){assert.notEqual(e.write_attempted,false,label);assert.equal(e.possible_effect,true,label);assert.notEqual(e.mutation_outcome,'NO_WRITE',label);}
 if(s.unsettled||s.locked){assert.notEqual(e.mutation_outcome,'COMPLETE',label);assert.equal(e.health_effect,'UNKNOWN',label);}
 if(s.invalid||s.conflict||s.blocked)assert.notEqual(e.mutation_outcome,'COMPLETE',label);
 if(e.mutation_outcome==='NO_WRITE'){
  assert.equal(s.proof,true,label+': absence requires proof');assert.ok(!s.risk&&!s.invalid&&!s.conflict&&!s.locked,label);
  assert.equal(e.possible_effect,false,label);assert.equal(e.write_attempted,false,label);
 }
 if(e.mutation_outcome==='COMPLETE'){
  assert.equal(e.request_satisfied,true,label);assert.equal(e.next_action,'continue',label);
  assert.equal(e.possible_effect,true,label);assert.ok(!s.invalid&&!s.conflict&&!s.unsettled&&!s.locked,label);
  for(const required of contracts[c.request.action].verification.required)assert.ok(e.verification.observed.includes(required),label);
 }
 if(!e.request_satisfied)assert.notEqual(e.next_action,'continue',label);
}
function runCases(cases,interpret,authoringResult){
 for(const c of cases){const first=interpret(c.request,c.response,c.before);check(c,first);
 const repeated=interpret(c.request,{...clone(c.response),execution:clone(first)},false);assert.deepEqual(repeated,first,c.name+': idempotence/JSON');
 if(authoringResult){const m=authoringResult(c.request.action,{ok:true,result:{...clone(c.response),execution:first}},c.request.payload);assert.equal(m.ok,first.request_satisfied,c.name+': MCP');assert.deepEqual(m.ok?m.result.execution:m.error.execution,first,c.name+': MCP metadata');}
 }return {seeds:SEEDS.map(x=>'0x'+x.toString(16)),cases:cases.length,adapters:inventory.length,effectAdapters:effects.length,proofAdapters:proofs.length};
}
function run(interpret,authoringResult){return runCases(generate(),interpret,authoringResult);}
function previewCases(rows){const cases=[];for(const row of rows){cases.push(clone(row));const missing=clone(row);missing.name+=':without-proof';delete missing.response.result.write_attempted;delete missing.response.result.native_settled;missing.semantic={};cases.push(missing);
 for(const a of effects){const c=clone(row);c.name+=':'+a.field+':'+a.test;c.response.result[a.field]=clone(a.sample);c.semantic={risk:true,conflict:true};cases.push(c);}
}return cases;}
module.exports={generate,check,run,runCases,previewCases};
if(require.main===module)(async()=>{if(process.argv.includes('--json')){process.stdout.write(JSON.stringify(generate()));return;}const {interpret}=await import('../mcp/src/execution.generated.mjs');const {authoringResult}=await import('../mcp/src/authoring-result.mjs');console.log(run(interpret,authoringResult));})().catch(e=>{console.error(e);process.exitCode=1;});
