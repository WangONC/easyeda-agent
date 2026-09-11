import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {nativeAction} from './actions';
import {ControlledExecutor,V2,type Request} from './execution-v2';
const target={scope:'LIBRARY' as const,session:'s',activation:'a',library_uuid:'lib'};
for(const mode of ['normal','wrong-pin','missing-id','foreign-geometry','duplicate-id','bad-save','wrong-tab','target-drift','late','late-reject'] as const) test('symbol build full native boundary '+mode,async()=>{
 const rows:Record<string,any[]>={pins:[],outline:[],circles:[]};let mutations=0,saves=0,release!:()=>void;const nativeArgs:unknown[]=[];
 const create=async(kind:string,args:any[])=>{
  nativeArgs.push([kind,args]);mutations++;const id=mode==='duplicate-id'?'same':`${kind}-${mutations}`;
  if(kind==='outline'&&mode.startsWith('late')){await new Promise<void>(r=>release=r);if(mode==='late-reject')throw Error('late native rejection');}
  const x:any={getState_PrimitiveId:()=>id};
  if(kind==='outline')Object.assign(x,{getState_Line:()=>args[0],getState_FillColor:()=>args[2],getState_LineWidth:()=>args[3]});
  if(kind==='pins')Object.assign(x,{getState_X:()=>args[0],getState_Y:()=>args[1],getState_PinNumber:()=>args[2],getState_PinName:()=>mode==='wrong-pin'?'wrong':args[3],getState_Rotation:()=>args[4],getState_PinLength:()=>args[5],getState_PinShape:()=>args[7],getState_pinType:()=>args[8]});
  if(kind==='circles')Object.assign(x,{getState_CenterX:()=>args[0],getState_CenterY:()=>args[1],getState_Radius:()=>args[2],getState_FillColor:()=>args[4],getState_LineWidth:()=>args[5]});
  rows[kind].push(x);if(mode==='foreign-geometry'&&kind==='outline')rows[kind].push({...x,getState_PrimitiveId:()=> 'foreign'});
  return mode==='missing-id'?undefined:x;
 };
 const port=(kind:string)=>({getAll:async()=>rows[kind],get:async(ids:string|string[])=>Array.isArray(ids)?rows[kind].filter(x=>ids.includes(x.getState_PrimitiveId())):rows[kind].find(x=>x.getState_PrimitiveId()===ids),create:async(...a:any[])=>create(kind,a),delete:async(ids:string[])=>{mutations++;rows[kind]=rows[kind].filter(x=>!ids.includes(x.getState_PrimitiveId()));return true;}});
 (globalThis as any).eda={lib_Symbol:{get:async()=>({uuid:'asset'}),openInEditor:async()=> 'tab'},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'asset',tabId:mode==='wrong-tab'?'elsewhere':'tab',documentType:2})},sch_PrimitivePin:port('pins'),sch_PrimitivePolygon:port('outline'),sch_PrimitiveCircle:port('circles'),sch_Document:{save:async()=>{saves++;return mode==='bad-save'?undefined:true;}}};
 const request:Request={protocol:V2,action:'library.symbol.build',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{uuid:'asset',libraryUuid:'lib',pins:[{x:0,y:0,number:'1',name:'P'}],outline:[0,0,20,0,20,20,0,20],circles:[{centerX:10,centerY:10,radius:2}]},budget_ms:mode.startsWith('late')?5:1000};
 const ex=new ControlledExecutor(nativeAction,async()=>mode==='target-drift'?{...target,library_uuid:'other'}:target);
 const pending=ex.execute(request,'digest');
 if(mode.startsWith('late')){await new Promise(r=>setTimeout(r,20));assert.ok(release);await assert.rejects(ex.execute({...request,operation_id:'second'},'d2'),/BARRIER/);release();}
 const h=await pending;assert.equal(h.verification.verdict==='satisfied',mode==='normal');
 if(mode==='normal'){assert.equal(mutations,3);assert.equal(saves,1);assert.deepEqual((h.value as any).created,{pins:['pins-2'],outline:'outline-1',circles:['circles-3']});}
 if(mode==='wrong-tab'||mode==='target-drift')assert.equal(mutations,0);
 if(mode.startsWith('late')){assert.equal(mutations,1);assert.equal(saves,0);assert.equal(h.effects.reconciled,true);}
 const before=mutations;await ex.execute(request,'digest');await assert.rejects(ex.execute(request,'foreign'),/CONFLICT/);if(mode==='duplicate-id')await assert.rejects(ex.reconcile('o'),/AMBIGUOUS/);else if(mode==='wrong-tab')await assert.rejects(ex.reconcile('o'),/EDITOR_IDENTITY/);else if(mode!=='target-drift')await ex.reconcile('o');assert.equal(mutations,before);
 if(mode==='normal'){
  const source=execFileSync('git',['show','a583bf731d946d2d39f1223e078d711bd41710d5:extension/src/actions.ts'],{encoding:'utf8'})+'\nexport const oracle=HANDLERS;';
  const baseline=new Module(path.join(__dirname,'symbol-baseline.test-only.ts'),module) as any;baseline.filename=path.join(__dirname,'symbol-baseline.test-only.ts');baseline.paths=module.paths;
  baseline._compile(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,baseline.filename);
  const acceptedArgs=JSON.parse(JSON.stringify(nativeArgs));mutations=0;saves=0;nativeArgs.length=0;for(const k of Object.keys(rows))rows[k]=[];
  const old=await baseline.exports.oracle['library.symbol.build'](request.input);
  assert.deepEqual(nativeArgs,acceptedArgs,'baseline optional/default/native arguments');
  const {rollback,...value}=h.value as any;assert.deepEqual(value,old.result,'baseline business output');assert.equal(saves,1);
 }
});
