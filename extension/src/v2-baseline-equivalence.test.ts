import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import Module from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { nativeAction } from './actions';
import { ControlledExecutor, V2, type Request } from './execution-v2';

// Test-only independent business oracle: immutable baseline handler bodies,
// executed exclusively against fake eda. No legacy runtime bridge is shipped.
const source = execFileSync('git', ['show','a583bf731d946d2d39f1223e078d711bd41710d5:extension/src/actions.ts'], {encoding:'utf8'});
const oracleSource = source + '\nexport const baselineQueries = { "schematic.library.search": schematicLibrarySearch, "schematic.library.get_by_lcsc": schematicLibraryGetByLcscIds, "library.model3d.search": libraryModel3DSearch, "pcb.report": pcbReport, "pcb.outline.get": pcbOutlineGet };';
const baseline = new Module(path.join(__dirname, 'baseline-actions.test-only.ts'), module) as Module & {paths:string[];_compile(source:string,filename:string):void;exports:{baselineQueries:Record<string,(input:Record<string,unknown>)=>Promise<{result:unknown}>>}};
baseline.filename = path.join(__dirname, 'baseline-actions.test-only.ts');
baseline.paths = module.paths;
baseline._compile(ts.transpileModule(oracleSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText, baseline.filename);
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
async function equivalent(action:string,input:Record<string,unknown>,hostFactory:()=>unknown){
 (globalThis as unknown as {eda:unknown}).eda=hostFactory();
 const expected=await baseline.exports.baselineQueries[action](input);
 (globalThis as unknown as {eda:unknown}).eda=hostFactory();
 const request:Request={protocol:V2,action,action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input,budget_ms:1000};
 const result=await new ControlledExecutor(nativeAction,async()=>target).execute(request,'d');
 assert.equal(result.verification.verdict,'satisfied');assert.deepEqual(result.value,expected.result);
}
const devices=[{uuid:'resistor',name:'0402 resistor',supplierId:'C1',otherProperty:{Value:'100k'},description:'resistor'},{uuid:'capacitor',name:'100nF 0402',supplierId:'C2',otherProperty:{Value:'100nF'},description:'capacitor'}];
test('baseline-equivalent device search ranking and compact output',()=>equivalent('schematic.library.search',{query:'100nF 0402'},()=>({lib_Device:{search:async()=>devices}})));
test('baseline-equivalent exact LCSC search',()=>equivalent('schematic.library.search',{query:'C2'},()=>({lib_Device:{search:async()=>devices}})));
test('baseline-equivalent LCSC scalar, notFound and projected fields',()=>equivalent('schematic.library.get_by_lcsc',{lcscIds:'C2'},()=>({lib_Device:{getByLcscIds:async()=>[devices[1]]}})));
test('baseline-equivalent model search classification and limit',()=>equivalent('library.model3d.search',{query:'case',libraryUuid:'lib',classification:['Mechanical'],limit:2},()=>({lib_3DModel:{search:async(q:string,lib:string,classification:string[],limit:number)=>[{uuid:'m',name:q,libraryUuid:lib,classification,limit}]}})));
test('baseline-equivalent scoped net report and unavailable lengths',()=>equivalent('pcb.report',{nets:['A','B']},()=>({pcb_Net:{getNetLength:async(n:string)=>n==='A'?12:undefined},pcb_Drc:{getAllDifferentialPairs:async()=>[],getAllEqualLengthNetGroups:async()=>[]}})));
test('baseline-equivalent empty outline shape',()=>equivalent('pcb.outline.get',{},()=>({pcb_PrimitivePolyline:{getAll:async()=>[]},pcb_PrimitiveLine:{getAll:async()=>[]},pcb_PrimitiveArc:{getAll:async()=>[]}})));
