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

// Captured through the installed 1.4.4 typed snapshot action, not debug.exec_js.
import hostCapture from '../../internal/fastpath/testdata/host-pad-identity.json';
function hostIdentityEDA(netFallback = false) {
 const m = mockEDA();
 const nativePads = hostCapture.result.pads.filter(p => 'bbox' in p).map(p => {
  const box = p.bbox!;
  // The Host capture contains projected boxes, not raw shape/hole getters.
  // RECT here reproduces that exact existing conservative projection; it does
  // not claim the physical pad is rectangular or infer plating from layer 12.
  return {getState_PrimitiveId:()=>p.id,getState_Pad:()=>['RECT',box[2]-box[0],box[3]-box[1],0],
   getState_Rotation:()=>0,getState_Hole:()=>null,getState_SpecialPad:()=>undefined,
   getState_X:()=>p.x!,getState_Y:()=>p.y!,getState_Net:()=>p.net,getState_Layer:()=>p.layer,
   getState_PrimitiveLock:()=>false};
 });
 const components = hostCapture.result.components.map(c => ({
  getState_PrimitiveId:()=>c.id,
  getState_Pads:()=>nativePads.filter(p=>p.getState_PrimitiveId().startsWith(c.id)).map(p=>({
   primitiveId:p.getState_PrimitiveId().slice(c.id.length),net:p.getState_Net(),padNumber:'1'})),
  getState_Designator:()=>c.designator,getState_X:()=>c.x,getState_Y:()=>c.y,
  getState_Rotation:()=>0,getState_Layer:()=>c.layer,getState_PrimitiveLock:()=>false,
 }));
 // Native mock signatures in the original helper intentionally use empty arrays.
 Object.assign(m.api.pcb_PrimitiveComponent,{getAll:async()=>components});
 Object.assign(m.api.pcb_PrimitivePad,{getAll:async()=>netFallback?[]:nativePads});
 Object.assign(m.api.pcb_Net,{getAllPrimitivesByNet:async(net:string)=>nativePads.filter(p=>p.getState_Net()===net)});
 return {m,nativePads,components};
}
for (const netFallback of [false,true]) test(`Host repeated footprint-local IDs normalize without phantom pads (net fallback=${netFallback})`,async()=>{
 const {m}=hostIdentityEDA(netFallback);const n=nativePort();
 const result=(await new FastPath().snapshot(n,{project_uuid:'p',document_uuid:'d'})).result!;
 const pads=result.pads as import('./fast-path').Primitive[];
 assert.equal(pads.length,16);assert.equal(new Set(pads.map(p=>p.id)).size,16);
 assert.equal(pads.filter(p=>p.layer===12).length,8);assert.equal(pads.filter(p=>p.layer===1).length,8);
 for(const p of pads){assert.ok(!p.unsupported);assert.ok(p.bbox);assert.ok(p.component_id);assert.ok(p.id.startsWith(p.component_id!));
  const original=hostCapture.result.pads.find(x=>x.id===p.id)!;
  p.bbox!.forEach((v,i)=>assert.ok(Math.abs(v-original.bbox![i])<1e-9));}
 assert.equal(m.counts().pinReads,0);assert.equal(n.calls,netFallback?23:15);
});
test('Host missing sibling is not satisfied by another footprint using the same local ID',async()=>{
 const {nativePads}=hostIdentityEDA();nativePads.splice(nativePads.findIndex(p=>p.getState_PrimitiveId()==='83fd60a94ced0019e12'),1);
 // Preserve declarations from before removal.
 const m=mockEDA();Object.assign(m.api.pcb_PrimitiveComponent,{getAll:async()=>[
  {getState_PrimitiveId:()=> '83fd60a94ced0019',getState_Pads:()=>[{primitiveId:'e12',net:'FP_OUT1'}],getState_Designator:()=> 'H2',getState_X:()=>0,getState_Y:()=>0,getState_Rotation:()=>0,getState_Layer:()=>1,getState_PrimitiveLock:()=>false},
 ]});Object.assign(m.api.pcb_PrimitivePad,{getAll:async()=>nativePads});Object.assign(m.api.pcb_Net,{getAllPrimitivesByNet:async()=>[]});
 const s=await nativePort().read();assert.ok(s.pads.some(p=>p.id==='83fd60a94ced0019:missing-pad:e12'&&p.unsupported));
});
test('matched Host IDs do not unlock genuinely unknown pad shapes',async()=>{
 const {nativePads}=hostIdentityEDA();nativePads[0].getState_Pad=()=>['UNKNOWN',20,20,0];
 const s=await nativePort().read();const p=s.pads.find(p=>p.id===nativePads[0].getState_PrimitiveId())!;
 assert.equal(p.unsupported,true);assert.equal(p.bbox,undefined);assert.ok(p.component_id);
});

test('special layer-dependent geometry stays unsupported after identity matching',async()=>{
 const {nativePads}=hostIdentityEDA();
 Object.assign(nativePads[0],{getState_SpecialPad:()=>[[1,2,['POLYGON',[0,0,10,10]]]]});
 const s=await nativePort().read();assert.equal(s.pads.find(p=>p.id===nativePads[0].getState_PrimitiveId())!.unsupported,true);
});
test('qualified declarations remain supported; net and native parent mismatch fail closed',async()=>{
 const {components,nativePads}=hostIdentityEDA();
 for(const c of components){const refs=c.getState_Pads().map(p=>({...p,primitiveId:c.getState_PrimitiveId()+p.primitiveId}));c.getState_Pads=()=>refs;}
 let s=await nativePort().read();assert.equal(s.pads.length,16);assert.ok(s.pads.every(p=>!p.unsupported&&p.component_id));
 nativePads[0].getState_Net=()=> 'WRONG_NET';
 Object.assign(nativePads[1],{getState_ParentComponentPrimitiveId:()=> 'WRONG_PARENT'});
 s=await nativePort().read();assert.equal(s.pads.filter(p=>p.unsupported).length,2);
});

test('ambiguous exact/local IDs and repeated missing declarations remain explicit',async()=>{
 const {nativePads,components}=hostIdentityEDA();
 const refs=components.map(c=>c.getState_Pads());
 components.forEach((c,i)=>{c.getState_Pads=()=>refs[i]});
 nativePads.splice(nativePads.findIndex(p=>p.getState_PrimitiveId()==='ea978d55bd99800de12'),1);
 nativePads.splice(nativePads.findIndex(p=>p.getState_PrimitiveId()==='83fd60a94ced0019e12'),1);
 let s=await nativePort().read();const missing=s.pads.filter(p=>p.unsupported);
 assert.equal(missing.length,2);assert.equal(new Set(missing.map(p=>p.id)).size,2);
 const m=mockEDA();const base=await m.api.pcb_Net.getAllPrimitivesByNet('N0',['ComponentPad']);
 const original=base[0];Object.assign(m.api.pcb_PrimitivePad,{getAll:async()=>[original,{...original,getState_PrimitiveId:()=> 'c0p0'}]});
 s=await nativePort().read();assert.ok(s.pads.some(p=>p.id==='c0:missing-pad:p0'&&p.unsupported));
});
