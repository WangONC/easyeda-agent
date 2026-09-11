// Audit artifact only; never a runtime registry or admission authority.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const inventory=JSON.parse(fs.readFileSync('docs/execution-v2/migration-inventory.json','utf8'));
const business=JSON.parse(fs.readFileSync('docs/execution-v2/round3-business-audit.json','utf8'));
const intentional=new Set(['schematic.text.list','schematic.library.search','schematic.library.get_by_lcsc','pcb.documents.list','pcb.silk.list','pcb.line.list','pcb.via.list','pcb.pour.list','pcb.region.list','pcb.fill.list','pcb.drc.rules','pcb.report','pcb.manufacturing.export']);
const tests=fs.readdirSync('extension/src').filter(n=>n.endsWith('.test.ts')&&(/^(v2|execution-v2|component-source|plane|fast-path)/.test(n)));
const evidence=new Map(business.actions.map(a=>[a.action,a]));
const requirements={
 'schematic.wire.create':'Re-run saved reversed/segment-array fixtures and merged/collinear/filler/tolerance cases with the single batch package. Historical UNKNOWN is not rewritten.',
 'schematic.group.move':'Real merged-wire recreation, rotation and stationary collinear merge; verify all unrelated identities.',
 'schematic.power.connect_pin':'Real pin/flag calibration and merged wire; timeout must retain original effect and never create again.',
 'schematic.pin.disconnect':'Real segment arrays, marker scope and surviving unrelated wires; phantom diagonals are covered offline.',
 'schematic.component.replace':'Real replacement/source/rotation/compensation followed by save-reload-source reconstruction.',
 'pcb.outline.set':'Actual winding/start-point representation changed; corrected complete closed-path verifier still needs Host acceptance.',
 'pcb.manufacturing.export':'FAILED: actual zero-drill archive has unknown drill inventory; settled export remains UNKNOWN and no safe release/recovery path has been qualified.',
 'route.apply_batch':'Preflight passed on Host; apply was rejected by stage admission. V2 stage read port is offline tested, not Host-qualified.',
 'pcb.add_component':'Basic R0603 placement passed; embedded via parent identity and reload association remain unqualified.',
 'pcb.drc.check':'Actual clear and violating reports passed; qualification remains scoped to observed Host shapes, not every report/options branch.',
 'pcb.drc.compare':'Stable violation anchors and baseline persistence with actual native report must be exercised.',
 'pcb.plane.refresh':'Actual source-pour/region ownership, complete residual geometry and late settlement.',
 'library.symbol.build':'Offline real native-handler/default oracle and ten failure cases pass; real editor identity and saved geometry still required.',
 'library.footprint.build':'Actual editor tab/asset UUID, pad/hole getters, save ACK and association reconstruction.',
 'project.create':'UUID/readback worked; team/folder branches and session loss are not fully Host-qualified.',
 'project.open':'Exact UUID switch worked; close/reopen, retired tab and same-name drift still required.',
 'board.new_pcb':'Real empty PCB creation worked; donor/force identity and compensation require remaining Host cases.',
 'board.rebind':'Actual donor bindings, no-op and compensation with save/reload.',
 'pcb.save':'ACK passed on Host. Separate reload/rebind/resume checkpoint has not run.',
 'schematic.save':'ACK contract covered offline; saved source reconstruction/checkpoint not completed.',
};
const observedHost={
 'document.current':'PASS: real MCP→CLI→daemon→Connector read; lifecycle drift qualification incomplete.',
 'project.create':'PASS: three isolated projects returned exact native UUIDs.',
 'project.open':'PASS: exact isolated project switches.',
 'document.open':'PASS: opened isolated schematic/PCB UUID.',
 'board.new_pcb':'PASS: operation 387c6c84-975c-411a-861e-1b8d0d7fecdd.',
 'pcb.add_component':'PASS: two R0603 components, actual two-pad inventory.',
 'pcb.component.modify':'PASS: move plus verified no-op; idempotent no-op effect_started=false.',
 'pcb.drc.check':'PASS: positive inventory has 2 clearance + 4 connection violations; execution success != design_pass.',
 'pcb.outline.set':'FAIL on installed pre-batch verifier; corrected offline, Host retest NOT_RUN.',
 'pcb.outline.get':'PASS: actual reversed point order and bbox captured.',
 'board.snapshot_compact':'PASS: four supported pad records and scoped revision.',
 'route.preflight':'PASS: no conflicts for exact requested signal route.',
 'route.apply_batch':'NOT_RUN native effect: STAGE_BLOCKED admission; no write.',
 'pcb.save':'PASS native ACK; checkpoint persistence NOT_RUN.',
 'pcb.manufacturing.export':'FAIL: three files delivered, missing drill inventory, UNKNOWN owner retained.',
 'schematic.component.place':'PASS: two isolated schematic attempts, source IDs captured before later wire failure.',
 'schematic.wire.create':'FAIL installed verifier for reversal/segment array; one earlier same-op fresh reconcile succeeded. Batch retest NOT_RUN.',
 'schematic.library.get_by_lcsc':'PASS: C25804 exact device/library identity.',
};
const actions=inventory.actions.map(a=>{
 const b=evidence.get(a.action);assert.ok(b);assert.equal(b.missing_direct_parameters.length,0);
 const qualification=a.mode==='UNSUPPORTED'?'UNSUPPORTED':a.action==='system.health'?'QUALIFIED':a.action==='pcb.manufacturing.export'?'FAILED':'HOST_QUALIFICATION_REQUIRED';
 const testFiles=tests.filter(n=>fs.readFileSync('extension/src/'+n,'utf8').includes(a.action)).map(n=>'extension/src/'+n);
 return {action:a.action,level:a.level,mode:a.mode,qualification,
 qualification_basis:qualification==='UNSUPPORTED'?a.reason:qualification==='QUALIFIED'?'Daemon-local health snapshot; no Host API/effect. Coordinator/HTTP/startup tests.':requirements[a.action]??'Native runtime and offline template tests exist; actual Host version, complete payload branches and identity/persistence boundary are not certified by a positive smoke alone.',
 host_evidence:observedHost[a.action]??'NOT_RUN: no complete action qualification recorded.',
 baseline_input_keys:b.baseline_direct_parameters,v2_input_keys:b.v2_parameters,missing_direct_parameters:b.missing_direct_parameters,
 semantic_sweep:{declared_parameter_check:'PASS',baseline_outputs:a.baseline_outputs,assessment:a.mode==='UNSUPPORTED'?'UNSUPPORTED':intentional.has(a.action)?'INTENTIONAL_BREAK':'PRESERVED',scope:'Bounded source/declared-parameter audit plus available Round 1/2/3 business tests; PRESERVED means no outstanding detected business regression, not exhaustive equivalence of every branch. Malformed native data previously projected as empty/default is now refused; manufacturing missing drill count is null rather than zero. These explicit INTENTIONAL_BREAK rows implement requested fail-closed behavior; valid business inputs/defaults remain. Frozen execution-envelope/receipt changes are excluded.',exhaustive_differential_proof:false},
 test_literal_references:testFiles,test_reference_limit:'Lexical references are navigation aids, not test coverage claims. Parameterized/shared template coverage may not contain this literal.'};
});
assert.equal(actions.length,151);assert.equal(new Set(actions.map(a=>a.action)).size,151);assert.ok(actions.every(a=>['QUALIFIED','HOST_QUALIFICATION_REQUIRED','UNSUPPORTED','FAILED'].includes(a.qualification)));assert.equal(inventory.counts.NOT_MIGRATED,0);assert.equal(inventory.counts.LEGACY_RUNTIME,0);
const counts=Object.fromEntries(['QUALIFIED','HOST_QUALIFICATION_REQUIRED','UNSUPPORTED','FAILED'].map(k=>[k,actions.filter(a=>a.qualification===k).length]));
const report={round2:'6f2e562aca77bd9ae416ccf5dd7abe92966bd0da',status:'ROUND3_BLOCKED',policy:'Conservative whole-action qualification. Positive smoke evidence is retained separately. No unexecuted Host test is PASS.',counts,actions};
const json=JSON.stringify(report,null,2)+'\n';
let md='# Execution V2 Round 3 qualification matrix\n\nGenerated by `scripts/audit-v2-qualification.mjs`. Audit only. **ROUND3_BLOCKED**. Qualification is conservative and whole-action: a successful narrow Host smoke is not full qualification. Native migration remains 144/151; seven are unsupported.\n\n```json\n'+JSON.stringify(counts,null,2)+'\n```\n\n| Action | Level | Qualification | Evidence / remaining fact |\n|---|---:|---|---|\n';
for(const a of actions)md+=`| \`${a.action}\` | ${a.level} | ${a.qualification} | ${a.qualification_basis.replaceAll('|','/')} |\n`;
for(const [p,s] of [['docs/execution-v2/round3-qualification.json',json],['docs/execution-v2/ROUND3_QUALIFICATION_MATRIX.md',md]]){if(process.argv.includes('--check'))assert.equal(fs.readFileSync(p,'utf8'),s);else fs.writeFileSync(p,s);}
console.log(JSON.stringify(counts));
