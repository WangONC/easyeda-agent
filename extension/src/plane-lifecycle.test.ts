import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshPlanes} from './plane-lifecycle';
test('logical plane resolves current ID after rebuild, reports failures and never claims connectivity',async()=>{
 let id='p1';let rebuilds=0;
 const pour=()=>({getState_PrimitiveId:()=>id,getState_PourName:()=> 'GND@L2',getState_Net:()=> 'GND',getState_Layer:()=>2,
  rebuildCopperRegion:async()=>{rebuilds++;id=`p${rebuilds+1}`;return {}}});
 (globalThis as unknown as {eda:unknown}).eda={dmt_Project:{getCurrentProjectInfo:async()=>({uuid:'plane-test'})},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'pcb',documentType:3})},pcb_PrimitivePour:{getAll:async()=>[pour()]}};
 const p={project_uuid:'plane-test',document_uuid:'pcb',logical_ids:['GND@L2']};
 const r=await refreshPlanes(p);assert.equal(r.status,'complete');assert.equal(r.item_results[0].previous_native_id,'p1');assert.equal(r.item_results[0].current_native_id,'p2');assert.equal(r.item_results[0].recreated,true);assert.equal(r.item_results[0].connectivity,'unknown');assert.equal(r.revision,null);
 const next=await refreshPlanes({...p,logical_ids:['GND@L2','missing']});assert.equal(next.status,'partial');assert.equal(next.item_results[0].current_native_id,'p3');assert.match(next.item_results[1].failure_reason!,/not found/);assert.equal(rebuilds,2);
 await assert.rejects(refreshPlanes({...p,document_uuid:'wrong'}),/exact active/);assert.equal(rebuilds,2);
});

test('document drift during rebuild stops remaining items and does not read another PCB',async()=>{
 let doc='original',rebuilds=0,reads=0;
 const pour=(name:string)=>({getState_PrimitiveId:()=>name,getState_PourName:()=>name,getState_Net:()=> 'GND',getState_Layer:()=>1,
  rebuildCopperRegion:async()=>{rebuilds++;doc='other';return {}}});
 (globalThis as unknown as {eda:unknown}).eda={dmt_Project:{getCurrentProjectInfo:async()=>({uuid:'drift-project'})},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:doc,documentType:3})},pcb_PrimitivePour:{getAll:async()=>{reads++;assert.equal(doc,'original');return [pour('a'),pour('b')]}}};
 const r=await refreshPlanes({project_uuid:'drift-project',document_uuid:'original',logical_ids:['a','b']});
 assert.equal(rebuilds,1);assert.equal(reads,1);assert.equal(r.item_results[0].status,'uncertain');assert.equal(r.item_results[0].current_native_id,null);assert.equal(r.item_results[1].status,'not_started');
});
