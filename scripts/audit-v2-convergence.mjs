// Audit only. Never imported by runtime or used to dispatch an action.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const read=p=>fs.readFileSync(p,'utf8');
const roots=['internal/executionv2','internal/daemon','extension/src'];
const files=roots.flatMap(root=>fs.readdirSync(root).filter(n=>!n.includes('test')&&((root.endsWith('executionv2')&&n.endsWith('.go'))||/^v2.*\.(go|ts)$/.test(n)||n==='execution-v2.ts')).map(n=>root+'/'+n));
files.push('internal/app/v2.go','internal/app/v2_read.go','mcp/src/server.mjs','mcp/src/v2-projection.mjs');
const matches=re=>files.flatMap(file=>read(file).split(/\r?\n/).flatMap((text,i)=>re.test(text)?[{file,line:i+1,text:text.trim()}]:[]));
const rules=[
 ['legacy reducer / prior merge / repeated Interpret',/\b(?:Interpret|CanonicalConclusion|priorExecution|adaptLegacyEvidence|legacyEvidenceAdapter)\b/,'No compatibility reducer is referenced by the scoped V2 runtime files.'],
 ['raw business flags',/\.(?:ok|verified|partial|status)\b/,'routing assigns diagnostic value.ok; silk counts row.ok that was just authored from fresh appliedIDs. MCP runEasyeda.ok is subprocess transport status used to locate the unchanged daemon result, never a mutation completion proof. None enters Finalize.'],
 ['replay / retry mentions',/\b(?:replay|retry)\b/i,'Review references individually; comments and explicit rejection do not dispatch effects.'],
];
const rows=rules.map(([pattern,re,disposition])=>({pattern,production_matches:matches(re),disposition}));
assert.equal(rows[0].production_matches.length,0);
const daemon=read('internal/daemon/daemon.go'),hub=read('internal/daemon/hub.go'),actions=read('extension/src/actions.ts'),transport=read('extension/src/transport.ts'),runtime=read('extension/src/execution-v2.ts');
assert.match(daemon,/HandleFunc\("\/action", rejectLegacy\)/);
assert.match(daemon,/HandleFunc\("\/writeverify", rejectLegacy\)/);
assert.match(hub,/func \(c \*conn\) dispatch\([^]*?return nil, fmt.Errorf\("V2_ACTION_NOT_MIGRATED: legacy dispatch disabled"\)/);
assert.match(actions,/export async function runAction[^]*?throw new ActionError\('V2_ACTION_NOT_MIGRATED'/);
assert.match(actions,/entry\.mode==='V2_NATIVE' \? entry : undefined/);
assert.match(transport,/case 'request':[^]*?Legacy dispatch disabled/);
assert.match(runtime,/if \(!verifier\) throw Error\('V2_SCOPED_VERIFIER_REQUIRED_BEFORE_EFFECT'\)/);
assert.match(runtime,/if \(!accepting \|\| action.scope==='NONE' \|\| verifying \|\| activeNative/);
assert.match(runtime,/slot\.reconcile=async\(\)=>\{[^]*?observation=await runVerifier\(true\)/);
rows.push(
 {pattern:'legacy /action and /writeverify',production_matches:[{file:'internal/daemon/daemon.go',entry:'/action and /writeverify'}],disposition:'HTTP 410 rejectLegacy; no executable handler.'},
 {pattern:'old Go/TS handlers retained in source',production_matches:[{file:'internal/daemon/hub.go',entry:'conn.dispatch'},{file:'extension/src/actions.ts',entry:'runAction'}],disposition:'Both unconditional rejection stubs; old helpers/tests are reference business code, not a fallback runtime.'},
 {pattern:'effect before verifier / reconcile mutation',production_matches:[],disposition:'ControlledExecutor rejects effect without prepare and rejects effects while verifying or after accepting=false. Tested with controllable native promises; the lexical scan is not a proof of arbitrary callback purity.'},
 {pattern:'V2 parent to non-V2 child',production_matches:[],disposition:'Both coordinator and Connector reject nonempty parent_operation_id. Current composites use fixed native sequences, not typed legacy children.'},
 {pattern:'background autosave / extension management',production_matches:[{file:'internal/daemon/autosave.go',entry:'dispatchSave reference implementation'},{file:'extension/src/index.ts',entry:'toggleAutoConnect'}],disposition:'Autosaver is not constructed by Server.New and its legacy conn.dispatch is closed. ToggleAutoConnect changes extension connection preference from its user menu, not EDA document content or Agent execution.'}
);
const report={scope:files,baseline_oracle:'test-only git show a583bf7:extension/src/actions.ts; deliberately retained',patterns:rows,limits:'Text/entrypoint checks plus invariant tests, not a formal whole-program proof. Live Host findings are recorded separately.'};
const out='docs/execution-v2/round3-convergence-audit.json';
if(process.argv.includes('--write'))fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scoped_runtime_files:files.length,compatibility_reducer_matches:rows[0].production_matches.length,raw_business_flag_matches:rows[1].production_matches.length,entrypoint_assertions:'PASS'}));
