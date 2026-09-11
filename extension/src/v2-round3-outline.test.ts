import test from 'node:test';
import assert from 'node:assert/strict';
import {sameClosedOutline} from './v2-outline-geometry';
import {outline} from './v2-outline-actions';
import {ControlledExecutor,V2,type Request} from './execution-v2';
const expected=[0,0,'L',600,0,600,400,0,400,0,0];
test('outline winding/start changes preserve exact boundary, not bbox',()=>{
 assert.equal(sameClosedOutline([0,0,'L',0,400,600,400,600,0,0,0],expected),true);
 assert.equal(sameClosedOutline([600,400,'L',0,400,0,0,600,0,600,400],expected),true);
 assert.equal(sameClosedOutline([0,0,'L',300,0,600,0,600,400,0,400,0,0],expected),true);
 for(const bad of [undefined,[],[0,0,'L',600,0,600,400,0,400],[0,0,'L',600,400,600,0,0,400,0,0],[0,0,'ARC',600,400,0,0],[0,0,'L',600,0,600,400,300,200,0,400,0,0]])assert.equal(sameClosedOutline(bad,expected),false);
});
for(const mode of ['reversed','wrong','foreign','late','target'] as const)test('outline controlled readback '+mode,async()=>{
 let made=false,writes=0,release!:()=>void;
 const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
 const source=mode==='wrong'?[0,0,'L',600,400,600,0,0,400,0,0]:[0,0,'L',0,400,600,400,600,0,0,0];
 const poly={getState_PrimitiveId:()=> 'outline',getState_Layer:()=>11,getState_Polygon:()=>({getSource:()=>source}),getState_LineWidth:()=>10,getState_PrimitiveLock:()=>true};
 (globalThis as any).eda={pcb_MathPolygon:{createPolygon:(s:unknown)=>({getSource:()=>s})},pcb_PrimitivePolyline:{getAll:async()=>made?(mode==='foreign'?[poly,{...poly,getState_PrimitiveId:()=> 'foreign'}]:[poly]):[],get:async()=>poly,create:async()=>{writes++;if(mode==='late')await new Promise<void>(r=>release=r);made=true;return poly;}},pcb_PrimitiveLine:{getAll:async()=>[]},pcb_PrimitiveArc:{getAll:async()=>[]},pcb_PrimitiveComponent:{getAll:async()=>[]},pcb_Document:{zoomToBoardOutline:async()=>true}};
 const req:Request={protocol:V2,action:'pcb.outline.set',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{points:[[0,0],[600,0],[600,400],[0,400]]},budget_ms:mode==='late'?5:1000};
 const ex=new ControlledExecutor(()=>outline('set',()=>true),async()=>mode==='target'?{...target,document_uuid:'foreign'}:target);
 const result=ex.execute(req,'d');if(mode==='late'){await new Promise(r=>setTimeout(r,20));assert.ok(release);await assert.rejects(ex.execute({...req,operation_id:'other'},'other'),/BARRIER/);release();}
 const h=await result;assert.equal(h.verification.verdict==='satisfied',mode==='reversed'||mode==='late');
 if(mode!=='target')await ex.reconcile('o');await ex.execute(req,'d');assert.equal(writes,mode==='target'?0:1);
});
