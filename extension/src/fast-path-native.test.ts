/// <reference types="@jlceda/pro-api-types" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { runAction } from './actions';
import { nativePort } from './fast-path-native';
import { FastPath } from './fast-path';

function mockEDA() {
 const lines: Record<string,Function>[]=[];const vias: Record<string,Function>[]=[];let id=0;let pinReads=0;let netReads=0;
 const pad=(i:number)=>({getState_PrimitiveId:()=>`p${i}`,getState_Pad:()=>['RECT',20,20,0],getState_Rotation:()=>0,getState_Hole:()=>null,getState_SpecialPad:()=>undefined,getState_X:()=>i*100,getState_Y:()=>0,getState_Net:()=>`N${i%2}`,getState_Layer:()=>1,getState_PrimitiveLock:()=>false});
 const components=Array.from({length:32},(_,i)=>({getState_PrimitiveId:()=>`c${i}`,getState_Pads:()=>[{primitiveId:`p${i}`,net:`N${i%2}`,padNumber:'1'}],getState_Designator:()=>`U${i}`,getState_X:()=>i*100,getState_Y:()=>0,getState_Rotation:()=>0,getState_Layer:()=>1,getState_PrimitiveLock:()=>false}));
 const api={
  dmt_Project:{getCurrentProjectInfo:async()=>({uuid:'p'})},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'d',documentType:3,tabId:'tab'})},
  pcb_PrimitiveComponent:{getAll:async()=>components,getAllPinsByPrimitiveId:async()=>{pinReads++;throw new Error('forbidden per-component pin read')}},
  pcb_PrimitivePad:{getAll:async()=>[]},
  pcb_Net:{getAllPrimitivesByNet:async(net:string,types:string[])=>{netReads++;assert.deepEqual(types,['ComponentPad']);return Array.from({length:32},(_,i)=>i).filter(i=>`N${i%2}`===net).map(pad)}},
  pcb_PrimitiveLine:{getAll:async()=>lines,create:async(net:string,layer:number,x1:number,y1:number,x2:number,y2:number,width:number)=>{const key=`l${++id}`;const p={getState_PrimitiveId:()=>key,getState_Net:()=>net,getState_Layer:()=>layer,getState_StartX:()=>x1,getState_StartY:()=>y1,getState_EndX:()=>x2,getState_EndY:()=>y2,getState_LineWidth:()=>width,getState_PrimitiveLock:()=>false};lines.push(p);return p;},delete:async(ids:string[])=>{for(const id of ids){const i=lines.findIndex(p=>p.getState_PrimitiveId()===id);if(i>=0)lines.splice(i,1)}return true}},
  pcb_PrimitiveVia:{getAll:async()=>vias,create:async(net:string,x:number,y:number,hole:number,diameter:number)=>{const key=`v${++id}`;const p={getState_PrimitiveId:()=>key,getState_Net:()=>net,getState_X:()=>x,getState_Y:()=>y,getState_HoleDiameter:()=>hole,getState_Diameter:()=>diameter,getState_PrimitiveLock:()=>false};vias.push(p);return p;},delete:async()=>true},
  pcb_PrimitiveArc:{getAll:async()=>[]},pcb_PrimitiveFill:{getAll:async()=>[]},pcb_PrimitivePour:{getAll:async()=>[]},pcb_PrimitiveRegion:{getAll:async()=>[]},pcb_PrimitivePolyline:{getAll:async()=>[]},
  pcb_Layer:{getAllLayers:async()=>[{id:1,type:'SIGNAL',layerStatus:1},{id:2,type:'SIGNAL',layerStatus:2},{id:15,type:'SIGNAL',layerStatus:0},{id:3,type:'SILKSCREEN',layerStatus:1}]},pcb_Drc:{getCurrentRuleConfiguration:async()=>({})},
 };
 (globalThis as unknown as {eda:unknown}).eda=api;
 return {api,lines,vias,counts:()=>({pinReads,netReads})};
}
test('native bulk snapshot covers 32 components through 2 net reads, no per-component calls',async()=>{
 const m=mockEDA();const n=nativePort();const f=new FastPath();const s=await f.snapshot(n,{project_uuid:'p',document_uuid:'d'});
 assert.equal((s.result!.pads as unknown[]).length,32);assert.deepEqual(m.counts(),{pinReads:0,netReads:2});assert.deepEqual(s.result!.copper_layers,[1,2]);assert.equal(n.calls,17);
});
test('missing component pad is explicit unsupported evidence, never silent completeness',async()=>{
 const m=mockEDA();m.api.pcb_Net.getAllPrimitivesByNet=async()=>[];const data=await nativePort().read();assert.equal(data.pads.length,32);assert.ok(data.pads.every(p=>p.unsupported));
});
test('registered typed handler executes multiple native primitives in one action',async()=>{
 const m=mockEDA();const scope={project_uuid:'p',document_uuid:'d'};const s=await runAction('board.snapshot_compact',scope);
 const r=await runAction('route.apply_batch',{...scope,base_revision:s.result!.board_revision,plan_hash:'fixture-only',client_transaction_id:'native-fixture',expires_at_ms:Date.now()+60000,operations:[
  {type:'add_trace',net:'N0',layer:1,width:6,points:[[0,0],[100,0]]},
  {type:'add_trace',net:'N0',layer:2,width:6,points:[[100,0],[200,0]]},
  {type:'add_via',net:'N0',x:100,y:0,diameter:24,hole:12,from_layer:1,to_layer:2},
 ]});assert.equal(r.result!.status,'complete');assert.equal(m.lines.length,2);assert.equal(m.vias.length,1);assert.equal(m.counts().pinReads,0);
});
