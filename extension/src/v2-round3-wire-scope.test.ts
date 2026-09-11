import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeAction,planSchDeleteCascadeTrees} from './actions';
import {ControlledExecutor,V2,type Request} from './execution-v2';
import {nativeWireSegments} from './wire-geometry';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'schematic',tab_id:'t'};
const line=[80,50,80,100,320,50,80,50,320,100,320,50];
for(const corruption of [false,true])test('disconnect native segment scope excludes fabricated diagonal '+corruption,async()=>{
 let wires=[{id:'wire',line:[...line]},{id:'other',line:[500,0,510,0]}],writes=0;
 let flags=[{id:'on',x:200,y:50},{id:'off',x:200,y:75}];
 const wrap=(w:typeof wires[number])=>({getState_PrimitiveId:()=>w.id,getState_Line:()=>w.line,getState_Net:()=> 'GND',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 (globalThis as any).eda={sch_PrimitiveWire:{getAll:async()=>wires.map(wrap),delete:async(ids:string[])=>{writes++;wires=wires.filter(w=>!ids.includes(w.id));if(corruption)wires[0].line=[500,0,520,0];return true;}},sch_PrimitiveComponent:{getAll:async()=>flags.map(f=>({getState_PrimitiveId:()=>f.id,getState_ComponentType:()=> 'netflag',getState_X:()=>f.x,getState_Y:()=>f.y})),delete:async(ids:string[])=>{writes++;flags=flags.filter(f=>!ids.includes(f.id));return true;}}};
 const req:Request={protocol:V2,action:'schematic.pin.disconnect',action_revision:'1',schema:'s',request_id:'r',operation_id:'o',target_ref:target,input:{pinX:80,pinY:100},budget_ms:1000};
 const ex=new ControlledExecutor(nativeAction,async()=>target),result=await ex.execute(req,'d');
 assert.equal(result.verification.verdict,corruption?'unavailable':'satisfied');assert.deepEqual(flags.map(f=>f.id),['off'],'phantom diagonal must not select an unrelated flag');
 await ex.reconcile('o');await ex.execute(req,'d');assert.equal(writes,2);
});
test('cascade native segment scope does not absorb phantom diagonal marker or survivor',()=>{
 const segments=nativeWireSegments(line);
 const result=planSchDeleteCascadeTrees([{id:'part',pins:[{x:80,y:100}]}],[{id:'wire',points:segments.flat(),segments}],[{id:'on',x:200,y:50},{id:'off',x:200,y:75}],[{x:200,y:75}]);
 assert.deepEqual(result,[{wireIds:['wire'],flagIds:['on'],ownerIds:['part']}]);
 assert.deepEqual(planSchDeleteCascadeTrees([{id:'part',pins:[{x:80,y:100}]}],[{id:'wire',points:segments.flat(),segments}],[],[{x:200,y:50}]),[],'real shared-wire survivor prevents cascade');
});
