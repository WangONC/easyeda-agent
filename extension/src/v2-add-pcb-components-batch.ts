import { type NativeAction, unavailable } from './execution-v2';
import { canonical, normalizeRotation } from './fast-path';
import { array, declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';

type Item={libraryUuid:string;uuid:string;designator:string;uniqueId:string;channelId?:string;nets:Record<string,string>;pin_nets?:Record<string,string>;pin_to_pad_map?:Record<string,string>;x:number;y:number;layer:number;rotation:number};
const finite=(x:unknown)=>typeof x==='number'&&Number.isFinite(x);
function validateItems(value:unknown):asserts value is Item[]{
 if(!Array.isArray(value)||value.length<1||value.length>256)throw Error('INVALID_COMPONENT_BATCH');
 const designators=new Set<string>(),uniqueIds=new Set<string>();
 for(const raw of value){const x=raw as Item;if(!x||typeof x!=='object'||typeof x.libraryUuid!=='string'||!x.libraryUuid||typeof x.uuid!=='string'||!x.uuid||typeof x.designator!=='string'||!x.designator||typeof x.uniqueId!=='string'||!x.uniqueId||
  (x.channelId!==undefined&&(typeof x.channelId!=='string'||!x.channelId))||!x.nets||typeof x.nets!=='object'||Array.isArray(x.nets)||Object.keys(x.nets).length<1||Object.entries(x.nets).some(([pad,net])=>!pad||typeof net!=='string')||
  !finite(x.x)||!finite(x.y)||!finite(x.rotation)||!Number.isInteger(x.layer)||(x.layer!==1&&x.layer!==2)||designators.has(x.designator)||uniqueIds.has(x.uniqueId))throw Error('INVALID_COMPONENT_BATCH');
  if(Object.keys(x).some(k=>!['libraryUuid','uuid','designator','uniqueId','channelId','nets','pin_nets','pin_to_pad_map','x','y','layer','rotation'].includes(k)))throw Error('INVALID_COMPONENT_BATCH');
  const hasPinNets=x.pin_nets!==undefined,hasPinMap=x.pin_to_pad_map!==undefined;
  if(hasPinNets!==hasPinMap)throw Error('INVALID_PIN_PAD_MAPPING');
  if(hasPinMap){
   if(!x.pin_nets||!x.pin_to_pad_map||Array.isArray(x.pin_nets)||Array.isArray(x.pin_to_pad_map)||!Object.keys(x.pin_to_pad_map).length||Object.keys(x.pin_to_pad_map).length!==Object.keys(x.pin_nets).length)throw Error('INVALID_PIN_PAD_MAPPING');
   for(const [pin,pad] of Object.entries(x.pin_to_pad_map)){
    if(!pin||typeof pad!=='string'||!pad||typeof x.pin_nets[pin]!=='string'||typeof x.nets[pad]!=='string'||x.pin_nets[pin]!==x.nets[pad])throw Error('INVALID_PIN_PAD_MAPPING');
   }
  }
  designators.add(x.designator);uniqueIds.add(x.uniqueId);x.rotation=normalizeRotation(x.rotation);
 }
}
const state=(x:IPCB_PrimitiveComponent)=>canonical([x.getState_PrimitiveId(),x.getState_Component?.(),x.getState_Footprint?.(),x.getState_X(),x.getState_Y(),normalizeRotation(x.getState_Rotation()),Number(x.getState_Layer()),x.getState_Designator(),x.getState_UniqueId(),x.getState_OtherProperty()?.['Channel ID']]);

export function addPcbComponentsBatch():NativeAction{
 return{mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{declaredReadFields('pcb.add_components_batch')(p);validateItems(p.components)},run:async c=>{
  const p=c.request.input;if(p.client_transaction_id!==c.request.operation_id)throw Error('V2_TRANSACTION_ID_MISMATCH');validateItems(p.components);const items=p.components;
  const sources=await Promise.all(items.map(x=>eda.lib_Device.get(x.uuid,x.libraryUuid)));
  if(sources.some((x,i)=>!x||x.uuid!==items[i].uuid||x.libraryUuid!==items[i].libraryUuid||!x.association?.footprint?.uuid||!x.association.footprint.libraryUuid))throw Error('V2_SOURCE_IDENTITY');
  const pull=()=>eda.pcb_PrimitiveComponent.getAll(),before=array(await pull()),old=new Map(before.map(x=>[x.getState_PrimitiveId(),state(x)]));
  if(items.some(q=>before.some(x=>x.getState_Designator()===q.designator||x.getState_UniqueId()===q.uniqueId)))throw Error('V2_DUPLICATE_COMPONENT_IDENTITY');
  const created=new Map<number,string>(),attempted=new Set<number>(),errors=new Map<number,string>();let failed:number|null=null;
  c.prepare(async()=>{
   const after=array(await pull()),now=new Map(after.map(x=>[x.getState_PrimitiveId(),x]));
   const foreign=after.some(x=>!old.has(x.getState_PrimitiveId())&&![...created.values()].includes(x.getState_PrimitiveId()));
   const oldChanged=[...old].some(([id,s])=>!now.has(id)||state(now.get(id)!)!==s);
   const results=[] as Array<Record<string,unknown>>;let satisfied=0;
   for(let i=0;i<items.length;i++){const q=items[i],id=created.get(i),comp=id?now.get(id):undefined,unmatched:string[]=[];let ok=!!comp;
    const pads=comp?array(await eda.pcb_PrimitiveComponent.getAllPinsByPrimitiveId(id!)):[];
    const actualNumbers=new Set(pads.map(x=>String(x.getState_PadNumber()))),requestedNumbers=new Set(Object.keys(q.nets));
    for(const number of actualNumbers)if(!requestedNumbers.has(number)){unmatched.push(number);ok=false}
    for(const [number,net] of Object.entries(q.nets)){const found=pads.filter(x=>String(x.getState_PadNumber())===number);if(!found.length||found.some(x=>x.getState_Net()!==net)){unmatched.push(number);ok=false}}
    const source=comp?.getState_Component?.(),footprint=comp?.getState_Footprint?.(),expectedFootprint=sources[i]!.association.footprint!;
    const sourceOK=!!source&&source.uuid===q.uuid&&source.libraryUuid===q.libraryUuid&&!!footprint&&footprint.uuid===expectedFootprint.uuid&&footprint.libraryUuid===expectedFootprint.libraryUuid;
    const relations=Object.entries(q.pin_to_pad_map??Object.fromEntries(Object.keys(q.nets).map(pad=>[pad,pad]))).map(([pin,pad])=>({pin,pad,net:(q.pin_nets??q.nets)[pin],pad_net:q.nets[pad],verified:actualNumbers.has(pad)&&pads.filter(x=>String(x.getState_PadNumber())===pad).every(x=>x.getState_Net()===q.nets[pad])}));
    if(relations.some(x=>!x.verified))ok=false;
    ok=ok&&sourceOK&&comp!.getState_X()===q.x&&comp!.getState_Y()===q.y&&normalizeRotation(comp!.getState_Rotation())===q.rotation&&Number(comp!.getState_Layer())===q.layer&&comp!.getState_Designator()===q.designator&&comp!.getState_UniqueId()===q.uniqueId&&(q.channelId===undefined||comp!.getState_OtherProperty()?.['Channel ID']===q.channelId);
    if(ok)satisfied++;results.push({index:i,primitiveId:id??null,designator:q.designator,uniqueId:q.uniqueId,libraryUuid:q.libraryUuid,deviceUuid:q.uuid,footprint:{uuid:expectedFootprint.uuid,libraryUuid:expectedFootprint.libraryUuid},mapping_source:q.pin_to_pad_map?'explicit':'identity',pin_pad_relations:relations,status:ok?'applied':attempted.has(i)?'failed':'skipped',unmatchedPads:[...new Set(unmatched)].sort(),error:errors.get(i)});
   }
   const value={status:!foreign&&!oldChanged&&satisfied===items.length?'complete':failed===null?'uncertain':'partial',applied:results.filter(x=>x.status==='applied').map(x=>x.primitiveId),failed:results.filter(x=>x.status==='failed').map(x=>x.designator),skipped:results.filter(x=>x.status==='skipped').map(x=>x.designator),item_results:results,unmatchedPads:results.flatMap(x=>(x.unmatchedPads as string[]).map(pad=>({designator:x.designator,pad}))),pin_pad_relations:results.flatMap(x=>(x.pin_pad_relations as unknown[]).map(relation=>({designator:x.designator,...relation as object}))),readback_verified:!foreign&&!oldChanged&&satisfied===items.length};
   if(foreign||oldChanged||[...attempted].some(i=>!created.has(i)))return{value,changed:null,verification:unavailable()};
   return covered(value,items.length,satisfied,created.size>0,['fresh_exact_device_library_identity','fresh_exact_device_footprint_association','fresh_exact_schematic_pcb_identity','fresh_explicit_pin_to_pad_relation','fresh_exact_pad_number_net_mapping','unrelated_components_unchanged','no_foreign_created_component']);
  });
  for(let i=0;i<items.length;i++){const q=items[i];try{
   await c.effect(async()=>{attempted.add(i);const made=await eda.pcb_PrimitiveComponent.create({libraryUuid:q.libraryUuid,uuid:q.uuid},q.layer as TPCB_LayersOfComponent,q.x,q.y,q.rotation,false);const id=made?.getState_PrimitiveId();if(!id||old.has(id)||[...created.values()].includes(id))throw Error('V2_CREATED_COMPONENT_IDENTITY');created.set(i,id)});
   const id=created.get(i)!;const fresh=()=>pull().then(xs=>array(xs).find(x=>x.getState_PrimitiveId()===id));
   const comp=await fresh();if(!comp)throw Error('V2_CREATED_COMPONENT_ABSENT');
   await c.effect(()=>eda.pcb_PrimitiveComponent.modify(id,{designator:q.designator,uniqueId:q.uniqueId,...(q.channelId===undefined?{}:{otherProperty:{...comp.getState_OtherProperty(),'Channel ID':q.channelId}})}));
   const pads=array(await eda.pcb_PrimitiveComponent.getAllPinsByPrimitiveId(id));
   for(const [number,net] of Object.entries(q.nets)){const matches=pads.filter(x=>String(x.getState_PadNumber())===number);if(!matches.length)continue;for(const pad of matches)await c.effect(()=>eda.pcb_PrimitivePad.modify(pad.getState_PrimitiveId(),{net}))}
  }catch(e){failed=i;errors.set(i,String(e));break}}
  if(failed===null)try{await c.effect(()=>eda.pcb_Document.startCalculatingRatline())}catch{/* verification is authoritative */}
  return c.verify();
 }};
}
