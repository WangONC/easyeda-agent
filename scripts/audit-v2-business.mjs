// Test/audit only: no baseline code is imported by production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from '../extension/node_modules/typescript/lib/typescript.js';
const source=execFileSync('git',['show','a583bf731d946d2d39f1223e078d711bd41710d5:extension/src/actions.ts'],{encoding:'utf8'});
const file=ts.createSourceFile('baseline.ts',source,ts.ScriptTarget.Latest,true);
const declarations=new Map();function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer)declarations.set(n.name.text,n.initializer);ts.forEachChild(n,walk);}walk(file);
const handlers=declarations.get('HANDLERS');const mapping=new Map(handlers.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text,p.initializer.getText(file)]));
const inventory=JSON.parse(fs.readFileSync('docs/execution-v2/migration-inventory.json','utf8'));
const previous=JSON.parse(execFileSync('git',['show','f96960c0487ca0aff8c5095220f496a22e5d1398:docs/execution-v2/migration-inventory.json'],{encoding:'utf8'}));const migratedBefore=new Set(previous.actions.filter(a=>a.mode==='V2_NATIVE').map(a=>a.action));
const rows=[];for(const row of inventory.actions){if(migratedBefore.has(row.action))continue;const handler=mapping.get(row.action),body=declarations.get(handler),keys=new Set();
 if(body){const text=body.getText(file);for(const m of text.matchAll(/payload\.([A-Za-z_][A-Za-z_0-9]*)/g))keys.add(m[1]);for(const m of text.matchAll(/(?:require|optional)(?:String|Number|Boolean)\(payload,\s*['"]([^'"]+)['"]/g))keys.add(m[1]);}
 const inputs=row.v2?.input??{};rows.push({action:row.action,mode:row.mode,baseline_handler:handler??null,baseline_handler_line:body?file.getLineAndCharacterOfPosition(body.pos).line+1:null,baseline_direct_parameters:[...keys].sort(),v2_parameters:Object.keys(inputs).sort(),missing_direct_parameters:row.mode==='V2_NATIVE'?[...keys].filter(k=>!Object.hasOwn(inputs,k)).sort():[],baseline_inputs:row.baseline_inputs,baseline_outputs:row.baseline_outputs??[],disposition_reason:row.reason});}
assert.equal(rows.length,70);assert.ok(rows.every(r=>r.missing_direct_parameters.length===0),'baseline direct parameter omitted');
if(process.argv.includes('--write'))fs.writeFileSync('docs/execution-v2/round2-business-audit.json',JSON.stringify({baseline:inventory.baseline,round1:'f96960c0487ca0aff8c5095220f496a22e5d1398',scope:'70 actions not native at Round 1; direct handler parameters only, not a transitive proof',actions:rows},null,2)+'\n');
console.log(JSON.stringify(rows.filter(r=>r.missing_direct_parameters.length).map(r=>({action:r.action,missing:r.missing_direct_parameters})),null,2));
