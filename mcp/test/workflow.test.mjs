import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkflowArgs,toMcpResult,easyedaBinary,buildReloadArgs} from '../src/core.mjs';
import {runWorkflow} from '../src/workflow.mjs';
const scope={project:'P',doc:'PCB'};
test('assembly and tier map to existing CLI without bypass',()=>{
 for(const profile of ['hand-solder','reflow']) assert.deepEqual(buildWorkflowArgs({...scope,operation:'set_assembly',profile}),['--project','P','--doc','PCB','pcb','stage','set-assembly','--profile',profile]);
 assert.throws(()=>buildWorkflowArgs({...scope,operation:'set_assembly',profile:'unknown'}),/profile/);
 assert.throws(()=>buildWorkflowArgs({...scope,operation:'advance',force:true}),/unsupported/);
 assert.throws(()=>buildWorkflowArgs({...scope,operation:'advance',minScore:NaN}),/minScore/);
 assert.throws(()=>buildWorkflowArgs({project:'P',operation:'advance'}),/doc/);
 assert.deepEqual(buildWorkflowArgs({...scope,operation:'confirm_tier',tier:2,parts:['H1','H2']}),['--project','P','--doc','PCB','pcb','stage','confirm-tier','2','--parts','H1','--parts','H2']);
 assert.throws(()=>buildWorkflowArgs({...scope,operation:'confirm_tier',tier:2,parts:['H1'],empty:true}),/mutually/);
});
test('workflow results return Go status compactly, including command failures',async()=>{
 for(const ok of [true,false]) {
  const calls=[];const state={assembly:{profile:'hand-solder'},routeAllowed:ok,missing:ok?[]:['outline_confirmed']};
  const result=await runWorkflow({...scope,operation:'advance'},async args=>{calls.push(args);return calls.length===1?{ok,result:'gate details',error:{message:'blocked'}}:{ok:true,result:state};});
  const mcp=toMcpResult(result,{compact:true,structuredErrors:true});
  assert.equal(mcp.isError,!ok);assert.deepEqual(mcp.structuredContent.state,state);
  assert.equal(mcp.content[0].text.includes('\n'),false);
  assert.deepEqual(calls[1],['--project','P','--doc','PCB','workflow','status','--json']);
 }
});
test('explicit CLI path is preserved',()=>{
 const previous=process.env.EASYEDA_BIN;try{process.env.EASYEDA_BIN='C:/workspace build/easyeda.exe';assert.equal(easyedaBinary(),process.env.EASYEDA_BIN);}finally{if(previous===undefined)delete process.env.EASYEDA_BIN;else process.env.EASYEDA_BIN=previous;}
});

test('reload is a fixed CLI recovery operation, not an arbitrary script',()=>{
 assert.deepEqual(buildReloadArgs(scope),['--project','P','doc','reload','PCB','--json']);
 assert.throws(()=>buildReloadArgs({...scope,code:'anything'}),/unsupported/);
});
