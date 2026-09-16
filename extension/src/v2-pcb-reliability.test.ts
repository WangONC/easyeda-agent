import test from 'node:test';
import assert from 'node:assert/strict';
import {ControlledExecutor,V2,type Request} from './execution-v2';
import {placementBatch} from './v2-placement-batch';
import {addPcbComponentsBatch} from './v2-add-pcb-components-batch';
import {nativeAction} from './actions';
import {wireCreate} from './v2-native-actions';
import type {NativePort,Observation,Placement} from './fast-path';

const pcbTarget={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'pcb-reliability',document_type:'pcb',tab_id:'t'};
const request=(action:string,operation_id:string,input:Record<string,unknown>,target:any=pcbTarget):Request=>({protocol:V2,action,action_revision:'1',schema:'test',request_id:operation_id,operation_id,target_ref:target,input,budget_ms:3000});
function placementPort(failSecond=false){
 const rows=[{id:'a',kind:'component',x:10,y:10,rotation:0,layer:1,locked:false,bbox:[8,8,12,12]},{id:'b',kind:'component',x:30,y:30,rotation:0,layer:1,locked:false,bbox:[28,28,32,32]}] as any[];let writes=0;
 const n:NativePort={calls:0,context:async()=>({projectUuid:'p',documentUuid:'pcb-reliability',documentType:'pcb',tabId:'t'}),read:async()=>({components:structuredClone(rows),pads:[],traces:[],vias:[],fills:[],copper_layers:[1,2]} as Observation),create:async()=>undefined,remove:async()=>false,place:async(p:Placement)=>{writes++;if(failSecond&&p.primitiveId==='b')throw Error('native failure');const x=rows.find(q=>q.id===p.primitiveId)!;Object.assign(x,p,{id:p.primitiveId,kind:'component'});x.bbox=[p.x-2,p.y-2,p.x+2,p.y+2]}};return{n,get writes(){return writes}};
}
test('placement batch applies exact poses once and verifies fresh state',async()=>{
 const mock=placementPort(),f=()=>mock.n,before=(await (await import('./fast-path')).fastPath.snapshotData(mock.n,{project_uuid:'p',document_uuid:'pcb-reliability'})).data.board_revision;
 const input={base_revision:before,plan_hash:'plan',client_transaction_id:'place-ok',placements:[{primitiveId:'a',x:15,y:16,rotation:450,layer:2,locked:true}]};
 const ex=new ControlledExecutor(()=>placementBatch(f),async()=>pcbTarget),r=await ex.execute(request('placement.apply_batch','place-ok',input),'d');
 assert.equal(r.verification.verdict,'satisfied');assert.equal((r.value as any).readback_verified,true);await ex.reconcile('place-ok');await ex.execute(request('placement.apply_batch','place-ok',input),'d');assert.equal(mock.writes,1);
});
test('placement batch partial is never replayed',async()=>{
 const mock=placementPort(true),before=(await (await import('./fast-path')).fastPath.snapshotData(mock.n,{project_uuid:'p',document_uuid:'pcb-reliability'})).data.board_revision;
 const input={base_revision:before,plan_hash:'plan',client_transaction_id:'place-partial',placements:[{primitiveId:'a',x:15,y:16,rotation:0,layer:1},{primitiveId:'b',x:35,y:36,rotation:0,layer:1}]};
 const ex=new ControlledExecutor(()=>placementBatch(()=>mock.n),async()=>pcbTarget),req=request('placement.apply_batch','place-partial',input),r=await ex.execute(req,'d');
 assert.equal(r.verification.verdict,'partial');const writes=mock.writes;await ex.reconcile('place-partial');await ex.execute(req,'d');assert.equal(mock.writes,writes);
});
test('placement stale revision rejects before native mutation',async()=>{
 const mock=placementPort(),input={base_revision:'stale',plan_hash:'plan',client_transaction_id:'place-stale',placements:[{primitiveId:'a',x:15,y:16,rotation:0,layer:1}]};
 const r=await new ControlledExecutor(()=>placementBatch(()=>mock.n),async()=>pcbTarget).execute(request('placement.apply_batch','place-stale',input),'d');
 assert.equal(r.effects.effect_started,false);assert.equal(mock.writes,0);
});

test('add-components batch verifies exact identity and pad nets; duplicates reject before effect',async()=>{
 let rows:any[]=[],creates=0;const pads=new Map<string,any[]>();
 const component=(id:string,state:any)=>({getState_PrimitiveId:()=>id,getState_X:()=>state.x,getState_Y:()=>state.y,getState_Rotation:()=>state.rotation,getState_Layer:()=>state.layer,getState_Designator:()=>state.designator,getState_UniqueId:()=>state.uniqueId,getState_OtherProperty:()=>state.otherProperty});
 (globalThis as any).eda={lib_Device:{get:async(uuid:string,libraryUuid:string)=>({uuid,libraryUuid})},pcb_PrimitiveComponent:{getAll:async()=>rows.map(x=>x.comp),create:async(_d:any,layer:number,x:number,y:number,rotation:number)=>{creates++;const id='c'+creates,state={x,y,rotation,layer,designator:'?',uniqueId:'',otherProperty:{}};const comp=component(id,state);rows.push({id,state,comp});pads.set(id,[{getState_PrimitiveId:()=>id+'p1',getState_PadNumber:()=> '1',getState_Net:()=>rows.find(x=>x.id===id).net??''}]);return comp},modify:async(id:string,p:any)=>{const x=rows.find(q=>q.id===id);Object.assign(x.state,p);if(p.otherProperty)x.state.otherProperty=p.otherProperty;return x.comp},getAllPinsByPrimitiveId:async(id:string)=>pads.get(id)??[]},pcb_PrimitivePad:{modify:async(id:string,p:any)=>{const x=rows.find(q=>id===q.id+'p1');x.net=p.net}},pcb_Document:{startCalculatingRatline:async()=>true}};
 const item={libraryUuid:'lib',uuid:'dev',designator:'U1',uniqueId:'u1',channelId:'ch',nets:{'1':'N'},x:10,y:20,layer:1,rotation:0};
 const ex=new ControlledExecutor(()=>addPcbComponentsBatch(),async()=>pcbTarget),r=await ex.execute(request('pcb.add_components_batch','add-ok',{client_transaction_id:'add-ok',components:[item]}),'d');
 assert.equal(r.verification.verdict,'satisfied');assert.equal((r.value as any).unmatchedPads.length,0);assert.equal(creates,1);
 const unmatched={...item,designator:'U2',uniqueId:'u2',nets:{'9':'MISSING'}},partial=await new ControlledExecutor(()=>addPcbComponentsBatch(),async()=>pcbTarget).execute(request('pcb.add_components_batch','add-unmatched',{client_transaction_id:'add-unmatched',components:[unmatched]}),'u');
 assert.equal(partial.verification.verdict,'partial');assert.deepEqual((partial.value as any).unmatchedPads,[{designator:'U2',pad:'1'},{designator:'U2',pad:'9'}]);assert.equal(creates,2);
 const bad=await new ControlledExecutor(()=>addPcbComponentsBatch(),async()=>pcbTarget).execute(request('pcb.add_components_batch','dup',{client_transaction_id:'dup',components:[item,item]}),'x');
 assert.equal(bad.effects.effect_started,false);assert.equal(creates,2);
});

test('non-fuzzy library search drops zero-score candidates while fuzzy preserves them',async()=>{
 const target={...pcbTarget,document_type:'schematic' as const};(globalThis as any).eda={lib_Device:{search:async()=>[{uuid:'hit',name:'USB connector'},{uuid:'zero',name:'unrelated regulator'}]}};
 for(const allowFuzzy of [false,true]){const r=await new ControlledExecutor(nativeAction,async()=>target).execute(request('schematic.library.search','s'+allowFuzzy,{query:'USB',allowFuzzy},target),'d'+allowFuzzy);assert.deepEqual((r.value as any).components.map((x:any)=>x.uuid),allowFuzzy?['hit','zero']:['hit'])}
});
test('schematic read separates explicit NC from true floating pins',async()=>{
 const target={...pcbTarget,document_type:'schematic' as const};const pins=[['1',true],['2',false]].map(([n,nc])=>({getState_PinNumber:()=>n,getState_PinName:()=>n,getState_NoConnected:()=>nc}));
 const comp={getState_PrimitiveId:()=> 'c',getState_Designator:()=> 'U1',getState_UniqueId:()=> 'u',getState_ComponentType:()=> 'component',getState_Name:()=> 'part',getState_Footprint:()=>'',getState_SupplierId:()=>'',getState_X:()=>0,getState_Y:()=>0};
 (globalThis as any).eda={sch_PrimitiveComponent:{getAll:async()=>[comp],getAllPinsByPrimitiveId:async()=>pins},sch_ManufactureData:{getNetlistFile:async()=>({text:async()=>JSON.stringify({components:{c:{props:{Designator:'U1'},pinInfoMap:{p1:{number:'1',net:''},p2:{number:'2',net:''}}}}})})}};
 const r=await new ControlledExecutor(nativeAction,async()=>target).execute(request('schematic.read','read',{includeCheck:false},target),'d');assert.deepEqual((r.value as any).noConnectPins,['U1.1']);assert.deepEqual((r.value as any).floatingPins,['U1.2']);
});
test('wire create stabilizes returned identity then performs only one strict full scan with realistic inventory',async()=>{
 let created=false,published=false,creates=0,getAll=0,gets=0;const wrap=(id:string,line:number[],net:string)=>({getState_PrimitiveId:()=>id,getState_Line:()=>line,getState_Net:()=>net,getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 const existing=Array.from({length:100},(_,i)=>wrap('old'+i,[i*10,0,i*10+5,0],'N'+i)),fresh=wrap('new',[0,10,100,10],'SIG');
 (globalThis as any).eda={sch_PrimitiveWire:{getAll:async()=>{getAll++;return[...existing,...(published?[fresh]:[])]},create:async()=>{creates++;created=true;return fresh},get:async()=>{gets++;if(created&&gets>=3)published=true;return published?fresh:undefined}}};
 const target={...pcbTarget,document_type:'schematic' as const};const r=await new ControlledExecutor(()=>wireCreate,async()=>target).execute(request('schematic.wire.create','wire',{points:[0,10,100,10],net:'SIG'},target),'d');
 assert.equal(r.verification.verdict,'satisfied');assert.equal(creates,1);assert.equal(getAll,2);assert.equal(gets,3);
});
