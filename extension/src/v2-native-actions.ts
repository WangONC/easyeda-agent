import { wireGeometry, wireSegments, wireAdditionProof, type WireSnapshot } from './wire-geometry';
import { fastPath } from './fast-path';
import { nativePort } from './fast-path-native';
import { verifySchematicPageName, waitSchematicPageSettle } from './schematic-readiness';
import v2Catalog from './v2-catalog.generated.json';
import { namespacedLibraryAssetName } from './library-asset-name';
import { titleBlockFieldApplied, isTitleBlockStructuralKey, type TitleBlockPatch } from './titleblock-fields';
import { normalizeWirePoints } from './util';
import { logicalPlaneId } from './plane-lifecycle';
import { fields, observed, unavailable, type NativeAction, type NativeContext, type Observation } from './execution-v2';
import { normalizePcbComponentPatch, serializePcbComponent, verifyPcbComponentPatch } from './pcb-component-patch';

export function read(query: (c: NativeContext) => Promise<unknown>, validate: NativeAction['validate'] = p=>fields(p,{})): NativeAction {
 return {mode:'V2_NATIVE',scope:'NONE',validate,run:async c=>{
  const value=await query(c);
  if(value===undefined || value===null) throw Error('V2_READ_UNAVAILABLE');
  return observed(value,['fresh_native_query']);
 }};
}
export function array<T>(value: T[] | undefined): T[] {
 if(!Array.isArray(value)) throw Error('V2_NATIVE_SHAPE'); return value;
}
export const projectList=read(async c=>{const p=c.request.input;const ids=array(await eda.dmt_Project.getAllProjectsUuid(p.team_uuid as string|undefined,p.folder_uuid as string|undefined,p.workspace_uuid as string|undefined));return {project_uuids:ids,scope:{team_uuid:p.team_uuid,folder_uuid:p.folder_uuid,workspace_uuid:p.workspace_uuid},scope_complete:'native_scope_only',session_token:c.request.target_ref.activation};},p=>fields(p,{team_uuid:'string',folder_uuid:'string',workspace_uuid:'string'}));
export const libraryList=read(async()=>{const [libraries,personalLibraryUuid,projectLibraryUuid,systemLibraryUuid]=await Promise.all([eda.lib_LibrariesList.getAllLibrariesList(),eda.lib_LibrariesList.getPersonalLibraryUuid(),eda.lib_LibrariesList.getProjectLibraryUuid(),eda.lib_LibrariesList.getSystemLibraryUuid()]);return {libraries:array(libraries),personalLibraryUuid:personalLibraryUuid??null,projectLibraryUuid:projectLibraryUuid??null,systemLibraryUuid:systemLibraryUuid??null};});
export function assetGet(kind:'symbol'|'footprint'|'device'|'model3d'): NativeAction {
 return read(async c=>{
  const id=c.request.input.uuid as string, lib=(c.request.input.libraryUuid as string|undefined)??c.request.target_ref.library_uuid;
  const asset=kind==='symbol'?await eda.lib_Symbol.get(id,lib):kind==='footprint'?await eda.lib_Footprint.get(id,lib):kind==='device'?await eda.lib_Device.get(id,lib):await eda.lib_3DModel.get(id,lib);
  if(!asset || asset.uuid!==id) throw Error('V2_ASSET_IDENTITY'); return {[kind==='model3d'?'model':kind]:asset};
 },p=>fields(p,{uuid:'string',libraryUuid:'string'},['uuid']));
}

export const componentModify: NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{
 fields(p,{primitiveId:'string',patch:'object'},['primitiveId','patch']);
 const patch=normalizePcbComponentPatch(p.patch as Record<string,unknown>);
 validateComponentPatch(patch);
 if(!Object.keys(patch).length) throw Error('V2_EMPTY_PATCH');
},run:async c=>{
 const id=c.request.input.primitiveId as string, patch=normalizePcbComponentPatch(c.request.input.patch as Record<string,unknown>);
 if(typeof patch.layer==='string')patch.layer=resolveV2Layer(patch.layer,array(await eda.pcb_Layer.getAllLayers()));
 const pull=async()=>{const x=await eda.pcb_PrimitiveComponent.get(id); if(!x || x.getState_PrimitiveId()!==id) throw Error('V2_OBJECT_IDENTITY'); const record=serializePcbComponent(x);if('manufacturer' in patch)record.manufacturer=x.getState_Manufacturer();if('supplier' in patch)record.supplier=x.getState_Supplier();if('otherProperty' in patch)record.otherProperty=x.getState_OtherProperty();return record;};
 const before=await pull(); const pre=verifyComponentNativePatch(patch,before);
 if(pre.unverified.length) return {changed:null,verification:unavailable()};
 if(pre.notApplied.length===0) return observed({component:before,applied:[],alreadySet:Object.keys(patch)},Object.keys(patch),false);
 c.prepare(async()=>{
 const after=await pull();const v=verifyComponentNativePatch(patch,after);
 const changed=JSON.stringify(before)!==JSON.stringify(after);
 return {value:{component:after,applied:v.applied,notApplied:v.notApplied},changed,evidence:{before,after},verification:{verdict:v.unverified.length?'unavailable':v.notApplied.length===0?'satisfied':changed?'partial':'unchanged',checked:Object.keys(patch),complete:v.unverified.length===0,required:Object.keys(patch).length,satisfied:v.applied.length,residual:v.notApplied.length}};
 });
 try { await c.effect(()=>eda.pcb_PrimitiveComponent.modify(id,patch as Parameters<typeof eda.pcb_PrimitiveComponent.modify>[1])); } catch { /* always fresh verify; no replay */ }
 let after=await pull(); let v=verifyComponentNativePatch(patch,after);
 if(v.notApplied.some(f=>f.field==='primitiveLock')) {
  // Preserve the proven Host lock workaround, through the same effect gate.
  try { const x=await eda.pcb_PrimitiveComponent.get(id); if(x) await c.effect(async()=>{x.setState_PrimitiveLock(patch.primitiveLock===true);await x.done();}); } catch { /* expired gate prevents late second write */ }
  after=await pull(); v=verifyComponentNativePatch(patch,after);
 }
 return c.verify();
}};
export async function verifyDrcReport(raw:unknown):Promise<Observation> {
 if(!Array.isArray(raw)) return {changed:null,verification:unavailable(),evidence:raw};
 const group=(v:unknown):boolean=>!!v && typeof v==='object' && typeof (v as {name?:unknown}).name==='string' && Array.isArray((v as {list?:unknown}).list);
 if(!raw.every(group)) return {changed:null,verification:unavailable(),evidence:raw};
 for(const g of raw)for(const n of g.list)if(!group(n)||!n.list.every((e:unknown)=>!!e&&typeof e==='object'&&'errorType' in e))return {changed:null,verification:unavailable(),evidence:raw};
 let binding:Record<string,unknown>|undefined;
 if(raw.some(v=>JSON.stringify(v).toLowerCase().includes('netlist')))try {
  const board=await eda.dmt_Board.getCurrentBoardInfo();
  if(board)binding={boardName:board.name,schematicUuid:board.schematic?.uuid??null,schematicName:board.schematic?.name??null,pcbUuid:board.pcb?.uuid??null,pcbName:board.pcb?.name??null,hint:'Netlist Error may indicate stale Board binding; verify the schematic UUID.'};
 }catch{/* Optional binding diagnostic cannot hide the completed report. */}
 return observed({design_pass:raw.length===0,passed:raw.length===0,violations:raw,...(binding?{binding}:{})},['verbose_drc_report_shape','design_verdict'],null);
}
export const pcbDrc:NativeAction={mode:'V2_NATIVE',scope:'NATIVE_RECOMPUTE',validate:p=>fields(p,{strict:'boolean'}),run:async c=>{
 let raw:unknown;
 // Register before native begins. Reconciliation validates the report produced
 // by this operation and freshly guards its target; it NEVER reruns recompute.
 c.prepare(()=>verifyDrcReport(raw));
 await c.effect(async()=>{raw=await eda.pcb_Drc.check(c.request.input.strict!==false,false,true);});
 return c.verify();
}};
export const symbolCreate = createLibraryAsset('symbol');
export const symbolDelete: NativeAction={mode:'V2_NATIVE',scope:'LIBRARY_ASSET',validate:p=>fields(p,{uuid:'string',libraryUuid:'string',expectedName:'string'},['uuid','expectedName']),run:async c=>{
 const id=c.request.input.uuid as string, lib=await boundLibrary(c), name=c.request.input.expectedName;
 const before=await eda.lib_Symbol.get(id,lib);
 if(before===undefined) return observed({uuid:id,libraryUuid:lib,name:c.request.input.expectedName,deleted:true,absent:true},['fresh_absence'],false);
 if(!before || before.uuid!==id || before.name!==name) throw Error('V2_ASSET_IDENTITY');
 c.prepare(async()=>{
 const after=await eda.lib_Symbol.get(id,lib); // exception is NOT absence
 if(after===undefined) return observed({uuid:id,libraryUuid:lib,name:c.request.input.expectedName,deleted:true,absent:true},['fresh_absence'],true);
 return {changed:null,verification:unavailable(),evidence:after};
 });
 try { await c.effect(()=>eda.lib_Symbol.delete(id,lib)); } catch { /* verify; a thrown call cannot prove no write */ }
 return c.verify();
}};

// Asset templates use native identity and fresh get/absence, never a legacy result.
type Asset = {uuid:string;name:string};
interface AssetPort {get(id:string,lib:string):Promise<Asset|undefined>; create?(lib:string,name:string):Promise<string|undefined>; delete(id:string,lib:string):Promise<boolean>; copy?(id:string,source:string,target:string,name:string):Promise<string|undefined>}
function assetPort(kind:'footprint'|'device'|'model3d'): AssetPort {
 if(kind==='footprint') return {get:(id,lib)=>eda.lib_Footprint.get(id,lib),create:(lib,name)=>eda.lib_Footprint.create(lib,name),delete:(id,lib)=>eda.lib_Footprint.delete(id,lib),copy:(id,source,target,name)=>eda.lib_Footprint.copy(id,source,target,undefined,name)};
 if(kind==='device') return {get:(id,lib)=>eda.lib_Device.get(id,lib),create:(lib,name)=>eda.lib_Device.create(lib,name),delete:(id,lib)=>eda.lib_Device.delete(id,lib)};
 return {get:(id,lib)=>eda.lib_3DModel.get(id,lib),delete:(id,lib)=>eda.lib_3DModel.delete(id,lib),copy:(id,source,target,name)=>eda.lib_3DModel.copy(id,source,target,undefined,name)};
}
export function assetCreate(kind:'footprint'|'device'):NativeAction { return createLibraryAsset(kind); }
export function assetDelete(kind:'footprint'|'device'|'model3d'):NativeAction {
 return {mode:'V2_NATIVE',scope:'LIBRARY_ASSET',validate:p=>fields(p,{uuid:'string',libraryUuid:'string',expectedName:'string'},['uuid','expectedName']),run:async c=>{
  const lib=await boundLibrary(c),id=c.request.input.uuid as string,port=assetPort(kind);
  const before=await port.get(id,lib);
  if(before===undefined)return observed({uuid:id,libraryUuid:lib,name:c.request.input.expectedName,deleted:true,absent:true},['fresh_absence'],false);
  if(!before||before.uuid!==id||before.name!==c.request.input.expectedName)throw Error('V2_ASSET_IDENTITY');
  c.prepare(async()=>{const after=await port.get(id,lib);if(after===undefined)return observed({uuid:id,libraryUuid:lib,name:c.request.input.expectedName,deleted:true,absent:true},['fresh_absence'],true);return {changed:null,verification:unavailable(),evidence:after};});
 try{await c.effect(()=>port.delete(id,lib));}catch{/* fresh verification only */}
  return c.verify();
 }};
}
export const documentOpen:NativeAction={mode:'V2_NATIVE',scope:'NAVIGATION_SELECTION',validate:p=>{fields(p,{uuid:'string',schematicPageUuid:'string'});if(!p.uuid&&!p.schematicPageUuid)throw Error('V2_MISSING_ID');if(p.uuid&&p.schematicPageUuid&&p.uuid!==p.schematicPageUuid)throw Error('V2_CONFLICTING_ID');},run:async c=>{
 const id=(c.request.input.schematicPageUuid??c.request.input.uuid) as string;
 const pages=array(await eda.dmt_Schematic.getAllSchematicPagesInfo());const pcbs=array(await eda.dmt_Pcb.getAllPcbsInfo());
 if((c.request.action==='schematic.page.open'&&!pages.some(p=>p.uuid===id))||(!pages.some(p=>p.uuid===id)&&!pcbs.some(p=>p.uuid===id)))throw Error('V2_DESTINATION_NOT_IN_PROJECT');
 const before=await eda.dmt_SelectControl.getCurrentDocumentInfo();
 if(before?.uuid===id){const ready=before.documentType===1?await waitSchematicPageSettle():true;return observed({tabId:before.tabId,ready},['fresh_destination_uuid'],false);}
 c.prepare(async()=>{const after=await eda.dmt_SelectControl.getCurrentDocumentInfo();if(after?.uuid===id&&after.tabId){const ready=after.documentType===1?await waitSchematicPageSettle():true;return observed({tabId:after.tabId,ready},['fresh_destination_uuid','fresh_tab'],true);}return {changed:null,verification:unavailable(),evidence:after};});
 try{await c.effect(()=>eda.dmt_EditorControl.openDocument(id));}catch{/* verify */}
 return c.verify();
}};
export const pageCreate:NativeAction={mode:'V2_NATIVE',scope:'PROJECT_TOPOLOGY',validate:p=>fields(p,{schematicUuid:'string'},['schematicUuid']),run:async c=>{
 const parent=c.request.input.schematicUuid as string;
 if(!array(await eda.dmt_Schematic.getAllSchematicsInfo()).some(s=>s.uuid===parent))throw Error('V2_PARENT_NOT_IN_PROJECT');
 let id: string | undefined;
 c.prepare(async()=>{if(!id)return {changed:null,verification:unavailable()};const after=await eda.dmt_Schematic.getSchematicPageInfo(id);if(after?.uuid===id&&after.parentSchematicUuid===parent)return observed({pageUuid:id,...after},['fresh_page_uuid','fresh_parent_schematic'],true);return {changed:null,verification:unavailable(),evidence:{created_id:id,after}};});
 await c.effect(async()=>{id=await eda.dmt_Schematic.createSchematicPage(parent);});if(!id)return {changed:null,verification:unavailable()};
 return c.verify();
}};
export const pageDelete:NativeAction={mode:'V2_NATIVE',scope:'PROJECT_TOPOLOGY',validate:p=>fields(p,{pageUuid:'string'},['pageUuid']),run:async c=>{
 const id=c.request.input.pageUuid as string;
 const before=array(await eda.dmt_Schematic.getAllSchematicPagesInfo());
 if(!before.some(p=>p.uuid===id))return observed({uuid:id,absent:true},['fresh_project_page_absence'],false);
 c.prepare(async()=>{const after=array(await eda.dmt_Schematic.getAllSchematicPagesInfo());if(!after.some(p=>p.uuid===id))return observed({uuid:id,absent:true},['fresh_project_page_absence'],true);return {changed:null,verification:unavailable(),evidence:after};});
 try{await c.effect(()=>eda.dmt_Schematic.deleteSchematicPage(id));}catch{/* verify */}
 return c.verify();
}};
export function schematicRename(page:boolean):NativeAction {
 return {mode:'V2_NATIVE',scope:'PROJECT_TOPOLOGY',validate:p=>{fields(p,page?{pageUuid:'string',uuid:'string',name:'string'}:{schematicUuid:'string',uuid:'string',name:'string'},['name']);if(!p[page?'pageUuid':'schematicUuid']&&!p.uuid)throw Error('V2_MISSING_ID');if(p.uuid&&p[page?'pageUuid':'schematicUuid']&&p.uuid!==p[page?'pageUuid':'schematicUuid'])throw Error('V2_CONFLICTING_ID');},run:async c=>{
  const id=(c.request.input[page?'pageUuid':'schematicUuid']??c.request.input.uuid) as string,name=c.request.input.name as string;
  const list=async()=>page?array(await eda.dmt_Schematic.getAllSchematicPagesInfo()):array(await eda.dmt_Schematic.getAllSchematicsInfo());
  const before=(await list()).find(x=>x.uuid===id);if(!before)throw Error('V2_OBJECT_NOT_IN_PROJECT');
  if(before.name===name)return observed(before,['fresh_name'],false);
  c.prepare(async()=>{if(page)await verifySchematicPageName(id,name);const after=(await list()).find(x=>x.uuid===id);if(after?.name===name)return observed(after,['fresh_uuid','fresh_name'],true);return {changed:null,verification:unavailable(),evidence:after};});
 try{await c.effect(()=>page?eda.dmt_Schematic.modifySchematicPageName(id,name):eda.dmt_Schematic.modifySchematicName(id,name));}catch{/* verify */}
  return c.verify();
 }};
}
function nativeNamedList<T extends {name:string}>(raw:T[]|Record<string,T>):T[]{
 if(!raw||typeof raw!=='object')throw Error('V2_NATIVE_SHAPE');
 const list=Array.isArray(raw)?raw:Object.values(raw);
 if(!list.every(x=>x&&typeof x.name==='string'))throw Error('V2_NATIVE_SHAPE');return list;
}
export const pcbConstraints=read(async()=>{const differentialPairs=nativeNamedList(await eda.pcb_Drc.getAllDifferentialPairs()),equalLengthGroups=nativeNamedList(await eda.pcb_Drc.getAllEqualLengthNetGroups());return {differentialPairs,equalLengthGroups,count:differentialPairs.length+equalLengthGroups.length};});
function sameFields(actual:Record<string,unknown>,expected:Record<string,unknown>):boolean {
 return Object.entries(expected).every(([key,value])=>typeof value==='number'?typeof actual[key]==='number'&&Math.abs((actual[key] as number)-value)<1e-6:actual[key]===value);
}
export const viaCreate:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{fields(p,{x:'number',y:'number',net:'string',holeDiameter:'number',diameter:'number'},['x','y']);if(((p.holeDiameter as number|undefined)??12)<=0||((p.diameter as number|undefined)??24)<=((p.holeDiameter as number|undefined)??12))throw Error('V2_VIA_GEOMETRY');},run:async c=>{
 const p:Record<string,unknown>={net:'',holeDiameter:12,diameter:24,...c.request.input};const before=new Set(array(await eda.pcb_PrimitiveVia.getAll()).map(v=>v.getState_PrimitiveId()));let id:string|undefined;
 c.prepare(async()=>{if(!id||before.has(id))return {changed:null,verification:unavailable()};const v=await eda.pcb_PrimitiveVia.get(id);if(!v||v.getState_PrimitiveId()!==id)return {changed:null,verification:unavailable()};const actual={x:v.getState_X(),y:v.getState_Y(),net:v.getState_Net(),holeDiameter:v.getState_HoleDiameter(),diameter:v.getState_Diameter()};return sameFields(actual,p)?observed({primitiveId:id,...actual},['fresh_new_identity',...Object.keys(p)],true):{changed:null,verification:unavailable(),evidence:actual};});
 await c.effect(async()=>{const v=await eda.pcb_PrimitiveVia.create(p.net as string,p.x as number,p.y as number,p.holeDiameter as number,p.diameter as number);id=v?.getState_PrimitiveId();});return c.verify();
}};
export const lineCreate:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{fields(p,{startX:'number',startY:'number',endX:'number',endY:'number',net:'string',layer:'number',lineWidth:'number'},['startX','startY','endX','endY']);if(((p.lineWidth as number|undefined)??6)<=0)throw Error('V2_LINE_GEOMETRY');},run:async c=>{
 const p:Record<string,unknown>={net:'',layer:1,lineWidth:6,...c.request.input};const before=new Set(array(await eda.pcb_PrimitiveLine.getAll()).map(v=>v.getState_PrimitiveId()));let id:string|undefined;
 c.prepare(async()=>{if(!id||before.has(id))return {changed:null,verification:unavailable()};const v=await eda.pcb_PrimitiveLine.get(id);if(!v||v.getState_PrimitiveId()!==id)return {changed:null,verification:unavailable()};const actual={startX:v.getState_StartX(),startY:v.getState_StartY(),endX:v.getState_EndX(),endY:v.getState_EndY(),net:v.getState_Net(),layer:v.getState_Layer(),lineWidth:v.getState_LineWidth()};return sameFields(actual,p)?observed({primitiveId:id,...actual,...('startX' in actual?{start:{x:actual.startX,y:actual.startY},end:{x:actual.endX,y:actual.endY}}:{})},['fresh_new_identity',...Object.keys(p)],true):{changed:null,verification:unavailable(),evidence:actual};});
 await c.effect(async()=>{const v=await eda.pcb_PrimitiveLine.create(p.net as string,p.layer as TPCB_LayersOfLine,p.startX as number,p.startY as number,p.endX as number,p.endY as number,p.lineWidth as number);id=v?.getState_PrimitiveId();});return c.verify();
}};
export const layerSelect:NativeAction={mode:'V2_NATIVE',scope:'NAVIGATION_SELECTION',validate:p=>fields(p,{layer:'string|number'},['layer']),run:async c=>{
 const layers=array(await eda.pcb_Layer.getAllLayers());
 const id=resolveV2Layer(c.request.input.layer,layers);
 if(!layers.some(l=>l.id===id))throw Error('V2_LAYER_NOT_FOUND');
 const before=eda.pcb_Layer.getCurrentLayer()?.id;
 c.prepare(async()=>{const after=eda.pcb_Layer.getCurrentLayer()?.id;if(after===id)return observed({layer:after},['fresh_current_layer'],before!==id);return {changed:null,verification:unavailable(),evidence:{layer:after}};});
 if(before!==id)await c.effect(()=>eda.pcb_Layer.selectLayer(id as TPCB_LayersInTheSelectable));return c.verify();
}};

export function differential(mode:'create'|'delete'|'rename'):NativeAction {
 return {mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{
  fields(p,{name:'string',positiveNet:'string',negativeNet:'string',newName:'string'},mode==='rename'?['name','newName']:mode==='delete'?['name']:['name','positiveNet','negativeNet']);
  if(p.positiveNet!==undefined&&p.positiveNet===p.negativeNet || (mode!=='rename'&&p.newName!==undefined))throw Error('V2_DIFFERENTIAL_INPUT');
 },run:async c=>{
  const p=c.request.input,name=p.name as string;
  const list=async()=>nativeNamedList(await eda.pcb_Drc.getAllDifferentialPairs());
  const before=await list(),old=before.find(x=>x.name===name);
  const positive=(p.positiveNet??old?.positiveNet) as string,negative=(p.negativeNet??old?.negativeNet) as string;
  const matches=(x:{positiveNet:string;negativeNet:string})=>x.positiveNet===positive&&x.negativeNet===negative;
  if(old&&!matches(old))throw Error('V2_PAIR_IDENTITY_MISMATCH');
  if(mode==='create'&&old)return observed({...old,created:false,alreadyExists:true},['fresh_pair_mapping'],false);
  if(mode==='delete'&&!old)return observed({name,absent:true,deleted:false,alreadyAbsent:true},['fresh_pair_absence'],false);
  if(mode==='rename'&&old&&p.newName===name)return observed(old,['fresh_pair_mapping','fresh_name'],false);
  if(mode==='rename'&&(!old||before.some(x=>x.name===p.newName)))throw Error('V2_RENAME_PRECONDITION');
  if(mode==='create'){const nets=array(await eda.pcb_Net.getAllNetsName());if(!nets.includes(positive)||!nets.includes(negative))throw Error('V2_NET_NOT_FOUND');}
  c.prepare(async()=>{const after=await list(),found=after.find(x=>x.name===(mode==='rename'?p.newName:name));
   const satisfied=mode==='delete'?!found:!!found&&matches(found)&&(mode!=='rename'||!after.some(x=>x.name===name));
   if(satisfied)return observed({name:mode==='rename'?p.newName:name,pair:found??null,...(mode==='create'?{positiveNet:positive,negativeNet:negative,created:true,alreadyExists:false}:mode==='rename'?{previousName:name,renamed:true}:{deleted:true})},['fresh_pair_identity','fresh_pair_mapping_or_absence'],true);
   return {changed:null,verification:unavailable(),evidence:after};
  });
  await c.effect(()=>mode==='create'?eda.pcb_Drc.createDifferentialPair(name,positive,negative):mode==='delete'?eda.pcb_Drc.deleteDifferentialPair(name):eda.pcb_Drc.modifyDifferentialPairName(name,p.newName as string));return c.verify();
 }};
}
export const selectSchematic:NativeAction={mode:'V2_NATIVE',scope:'NAVIGATION_SELECTION',validate:p=>{const ids=typeof p.primitiveIds==='string'?[p.primitiveIds]:p.primitiveIds;fields({...p,primitiveIds:ids},{primitiveIds:'object'},['primitiveIds']);if(!Array.isArray(ids)||!ids.every(x=>typeof x==='string'&&x))throw Error('V2_INVALID_IDS');},run:async c=>{
 const raw=c.request.input.primitiveIds;
 const ids=[...new Set(typeof raw==='string'?[raw]:raw as string[])];
 const same=(actual:string[])=>actual.length===ids.length&&ids.every(id=>actual.includes(id));
 const before=array(await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId());
 c.prepare(async()=>{const after=array(await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId());return same(after)?observed({primitiveIds:after,selectedPrimitiveIds:after},['fresh_selection_exact_coverage'],!same(before)):{changed:null,verification:unavailable(),evidence:after};});
 if(!same(before))await c.effect(()=>eda.sch_SelectControl.doSelectPrimitives(ids));return c.verify();
}};

export function equalLengthGroup(mode: 'create' | 'delete'): NativeAction {
 return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => {
  fields(p, { name: 'string', nets: 'object' }, mode === 'create' ? ['name', 'nets'] : ['name']);
  if (p.nets !== undefined && (!Array.isArray(p.nets) || p.nets.length < 2 || !p.nets.every(n => typeof n === 'string' && n) || new Set(p.nets).size !== p.nets.length)) throw Error('V2_INVALID_NETS');
 }, run: async c => {
  const name = c.request.input.name as string, nets = c.request.input.nets as string[];
  const pull = async () => nativeNamedList(await eda.pcb_Drc.getAllEqualLengthNetGroups());
  const same = (actual: string[]) => Array.isArray(actual) && actual.length === nets.length && nets.every(n => actual.includes(n));
  const before = await pull(), old = before.find(g => g.name === name);
  if (old && nets !== undefined && !same(old.nets)) throw Error('V2_GROUP_IDENTITY_MISMATCH');
  if ((mode === 'create' && old) || (mode === 'delete' && !old)) return observed({ name, nets, absent: !old, ...(mode==='create'?{alreadyExists:true,created:false}:{deleted:false,alreadyAbsent:true}) }, ['fresh_group_exact_membership_or_absence'], false);
  if (mode === 'create') { const available = array(await eda.pcb_Net.getAllNetsName()); if (!nets.every(n => available.includes(n))) throw Error('V2_NET_NOT_FOUND'); }
  c.prepare(async () => {
   const after = await pull(), current = after.find(g => g.name === name);
   const untouched = before.filter(g => g.name !== name);
   const unrelatedIntact = untouched.every(g => JSON.stringify(after.find(x => x.name === g.name)) === JSON.stringify(g)) && after.filter(g => g.name !== name).length === untouched.length;
   const satisfied = mode === 'delete' ? !current : !!current && same(current.nets);
   return satisfied && unrelatedIntact ? observed({ name, nets: current?.nets, absent: !current, ...(mode==='create'?{created:true,alreadyExists:false}:{deleted:true}) }, ['fresh_group_exact_membership_or_absence', 'unrelated_groups_unchanged'], true) : { changed: null, verification: unavailable(), evidence: after };
  });
  await c.effect(() => mode === 'create' ? eda.pcb_Drc.createEqualLengthNetGroup(name, nets, undefined as never) : eda.pcb_Drc.deleteEqualLengthNetGroup(name));
  return c.verify();
 } };
}

const layerPresets: Record<string, number[]> = { 'top-only': [1, 3], 'bottom-only': [2, 4], 'copper-only': [1, 2], 'silk-only': [3, 4] };
export function layerVisibility(sideView = false): NativeAction {
 return { mode: 'V2_NATIVE', scope: 'NAVIGATION_SELECTION', validate: p => {
  if (sideView) { fields(p, { side: 'string' }, ['side']); if (!['top', 'bottom'].includes(String(p.side).trim().toLowerCase())) throw Error('V2_INVALID_SIDE'); return; }
  fields(p, { preset: 'string', show: 'object', hide: 'object', exclusive: 'boolean' });
  if (p.preset !== undefined && (!(String(p.preset).trim().toLowerCase() in layerPresets))) throw Error('V2_INVALID_PRESET');
  for (const key of ['show', 'hide']) if (p[key] !== undefined && (!Array.isArray(p[key]) || !(p[key] as unknown[]).every(v => typeof v === 'string' && !!v.trim() || typeof v === 'number' && Number.isInteger(v)))) throw Error('V2_INVALID_LAYERS');
  if (!p.preset && !(p.show as unknown[] | undefined)?.length && !(p.hide as unknown[] | undefined)?.length) throw Error('V2_EMPTY_VISIBILITY');
 }, run: async c => {
  const p = c.request.input;
  const before = array(await eda.pcb_Layer.getAllLayers()), currentBefore = eda.pcb_Layer.getCurrentLayer()?.id;
  const show = sideView ? (String(p.side).trim().toLowerCase() === 'top' ? [1, 3] : [2, 4]) : p.preset ? layerPresets[String(p.preset).trim().toLowerCase()] : ((p.show as unknown[] | undefined) ?? []).map(v => resolveV2Layer(v, before));
  const hide = p.preset ? [] : ((p.hide as unknown[] | undefined) ?? []).map(v => resolveV2Layer(v, before));
  const exclusive = sideView || !!p.preset || (p.exclusive === true && show.length > 0);
  const selected = sideView ? show[0] : undefined;
  if (show.some(id => hide.includes(id)) || [...show, ...hide].some(id => !before.some(l => l.id === id && l.layerStatus !== 0))) throw Error('V2_LAYER_PRECONDITION');
  const expected = new Map(before.map(l => [l.id, show.includes(l.id) ? 1 : hide.includes(l.id) || (exclusive && l.layerStatus !== 0) ? 2 : l.layerStatus]));
  const satisfied = (layers: typeof before, current: number | undefined) => layers.length === before.length && layers.every(l => expected.get(l.id) === l.layerStatus) && (selected === undefined || current === selected);
  const noOp = satisfied(before, currentBefore);
  c.prepare(async () => {
   const after = array(await eda.pcb_Layer.getAllLayers()), current = eda.pcb_Layer.getCurrentLayer()?.id;
   return satisfied(after, current) ? observed({ layers: after, currentLayer: current, ...(sideView ? { side: String(p.side).trim().toLowerCase(), view: 'layer-focus' } : {}) }, ['fresh_layer_status_complete_coverage', ...(sideView ? ['fresh_current_layer'] : [])], !noOp) : { changed: null, verification: unavailable(), evidence: { layers: after, currentLayer: current } };
  });
  if (!noOp) {
   if (selected !== undefined && selected !== currentBefore) await c.effect(() => eda.pcb_Layer.selectLayer(selected as TPCB_LayersInTheSelectable));
   if (show.length) await c.effect(() => eda.pcb_Layer.setLayerVisible(show as TPCB_LayersInTheSelectable[], exclusive));
   if (hide.length) await c.effect(() => eda.pcb_Layer.setLayerInvisible(hide as TPCB_LayersInTheSelectable[], false));
  }
  return c.verify();
 } };
}

function polygonPoints(raw: unknown): number[][] {
 if (!Array.isArray(raw) || raw.length < 3 || !raw.every(p => Array.isArray(p) && p.length >= 2 && p.slice(0,2).every(n => typeof n === 'number' && Number.isFinite(n)))) throw Error('V2_INVALID_POLYGON');
 return raw.map(p => [p[0],p[1]]);
}
export function polygonCreate(kind: 'fill' | 'region'): NativeAction {
 return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => {
  const checked = {...p};
  if (kind === 'region') for (const key of ['ruleType', 'ruleTypes']) if (checked[key] !== undefined && !Array.isArray(checked[key])) checked[key] = [checked[key]];
  fields(checked, kind === 'fill' ? { points: 'object', layer: 'number', net: 'string', fillMode: 'string|number', lineWidth: 'number', locked: 'boolean' } : { points: 'object', layer: 'number', ruleTypes: 'object', ruleType: 'object', name: 'string', lineWidth: 'number', locked: 'boolean' }, ['points']);
  polygonPoints(p.points);
  if (p.layer !== undefined && !Number.isInteger(p.layer) || p.lineWidth !== undefined && (p.lineWidth as number) < 0) throw Error('V2_INVALID_GEOMETRY');
  if (kind === 'fill') fillModeValue(p.fillMode);
  if (kind === 'region') regionRuleValues(p.ruleType ?? p.ruleTypes);
 }, run: async c => {
  const p: Record<string, unknown> = {layer:1, locked:false, ...c.request.input};
  if(kind === 'fill') p.fillMode = fillModeValue(p.fillMode); else p.ruleTypes = regionRuleValues(p.ruleType ?? p.ruleTypes);
  const points = polygonPoints(p.points);
  // Same explicitly closed line polygon used by the existing business handler.
  const source = [points[0][0], points[0][1], 'L', ...points.slice(1).flat(), ...points[0]] as TPCB_PolygonSourceArray;
  const polygon = eda.pcb_MathPolygon.createPolygon(source);
  if (!polygon) throw Error('V2_INVALID_POLYGON');
  const expectedSource = JSON.stringify(polygon.getSource());
  const before = new Set((kind === 'fill' ? array(await eda.pcb_PrimitiveFill.getAll()) : array(await eda.pcb_PrimitiveRegion.getAll())).map(x => x.getState_PrimitiveId()));
  let id: string | undefined;
  c.prepare(async () => {
   if (!id || before.has(id)) return { changed: null, verification: unavailable() };
   const fresh = kind === 'fill' ? await eda.pcb_PrimitiveFill.get(id) : await eda.pcb_PrimitiveRegion.get(id);
   if (!fresh || fresh.getState_PrimitiveId() !== id) return { changed: null, verification: unavailable() };
   const common = fresh.getState_Layer() === p.layer && (p.lineWidth === undefined || fresh.getState_LineWidth() === p.lineWidth) && fresh.getState_PrimitiveLock() === (p.locked === true) && JSON.stringify(fresh.getState_ComplexPolygon().getSource()) === expectedSource;
   const specific = kind === 'fill' ? (p.net === undefined || (fresh as IPCB_PrimitiveFill).getState_Net() === p.net) && (fresh as IPCB_PrimitiveFill).getState_FillMode() === p.fillMode : (p.name === undefined || (fresh as IPCB_PrimitiveRegion).getState_RegionName() === p.name) && JSON.stringify([...(fresh as IPCB_PrimitiveRegion).getState_RuleType()].sort()) === JSON.stringify([...(p.ruleTypes as number[])].sort());
   return common && specific ? observed({ primitiveId: id }, ['fresh_new_identity','fresh_polygon_source','fresh_layer_lock',...(p.lineWidth!==undefined?['fresh_line_width']:[]),...(kind==='fill'?['fresh_fill_mode',...(p.net!==undefined?['fresh_net']:[])]:['fresh_rules',...(p.name!==undefined?['fresh_name']:[])])], true) : { changed: null, verification: unavailable() };
  });
  await c.effect(async () => {
   const made = kind === 'fill' ? await eda.pcb_PrimitiveFill.create(p.layer as TPCB_LayersOfFill, polygon, p.net as string, p.fillMode as EPCB_PrimitiveFillMode, p.lineWidth as number, p.locked === true) : await eda.pcb_PrimitiveRegion.create(p.layer as TPCB_LayersOfRegion, polygon, p.ruleTypes as EPCB_PrimitiveRegionRuleType[], p.name as string, p.lineWidth as number, p.locked === true);
   id = made?.getState_PrimitiveId();
  });
  return c.verify();
 } };
}

export const silkAdd: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => {
 fields(p, { text: 'string', x: 'number', y: 'number', layer: 'number', fontSize: 'number', lineWidth: 'number', rotation: 'number' }, ['text', 'x', 'y']);
 if (p.layer !== undefined && p.layer !== 3 && p.layer !== 4 || p.fontSize !== undefined && (p.fontSize as number) <= 0 || p.lineWidth !== undefined && (p.lineWidth as number) <= 0) throw Error('V2_SILK_GEOMETRY');
}, run: async c => {
 const p: Record<string, unknown> = { layer: 3, fontSize: 40, lineWidth: 6, rotation: 0, ...c.request.input };
 const before = new Set(array(await eda.pcb_PrimitiveString.getAll()).map(x => x.getState_PrimitiveId()));
 let id: string | undefined;
 c.prepare(async () => {
  if (!id || before.has(id)) return { changed: null, verification: unavailable() };
  const fresh = await eda.pcb_PrimitiveString.get(id);
  if (!fresh || fresh.getState_PrimitiveId() !== id) return { changed: null, verification: unavailable() };
  const actual = { text: fresh.getState_Text(), x: fresh.getState_X(), y: fresh.getState_Y(), layer: fresh.getState_Layer(), fontSize: fresh.getState_FontSize(), lineWidth: fresh.getState_LineWidth(), rotation: fresh.getState_Rotation() };
  return sameFields(actual, p) ? observed({ primitiveId: id, ...actual }, ['fresh_new_identity', ...Object.keys(actual)], true) : { changed: null, verification: unavailable(), evidence: actual };
 });
 await c.effect(async () => { const made = await eda.pcb_PrimitiveString.create(p.layer as TPCB_LayersOfImage, p.x as number, p.y as number, p.text as string, '', p.fontSize as number, p.lineWidth as number, 0 as EPCB_PrimitiveStringAlignMode, p.rotation as number, false, 0, false, false); id = made?.getState_PrimitiveId(); });
 return c.verify();
} };


// Ported from the baseline layer resolver; names are resolved from a fresh,
// already identity-bound document's layer list, never used to select a document.
export function resolveV2Layer(spec: unknown, layers: Array<{id:number;name:string}>): number {
 const aliases: Record<string, number> = {top:1,topcopper:1,toplayer:1,bottom:2,bottomcopper:2,bottomlayer:2,topsilk:3,topsilkscreen:3,bottomsilk:4,bottomsilkscreen:4};
 if(typeof spec === 'number' && Number.isInteger(spec)) return spec;
 if(typeof spec === 'string') {
  const raw=spec.trim();
  if(/^\d+$/.test(raw)) return Number(raw);
  const key=raw.toLowerCase().replace(/[\s_-]+/g,'');
  if(key in aliases) return aliases[key];
  const found=layers.filter(l=>l.name.toLowerCase().replace(/[\s_-]+/g,'')===key);
  if(found.length===1)return found[0].id;
 }
 throw Error('V2_LAYER_UNRESOLVED');
}

export const deviceSetModel: NativeAction = { mode: 'V2_NATIVE', scope: 'LIBRARY_ASSET', validate: p => {
 fields(p, { uuid: 'string', libraryUuid: 'string', expectedName: 'string', clear: 'boolean', model3D: 'object' }, ['uuid', 'expectedName']);
 if (p.clear === true && p.model3D !== undefined) throw Error('V2_CONFLICTING_INPUT');
 if (p.clear !== true) fields(p.model3D as Record<string, unknown> ?? {}, { uuid: 'string', libraryUuid: 'string' }, ['uuid', 'libraryUuid']);
}, run: async c => {
 const p = c.request.input, lib = c.request.target_ref.library_uuid!, id = p.uuid as string;
 if (p.libraryUuid !== undefined && p.libraryUuid !== lib) throw Error('V2_TARGET_MISMATCH');
 const expected = p.clear === true ? null : p.model3D as { uuid: string; libraryUuid: string };
 const pull = async () => { const d = await eda.lib_Device.get(id, lib); if (!d || d.uuid !== id || d.name !== p.expectedName) throw Error('V2_ASSET_IDENTITY'); return d; };
 const before = await pull();
 if (expected) { const model = await eda.lib_3DModel.get(expected.uuid, expected.libraryUuid); if (!model || model.uuid !== expected.uuid) throw Error('V2_MODEL_IDENTITY'); }
 const matches = (d: typeof before) => {
  const a = d.association as unknown as { model3D?: { uuid?: string; libraryUuid?: string }; model3DUuid?: string } | undefined;
  return expected ? a?.model3D?.uuid === expected.uuid && a.model3D.libraryUuid === expected.libraryUuid : !a?.model3D && !a?.model3DUuid;
 };
 if (matches(before)) return observed({ uuid: id, libraryUuid: lib, name: p.expectedName, model3D: expected, cleared: p.clear === true, device: before }, ['fresh_device_identity', 'fresh_model_association'], false);
 c.prepare(async () => { const after = await pull(); return matches(after) ? observed({ uuid: id, libraryUuid: lib, name: p.expectedName, model3D: expected, cleared: p.clear === true, device: after }, ['fresh_device_identity', 'fresh_model_association'], true) : { changed: null, verification: unavailable(), evidence: after }; });
 await c.effect(() => eda.lib_Device.modify(id, lib, undefined, undefined, { model3D: expected }));
 return c.verify();
} };

function fillModeValue(raw: unknown): number {
 const names: Record<string, number> = {solid:0,mesh:1,grid:1,inner:2,'inner-electrical':2};
 const value = raw === undefined ? 0 : typeof raw === 'string' ? names[raw.trim().toLowerCase()] : raw;
 if(typeof value !== 'number' || ![0,1,2].includes(value)) throw Error('V2_INVALID_FILL_MODE');
 return value;
}
function regionRuleValues(raw: unknown): number[] {
 const names: Record<string, number> = {'no-components':2,'keepout-components':2,components:2,'no-wires':5,'no-routing':5,'keepout-routing':5,wires:5,routing:5,'no-fills':6,fills:6,'no-pours':7,'no-copper':7,'keepout-copper':7,pours:7,copper:7,'no-inner':8,'no-inner-electrical':8,inner:8,'follow-rule':9,constraint:9};
 const values = raw === undefined ? [2,5,7] : Array.isArray(raw) ? raw : [raw];
 return (values.length ? values : [2,5,7]).map(value => {
  const id=typeof value==='string'?names[value.trim().toLowerCase()]:value;
  if(typeof id!=='number'||![2,5,6,7,8,9].includes(id))throw Error('V2_INVALID_REGION_RULES');
  return id;
 });
}

export function boardMutation(mode: 'create' | 'rename' | 'delete'): NativeAction {
 return { mode: 'V2_NATIVE', scope: 'PROJECT_TOPOLOGY', validate: p => {
  fields(p, mode === 'create' ? { schematicUuid: 'string', pcbUuid: 'string' } : mode === 'rename' ? { name: 'string', newName: 'string', schematicUuid: 'string', pcbUuid: 'string' } : { name: 'string', schematicUuid: 'string', pcbUuid: 'string' }, mode === 'rename' ? ['name', 'newName'] : mode === 'delete' ? ['name'] : []);
  if (mode === 'create' && !p.schematicUuid && !p.pcbUuid) throw Error('V2_BOARD_DOCUMENT_REQUIRED');
 }, run: async c => {
  const p = c.request.input, project = c.request.target_ref.project_uuid!;
  const pull = async () => { const boards = array(await eda.dmt_Board.getAllBoardsInfo()); if (boards.some(b => b.parentProjectUuid !== project)) throw Error('V2_BOARD_PROJECT_MISMATCH'); return boards; };
  const identity = (b: IDMT_BoardItem) => ({ project: b.parentProjectUuid, schematic: b.schematic?.uuid ?? null, pcb: b.pcb?.uuid ?? null });
  const before = await pull();
  const matches = before.filter(b => b.name === p.name);
  if (matches.length > 1) throw Error('V2_AMBIGUOUS_BOARD');
  const source = matches[0];
  if (mode === 'delete' && !source) return observed({ absent: true, name: p.name }, ['fresh_project_board_absence'], false);
  if (mode !== 'create' && !source) throw Error('V2_BOARD_NOT_FOUND');
  if (source && (p.schematicUuid !== undefined && source.schematic?.uuid !== p.schematicUuid || p.pcbUuid !== undefined && source.pcb?.uuid !== p.pcbUuid)) throw Error('V2_BOARD_IDENTITY_MISMATCH');
  if (mode === 'rename' && p.name === p.newName) return observed(source, ['fresh_board_identity_and_name'], false);
  if (mode === 'rename' && before.some(b => b.name === p.newName)) throw Error('V2_BOARD_NAME_EXISTS');
  if (mode === 'create') {
   const schematics = array(await eda.dmt_Schematic.getAllSchematicsInfo()), pcbs = array(await eda.dmt_Pcb.getAllPcbsInfo());
   if (p.schematicUuid && !schematics.some(d => d.uuid === p.schematicUuid && d.parentProjectUuid === project) || p.pcbUuid && !pcbs.some(d => d.uuid === p.pcbUuid && d.parentProjectUuid === project)) throw Error('V2_DOCUMENT_IDENTITY');
  }
  const bound = source ? JSON.stringify(identity(source)) : undefined;
  let createdName: string | undefined;
  c.prepare(async () => {
   const after = await pull();
   const untouched = before.filter(b => b !== source && !(mode === 'create' && (p.schematicUuid && b.schematic?.uuid === p.schematicUuid || p.pcbUuid && b.pcb?.uuid === p.pcbUuid)));
   const unrelatedIntact = untouched.every(b => after.some(a => a.name === b.name && JSON.stringify(identity(a)) === JSON.stringify(identity(b))));
   const current = after.find(b => b.name === (mode === 'create' ? createdName : mode === 'rename' ? p.newName : p.name));
   const complete = mode === 'create' ? !!createdName && !before.some(b => b.name === createdName) && !!current && (!p.schematicUuid || current.schematic?.uuid === p.schematicUuid) && (!p.pcbUuid || current.pcb?.uuid === p.pcbUuid) && after.length === before.length + 1
    : mode === 'rename' ? !!current && JSON.stringify(identity(current)) === bound && !after.some(b => b.name === p.name) && after.length === before.length
    : !current && !after.some(b => JSON.stringify(identity(b)) === bound) && after.length === before.length - 1;
   return complete && unrelatedIntact ? observed({ boardName: mode === 'create' ? createdName : mode === 'rename' ? p.newName : p.name, board: current ?? null, absent: mode === 'delete' }, ['fresh_board_identity_mapping_or_absence', 'unrelated_board_bindings_unchanged'], true) : { changed: null, verification: unavailable(), evidence: after };
  });
  await c.effect(async () => {
   // Native board APIs take names. Revalidate the stable UUID tuple immediately
   // before handing the previously resolved name to native; never fuzzy redirect.
   if (source) { const live = (await pull()).find(b => b.name === source.name); if (!live || JSON.stringify(identity(live)) !== bound) throw Error('V2_BOARD_IDENTITY_MISMATCH'); }
   if (mode === 'create') createdName = await eda.dmt_Board.createBoard(p.schematicUuid as string | undefined, p.pcbUuid as string | undefined);
   else if (mode === 'rename') await eda.dmt_Board.modifyBoardName(source.name, p.newName as string);
   else await eda.dmt_Board.deleteBoard(source.name);
  });
  return c.verify();
 } };
}

export const titleBlockModify: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => {
 fields(p, { showTitleBlock: 'boolean', titleBlockData: 'object' });
 if (p.showTitleBlock === undefined && p.titleBlockData === undefined) throw Error('V2_EMPTY_PATCH');
 if (p.titleBlockData !== undefined) {
  if (Array.isArray(p.titleBlockData)) throw Error('V2_INVALID_TITLEBLOCK');

 }
}, run: async c => {
 const p = c.request.input, requested = (p.titleBlockData ?? {}) as Record<string, TitleBlockPatch>;
 const pull = async () => {
  const page = await eda.dmt_Schematic.getSchematicPageInfo(c.request.target_ref.document_uuid!);
  if (!page || page.uuid !== c.request.target_ref.document_uuid || !page.titleBlockData) throw Error('V2_TITLEBLOCK_READBACK_UNAVAILABLE');
  return { showTitleBlock: page.showTitleBlock, titleBlockData: page.titleBlockData as Record<string, TitleBlockPatch> };
 };
 const before = await pull();
 const structural = Object.keys(requested).filter(isTitleBlockStructuralKey);
 if (structural.some(k => !titleBlockFieldApplied(before.titleBlockData[k], requested[k]))) throw Error('V2_TITLEBLOCK_STRUCTURAL_EDIT_REFUSED');
 const ignoredKeys = Object.keys(requested).filter(k => isTitleBlockStructuralKey(k) || !(k in before.titleBlockData));
 const wanted = Object.fromEntries(Object.entries(requested).filter(([k]) => !isTitleBlockStructuralKey(k) && k in before.titleBlockData));
 for(const patch of Object.values(wanted)) {
  if(!patch || typeof patch!=='object' || Array.isArray(patch))throw Error('V2_INVALID_TITLEBLOCK_FIELD');
  const item=patch as Record<string,unknown>;
  if(Object.keys(item).some(k=>!['value','showTitle','showValue'].includes(k))||['showTitle','showValue'].some(k=>item[k]!==undefined&&typeof item[k]!=='boolean'))throw Error('V2_INVALID_TITLEBLOCK_FIELD');
 }
 const complete = (state: typeof before) => Object.entries(wanted).every(([k, patch]) => titleBlockFieldApplied(state.titleBlockData[k], patch)) && (p.showTitleBlock === undefined || state.showTitleBlock === p.showTitleBlock);
 if (complete(before)) return observed({...before,ignoredKeys}, ['fresh_titleblock_supported_fields'], false);
 c.prepare(async () => {
  // Preserve the Host metadata commit workaround. Only retry reads, never write.
  let after = await pull();
  for (let attempt = 0; attempt < 4 && !complete(after); attempt++) { await new Promise(resolve => setTimeout(resolve, 250)); after = await pull(); }
  const structureIntact = Object.keys(before.titleBlockData).filter(isTitleBlockStructuralKey).every(k => titleBlockFieldApplied(after.titleBlockData[k], before.titleBlockData[k]));
  return complete(after) && structureIntact ? observed({...after,ignoredKeys}, ['fresh_titleblock_supported_fields', 'structural_fields_unchanged'], true) : { changed: null, verification: unavailable(), evidence: after };
 });
 await c.effect(() => eda.dmt_Schematic.modifySchematicPageTitleBlock(p.showTitleBlock as boolean | undefined, wanted as Parameters<typeof eda.dmt_Schematic.modifySchematicPageTitleBlock>[1]));
 return c.verify();
} };

// Command-specific completion contracts. Save ACK is operation completion;
// durable reload proof belongs to checkpoints. UI commands prove acceptance,
// never a screenshot, persistence, or a user having seen the notification.
export const notification: NativeAction = { mode: 'V2_NATIVE', scope: 'UI_NATIVE', validate: p => {
 fields(p, { message: 'string', type: 'string', duration: 'number' }, ['message']);
}, run: async c => {
 const p = c.request.input;
 const requestedType=String(p.type??'info').toLowerCase().replace('warning','warn');
 const type=(['info','success','warn','error','question'].includes(requestedType)?requestedType:'info') as ESYS_ToastMessageType;
 let accepted = false;
 c.prepare(async () => accepted ? observed({ accepted: true, shown:true, message:p.message, type, completion:'notification_command_accepted' }, ['native_synchronous_notification_returned'], null) : {changed:null,verification:unavailable()});
 await c.effect(() => { eda.sys_Message.showToastMessage(p.message as string, type, (p.duration as number | undefined) ?? 3); accepted=true; });
 return c.verify();
} };
export function saveDocument(kind: 'pcb' | 'schematic'): NativeAction {
 return { mode: 'V2_NATIVE', scope: 'SAVE', validate: p => fields(p, {}), run: async c => {
  let acknowledgement: unknown;
  c.prepare(async () => acknowledgement === true ? observed({saved:true,completion:'native_save_acknowledged',checkpoint_proven:false}, ['native_save_ack_true'], null) : { changed:null,verification:unavailable(),evidence:{native_acknowledgement:acknowledgement} });
  await c.effect(async () => { acknowledgement = kind === 'pcb' ? await eda.pcb_Document.save() : await eda.sch_Document.save(); });
  return c.verify();
 } };
}
export function viewport(mode: 'fit' | 'fit_selection' | 'zoom' | 'region'): NativeAction {
 return { mode: 'V2_NATIVE', scope: 'NAVIGATION_SELECTION', validate: p => {
  fields(p, mode === 'zoom' ? { x: 'number', y: 'number', scale: 'number' } : mode === 'region' ? { left: 'number', right: 'number', top: 'number', bottom: 'number' } : {}, mode === 'region' ? ['left','right','top','bottom'] : []);
  if (mode === 'region' && (p.left === p.right || p.top === p.bottom)) throw Error('V2_DEGENERATE_REGION');
  if (p.scale !== undefined && (p.scale as number) <= 0) throw Error('V2_INVALID_SCALE');
 }, run: async c => {
  const p = c.request.input, tab = c.request.target_ref.tab_id!;
  let acknowledgement: unknown;
  c.prepare(async () => {
   if(acknowledgement === false) return {changed:false,verification:{verdict:'unchanged',checked:['native_viewport_unsupported_or_missing_tab'],complete:true,required:1,satisfied:0,residual:1}};
   const region = acknowledgement as Record<string,unknown> | undefined;
   const accepted = mode === 'region' ? acknowledgement === true : !!region && typeof region === 'object' && ['left','right','top','bottom'].every(k => typeof region[k] === 'number' && Number.isFinite(region[k]));
   return accepted ? observed({accepted:true,completion:'native_viewport_command_returned',...(mode === 'region' ? {} : {region})},[mode === 'region' ? 'native_zoom_region_ack_true' : 'native_zoom_returned_region'],null) : {changed:null,verification:unavailable(),evidence:{native_acknowledgement:acknowledgement}};
  });
  await c.effect(async () => {
   if (mode === 'fit') acknowledgement = await eda.dmt_EditorControl.zoomToAllPrimitives(tab);
   else if (mode === 'fit_selection') acknowledgement = await eda.dmt_EditorControl.zoomToSelectedPrimitives(tab);
   else if (mode === 'zoom') acknowledgement = await eda.dmt_EditorControl.zoomTo(p.x as number | undefined, p.y as number | undefined, p.scale as number | undefined, tab);
   else acknowledgement = await eda.dmt_EditorControl.zoomToRegion(Math.min(p.left as number,p.right as number),Math.max(p.left as number,p.right as number),Math.min(p.top as number,p.bottom as number),Math.max(p.top as number,p.bottom as number),tab);
  });
  return c.verify();
 } };
}

export const wireCreate: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => {
 fields(p, { points: 'object', net: 'string', color: 'string', lineWidth: 'number', lineType: 'number' }, ['points']);
 const points = normalizeWirePoints(p.points);
 if (!points.every(Number.isFinite)) throw Error('V2_INVALID_WIRE_POINTS');
 if (p.lineWidth !== undefined && (p.lineWidth as number) < 0) throw Error('V2_INVALID_LINE_WIDTH');
 if (p.lineType !== undefined && ![0,1,2,3].includes(p.lineType as number)) throw Error('V2_UNSUPPORTED_LINE_TYPE');
}, run: async c => {
 const p = c.request.input, points = normalizeWirePoints(p.points);
 const snapshot = async ():Promise<WireSnapshot[]> => {
  const rows=array(await eda.sch_PrimitiveWire.getAll()).map(w=>({id:w.getState_PrimitiveId(),line:w.getState_Line(),net:w.getState_Net(),color:w.getState_Color(),lineWidth:w.getState_LineWidth(),lineType:w.getState_LineType()}));
  if(rows.some(w=>!w.id)||new Set(rows.map(w=>w.id)).size!==rows.length)throw Error('V2_AMBIGUOUS_WIRE_IDENTITY');
  return structuredClone(rows);
 };
 const before=await snapshot(),beforeIds=new Set(before.map(w=>w.id));
 const requestedSegments=wireSegments(points);
 if(!requestedSegments.length)throw Error('V2_INVALID_WIRE_POINTS');
 let id:string|undefined;
 const style=(w:WireSnapshot)=>JSON.stringify([w.net,w.color,w.lineWidth,w.lineType]);
 c.prepare(async()=>{
  if(!id)return {changed:null,verification:unavailable()};
  const after=await snapshot(),byId=new Map(after.map(w=>[w.id,w])),fresh=byId.get(id);
  if(!fresh||after.some(w=>!beforeIds.has(w.id)&&w.id!==id))return {changed:null,verification:unavailable()};
  const complete=wireAdditionProof(before,after,id,points,p);
  const changed=before.length!==after.length||before.some(w=>{const a=byId.get(w.id);return !a||style(a)!==style(w)||wireGeometry(a.line,true)!==wireGeometry(w.line,true);});
  return complete?observed({primitiveId:id,net:fresh.net,line:fresh.line},['native_returned_wire_identity','fresh_complete_wire_geometry_and_style','unrelated_wire_identity_preserved'],changed):{changed:null,verification:unavailable(),evidence:{created_id:id,before,after}};
 });
 await c.effect(async () => { const made = await eda.sch_PrimitiveWire.create(points, p.net as string | undefined, p.color as string | undefined ?? null, p.lineWidth as number | undefined ?? null, p.lineType as ESCH_PrimitiveLineType | undefined ?? null); id = made?.getState_PrimitiveId(); });
 return c.verify();
} };

export const silkImport: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => {
 fields(p, { polygons: 'object', x: 'number', y: 'number', layer: 'number', width: 'number', height: 'number', rotation: 'number', mirror: 'boolean' }, ['polygons','x','y']);
 if (!Array.isArray(p.polygons) || !p.polygons.length || !p.polygons.every(a => Array.isArray(a) && a.length >= 3 && a.every(v => typeof v === 'number' && Number.isFinite(v) || typeof v === 'string' && ['L','ARC','CARC','C','R','CIRCLE'].includes(v)))) throw Error('V2_INVALID_POLYGON_SOURCE');
 if (p.layer !== undefined && p.layer !== 3 && p.layer !== 4 || ['width','height'].some(k => p[k] !== undefined && (p[k] as number) <= 0)) throw Error('V2_INVALID_IMAGE_GEOMETRY');
}, run: async c => {
 const p: Record<string, unknown> = { layer:3, rotation:0, mirror:false, ...c.request.input };
 const contours = p.polygons as TPCB_PolygonSourceArray[];
 const source = contours.length === 1 ? contours[0] : contours;
 const before = new Set(array(await eda.pcb_PrimitiveImage.getAll()).map(x => x.getState_PrimitiveId()));
 let id: string | undefined;
 c.prepare(async () => {
  if (!id || before.has(id)) return { changed:null, verification:unavailable() };
  const fresh = await eda.pcb_PrimitiveImage.get(id);
  if (!fresh || fresh.getState_PrimitiveId() !== id) return { changed:null, verification:unavailable() };
  const actual = { x:fresh.getState_X(), y:fresh.getState_Y(), layer:fresh.getState_Layer(), width:fresh.getState_Width(), height:fresh.getState_Height(), rotation:fresh.getState_Rotation(), mirror:fresh.getState_HorizonMirror() };
  const expected = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'polygons'));
  return sameFields(actual,expected) && JSON.stringify(fresh.getState_ComplexPolygon()) === JSON.stringify(source) ? observed({ primitiveId:id,...actual }, ['fresh_image_identity','fresh_complete_polygon_source',...Object.keys(expected)],true) : { changed:null, verification:unavailable(), evidence:actual };
 });
 await c.effect(async () => { const made=await eda.pcb_PrimitiveImage.create(p.x as number,p.y as number,source,p.layer as TPCB_LayersOfImage,p.width as number|undefined,p.height as number|undefined,p.rotation as number,p.mirror as boolean);id=made?.getState_PrimitiveId(); });
 return c.verify();
} };
export const pourCreate: NativeAction = { mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{
 fields(p,{points:'object',net:'string',layer:'number',fill:'string',name:'string',priority:'number',lineWidth:'number'},['points','net']);polygonPoints(p.points);
 if(!String(p.net).trim())throw Error('V2_INVALID_POUR');
},run:async c=>{
 const p=c.request.input,points=polygonPoints(p.points),net=String(p.net).trim(),layer=(p.layer as number|undefined)??1;
 const name=p.name as string|undefined;
 const fill=({solid:'solid',grid:'90grid',grid45:'45grid'} as Record<string,string>)[String(p.fill??'solid')]??'solid';
 const polygon=eda.pcb_MathPolygon.createPolygon([points[0][0],points[0][1],'L',...points.slice(1).flat(),...points[0]] as TPCB_PolygonSourceArray);
 if(!polygon)throw Error('V2_INVALID_POLYGON');
 const before=array(await eda.pcb_PrimitivePour.getAll());
 const beforeIds=new Set(before.map(x=>x.getState_PrimitiveId()));
 if(beforeIds.size!==before.length||beforeIds.has(''))throw Error('V2_AMBIGUOUS_IDENTITY');
 const signature=(x:IPCB_PrimitivePour)=>JSON.stringify([x.getState_Net(),x.getState_Layer(),x.getState_PourName(),x.getState_PourFillMethod(),x.getState_PourPriority(),x.getState_LineWidth(),x.getState_ComplexPolygon().getSource()]);
 const previous=new Map(before.map(x=>[x.getState_PrimitiveId(),signature(x)]));
 let id:string|undefined;
 let poured=false;
 c.prepare(async()=>{
  if(!id||beforeIds.has(id))return {changed:null,verification:unavailable()};
  const after=array(await eda.pcb_PrimitivePour.getAll()),byId=new Map(after.map(x=>[x.getState_PrimitiveId(),x]));
  if(byId.size!==after.length||byId.has('')||after.some(x=>!beforeIds.has(x.getState_PrimitiveId())&&x.getState_PrimitiveId()!==id)||[...previous].some(([key,value])=>!byId.has(key)||signature(byId.get(key)!)!==value))return {changed:null,verification:unavailable()};
  const fresh=byId.get(id);
  if(!fresh || name!==undefined&&fresh.getState_PourName()!==name)return {changed:null,verification:unavailable()};
  const complete=fresh.getState_Net()===net&&fresh.getState_Layer()===layer&&fresh.getState_PourFillMethod()===fill&&JSON.stringify(fresh.getState_ComplexPolygon().getSource())===JSON.stringify(polygon.getSource())&&(p.priority===undefined||fresh.getState_PourPriority()===p.priority)&&(p.lineWidth===undefined||fresh.getState_LineWidth()===p.lineWidth);
  // Completion proves the region, not successful copper computation. Rebuild
  // remains best-effort as in a583; its return is business data, never proof.
  if(!complete)return {changed:null,verification:unavailable(),evidence:{created_id:id,current_id:fresh.getState_PrimitiveId()}};
  return observed({primitiveId:fresh.getState_PrimitiveId(),logical_id:logicalPlaneId(fresh),net,layer,fill,poured},['fresh_new_pour_identity','fresh_pour_exact_geometry'],true);
 });
 let made:IPCB_PrimitivePour|undefined;
 await c.effect(async()=>{made=await eda.pcb_PrimitivePour.create(net,layer as TPCB_LayersOfCopper,polygon,fill as EPCB_PrimitivePourFillMethod,undefined,name,p.priority as number|undefined,p.lineWidth as number|undefined);id=made?.getState_PrimitiveId();});
 if(made)try { await c.effect(async()=>{poured=!!(await made!.rebuildCopperRegion());}); } catch { /* Settled rebuild failure does not negate a freshly verified region. */ }
 return c.verify();
} };

export const reportFields: NativeAction['validate'] = p => {
 fields(p,{nets:'object',pairs:'object',groups:'object',telemetry:'boolean',geometry:'boolean',project_uuid:'string',document_uuid:'string',paths:'object',profile_id:'string',reference_net:'string',tolerance_mil:'number'});
 for(const key of ['nets','pairs','groups'])if(p[key]!==undefined&&(!Array.isArray(p[key])||!(p[key] as unknown[]).every(n=>typeof n==='string'&&n)||(p[key] as unknown[]).length>256))throw Error('V2_INVALID_REPORT_SCOPE');
 if(p.paths!==undefined&&!Array.isArray(p.paths))throw Error('V2_INVALID_REPORT_PATHS');
 if(p.telemetry===true)for(const key of Object.keys(p))if(!['telemetry','nets','project_uuid','document_uuid'].includes(key))throw Error('V2_INCOMPATIBLE_TELEMETRY_INPUT:'+key);
};
export function report(query:(input:Record<string,unknown>)=>Promise<{value:unknown;complete:boolean}>):NativeAction {
 return {mode:'V2_NATIVE',scope:'NONE',validate:reportFields,run:async c=>{
  const p=c.request.input,t=c.request.target_ref;
  if(p.project_uuid!==undefined&&p.project_uuid!==t.project_uuid||p.document_uuid!==undefined&&p.document_uuid!==t.document_uuid)throw Error('V2_TARGET_MISMATCH');
  const observation=p.telemetry===true?{value:{},complete:true}:await query(p);
  // Explicit section observation from this query, not inference from diagnostic
  // error strings or old success flags. Preserve partial business report fields.
  if(!observation.complete)return {value:observation.value,changed:false,verification:unavailable()};
  if(p.telemetry!==true&&p.geometry!==true&&p.profile_id===undefined)return observed(observation.value,['fresh_requested_report_sections']);
  const inventory=p.telemetry===true?array(await eda.pcb_Net.getAllNetsName()):[];
  const snapshot=await fastPath.snapshotData(nativePort(),{project_uuid:t.project_uuid,document_uuid:t.document_uuid});
  return observed({report_bundle:'report.v2',native:observation.value,snapshot:snapshot.data,inventory},['fresh_requested_report_sections','fresh_routing_snapshot']);
 }};
}

async function boundLibrary(c: NativeContext): Promise<string> {
 const lib = c.request.target_ref.library_uuid!;
 const p = c.request.input;
 if (p.libraryUuid !== undefined && p.libraryUuid !== lib) throw Error('V2_TARGET_MISMATCH');
 if (p.scope !== undefined) {
  const wanted = p.scope === 'personal' ? await eda.lib_LibrariesList.getPersonalLibraryUuid() : p.scope === 'project' ? await eda.lib_LibrariesList.getProjectLibraryUuid() : undefined;
  if (!wanted || wanted !== lib) throw Error('V2_LIBRARY_SCOPE_MISMATCH');
 }
 return lib;
}
function requestedFieldsEqual(actual: unknown, wanted: unknown): boolean {
 if (Array.isArray(wanted)) return Array.isArray(actual) && actual.length === wanted.length && wanted.every((v,i) => requestedFieldsEqual(actual[i],v));
 if (wanted && typeof wanted === 'object') return !!actual && typeof actual === 'object' && Object.entries(wanted).every(([k,v]) => requestedFieldsEqual((actual as Record<string,unknown>)[k],v));
 return actual === wanted;
}
export function createLibraryAsset(kind:'symbol'|'footprint'|'device'): NativeAction {
 return {mode:'V2_NATIVE',scope:'LIBRARY_ASSET',validate:p=>{
  fields(p,{name:'string',libraryUuid:'string',scope:'string',classification:'object',description:'string',...(kind==='symbol'?{symbolType:'number' as const}:{}),...(kind==='device'?{symbol:'object' as const,footprint:'object' as const,model3D:'object' as const,property:'object' as const}:{})},kind==='device'?['name','symbol']:['name']);
  if(p.classification!==undefined&&(!Array.isArray(p.classification)||!p.classification.every(x=>typeof x==='string')))throw Error('V2_INVALID_CLASSIFICATION');
  for(const key of ['symbol','footprint','model3D'])if(p[key]!==undefined)fields(p[key] as Record<string,unknown>,{uuid:'string',libraryUuid:'string'},['uuid','libraryUuid']);
  if(p.property!==undefined){if(Array.isArray(p.property))throw Error('V2_INVALID_PROPERTY');fields(p.property as Record<string,unknown>,{name:'string',designator:'string',addIntoBom:'boolean',addIntoPcb:'boolean',net:'string',manufacturer:'string',manufacturerId:'string',supplier:'string',supplierId:'string',otherProperty:'object'});}
 },run:async c=>{
  const p=c.request.input,lib=await boundLibrary(c),naming=await namespacedLibraryAssetName(p.name as string),classification=p.classification as string[]|undefined,description=p.description as string|undefined;
  const association=Object.fromEntries(['symbol','footprint','model3D'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
  let id:string|undefined;
  c.prepare(async()=>{
   if(!id)return {changed:null,verification:unavailable()};
   const fresh=kind==='symbol'?await eda.lib_Symbol.get(id,lib):kind==='footprint'?await eda.lib_Footprint.get(id,lib):await eda.lib_Device.get(id,lib);
   const expected={uuid:id,name:naming.name,...(classification?{classification}:{}),...(description!==undefined?{description}:{}),...(kind==='symbol'&&p.symbolType!==undefined?{type:p.symbolType}:{}),...(kind==='device'?{association,...(p.property!==undefined?{property:p.property}:{})}:{})};
   return fresh&&requestedFieldsEqual(fresh,expected)?observed({uuid:id,libraryUuid:lib,...naming,[kind]:fresh},['fresh_asset_identity',...Object.keys(expected).map(k=>'fresh_'+k)],true):{changed:null,verification:unavailable(),evidence:{created_id:id,fresh}};
  });
  await c.effect(async()=>{
   if(kind==='symbol')id=await eda.lib_Symbol.create(lib,naming.name,classification,p.symbolType as ELIB_SymbolType|undefined,description);
   else if(kind==='footprint')id=await eda.lib_Footprint.create(lib,naming.name,classification,description);
   else id=await eda.lib_Device.create(lib,naming.name,classification,association as Parameters<typeof eda.lib_Device.create>[3],description,p.property as ILIB_DeviceExtendPropertyItem|undefined);
  });
  return c.verify();
 }};
}

export const searchFields: NativeAction['validate'] = p => fields(p,{query:'string',libraryUuid:'string',limit:'number',allowFuzzy:'boolean'},['query']);
export const lcscFields: NativeAction['validate'] = p => {
 fields({...p,lcscIds:typeof p.lcscIds==='string'?[p.lcscIds]:p.lcscIds},{lcscIds:'object'},['lcscIds']);
 const ids=typeof p.lcscIds==='string'?[p.lcscIds]:p.lcscIds;
 if(!Array.isArray(ids)||!ids.every(id=>typeof id==='string'))throw Error('V2_INVALID_LCSC_IDS');
};
export const modelSearchFields: NativeAction['validate'] = p => {
 fields(p,{query:'string',libraryUuid:'string',classification:'object',limit:'number'},['query']);
 if(p.classification!==undefined&&(!Array.isArray(p.classification)||!p.classification.every(x=>typeof x==='string')))throw Error('V2_INVALID_CLASSIFICATION');
};
export const titleBlockGetFields: NativeAction['validate'] = p => fields(p,{pageUuid:'string'});

export function declaredReadFields(name:string):NativeAction['validate'] {
 return input=>{
  const entry=(v2Catalog as Record<string,{input:Record<string,string>}>)[name];
  if(!entry)throw Error('V2_CATALOG_MISSING');
  for(const [key,type]of Object.entries(entry.input))if(type.startsWith('!')&&input[key]===undefined)throw Error('V2_MISSING_INPUT:'+key);
  for(const [key,value]of Object.entries(input)){
   const type=entry.input[key];if(!type)throw Error('V2_UNKNOWN_INPUT:'+key);
   const alternatives=type.replace(/^!/, '').split('|');
   const valid=alternatives.some(t=>t==='array'?Array.isArray(value):t==='string[]'?Array.isArray(value)&&value.every(x=>typeof x==='string'):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t&&(t!=='number'||Number.isFinite(value)));
   if(!valid)throw Error('V2_INVALID_INPUT:'+key);
  }
 };
}

function validateComponentPatch(patch:Record<string,unknown>):void {
 for(const [key,value]of Object.entries(patch)) {
  if(['x','y','rotation'].includes(key)){if(typeof value!=='number'||!Number.isFinite(value))throw Error('V2_INVALID_PATCH:'+key);}
  else if(key==='layer'){if(typeof value!=='string'&&typeof value!=='number')throw Error('V2_INVALID_PATCH:'+key);}
  else if(['primitiveLock','addIntoBom'].includes(key)){if(typeof value!=='boolean')throw Error('V2_INVALID_PATCH:'+key);}
  else if(key==='otherProperty'){if(!value||typeof value!=='object'||Array.isArray(value)||!Object.values(value).every(v=>['string','number','boolean'].includes(typeof v)))throw Error('V2_INVALID_PATCH:'+key);}
  else if(value!==null&&typeof value!=='string')throw Error('V2_INVALID_PATCH:'+key);
 }
}
function verifyComponentNativePatch(patch:Record<string,unknown>,fresh:Record<string,unknown>):ReturnType<typeof verifyPcbComponentPatch> {
 const extra=['manufacturer','supplier','otherProperty'];
 const result=verifyPcbComponentPatch(Object.fromEntries(Object.entries(patch).filter(([key])=>!extra.includes(key))),fresh);
 for(const key of extra)if(key in patch){
  const expected=patch[key],actual=fresh[key];
  const satisfied=expected===null?actual===null||actual===undefined||actual==='':key==='otherProperty'?requestedFieldsEqual(actual,expected):actual===expected;
  if(satisfied)result.applied.push(key);else result.notApplied.push({field:key,expected,actual});
 }
 return result;
}

export function copyLibraryAsset(kind:'footprint'|'model3d'):NativeAction {
 return {mode:'V2_NATIVE',scope:'LIBRARY_ASSET',validate:p=>{
  fields(p,{uuid:'string',sourceLibraryUuid:'string',name:'string',libraryUuid:'string',scope:'string',classification:'object'},['uuid','sourceLibraryUuid','name']);
  if(p.classification!==undefined&&(!Array.isArray(p.classification)||!p.classification.every(x=>typeof x==='string')))throw Error('V2_INVALID_CLASSIFICATION');
 },run:async c=>{
  const p=c.request.input,lib=await boundLibrary(c),sourceLib=p.sourceLibraryUuid as string,sourceId=p.uuid as string,naming=await namespacedLibraryAssetName(p.name as string),classification=p.classification as string[]|undefined;
  const get=async(id:string,library:string)=>kind==='footprint'?eda.lib_Footprint.get(id,library):eda.lib_3DModel.get(id,library);
  const source=await get(sourceId,sourceLib);
  if(!source||source.uuid!==sourceId||source.libraryUuid!==sourceLib)throw Error('V2_SOURCE_ASSET_IDENTITY');
  let copiedId:string|undefined;
  c.prepare(async()=>{
   if(!copiedId||copiedId===sourceId&&lib===sourceLib)return {changed:null,verification:unavailable()};
   const fresh=await get(copiedId,lib);
   const expected={uuid:copiedId,libraryUuid:lib,name:naming.name,...(classification!==undefined?{classification}:{})};
   return fresh&&requestedFieldsEqual(fresh,expected)?observed({uuid:copiedId,libraryUuid:lib,...naming,source:{uuid:sourceId,libraryUuid:sourceLib},[kind==='model3d'?'model':'footprint']:fresh},['native_copy_returned_destination_identity','fresh_destination_asset_identity','fresh_requested_metadata'],true):{changed:null,verification:unavailable(),evidence:{copied_id:copiedId,fresh}};
  });
  await c.effect(async()=>{copiedId=kind==='footprint'?await eda.lib_Footprint.copy(sourceId,sourceLib,lib,classification,naming.name):await eda.lib_3DModel.copy(sourceId,sourceLib,lib,classification,naming.name);});
  return c.verify();
 }};
}
export const modelCreate:NativeAction={mode:'V2_NATIVE',scope:'LIBRARY_ASSET',validate:p=>{
 fields(p,{name:'string',dataBase64:'string',description:'string',classification:'object',unit:'string',fileName:'string',mimeType:'string',libraryUuid:'string',scope:'string'},['name','dataBase64']);
 if(p.unit!==undefined&&!['mm','cm','m','mil','inch'].includes(p.unit as string))throw Error('V2_INVALID_UNIT');
 if(p.classification!==undefined&&(!Array.isArray(p.classification)||!p.classification.every(x=>typeof x==='string')))throw Error('V2_INVALID_CLASSIFICATION');
},run:async c=>{
 const p=c.request.input,lib=await boundLibrary(c),naming=await namespacedLibraryAssetName(p.name as string),classification=p.classification as string[]|undefined;
 const bytes=Uint8Array.from(atob(p.dataBase64 as string),x=>x.charCodeAt(0));if(!bytes.length)throw Error('V2_EMPTY_MODEL');
 const file=new File([bytes],(p.fileName as string|undefined)??`${naming.name}.step`,{type:(p.mimeType as string|undefined)??'application/step'});
 let ids:string[]=[];
 c.prepare(async()=>{
  if(!ids.length||new Set(ids).size!==ids.length)return {changed:null,verification:unavailable()};
  const models=await Promise.all(ids.map(id=>eda.lib_3DModel.get(id,lib)));
  if(!models.every((m,i)=>m&&m.uuid===ids[i]&&m.libraryUuid===lib))return {changed:null,verification:unavailable(),evidence:{created_ids:ids,models}};
  const expected={name:naming.name,...(classification!==undefined?{classification}:{}),...(p.description!==undefined?{description:p.description}:{})};
  const value={uuid:ids[0],uuids:ids,libraryUuid:lib,...naming,model:models[0]};
  if(requestedFieldsEqual(models[0],expected))return observed(value,['fresh_all_imported_asset_identities','fresh_primary_model_metadata'],true);
  // Every imported identity is accounted for and all native calls have settled.
  // The asset import landed, but the requested primary metadata did not.
  return {changed:true,value,verification:{verdict:'partial',checked:['fresh_all_imported_asset_identities','fresh_primary_model_metadata'],complete:true,required:2,satisfied:1,residual:1},evidence:{expected,created_ids:ids,models}};
 });
 await c.effect(async()=>{ids=(await eda.lib_3DModel.create(lib,file,classification,((p.unit as string|undefined)??'mm') as Parameters<typeof eda.lib_3DModel.create>[3]))??[];});
 if(ids.length)await c.effect(()=>eda.lib_3DModel.modify(ids[0],lib,naming.name,classification,p.description as string|undefined));
 return c.verify();
}};

export const boardCopy:NativeAction={mode:'V2_NATIVE',scope:'PROJECT_TOPOLOGY',validate:p=>fields(p,{name:'string'},['name']),run:async c=>{
 const project=c.request.target_ref.project_uuid!,name=c.request.input.name as string;
 const before=array(await eda.dmt_Board.getAllBoardsInfo()),sources=before.filter(b=>b.name===name&&b.parentProjectUuid===project);
 if(sources.length!==1)throw Error('V2_BOARD_IDENTITY');
 const source=sources[0],identity=(b:IDMT_BoardItem)=>JSON.stringify([b.parentProjectUuid,b.schematic?.uuid,b.pcb?.uuid]);const bound=identity(source);
 let newName:string|undefined;
 c.prepare(async()=>{
  if(!newName||before.some(b=>b.name===newName))return {changed:null,verification:unavailable()};
  const after=array(await eda.dmt_Board.getAllBoardsInfo()),matches=after.filter(b=>b.name===newName&&b.parentProjectUuid===project);
  if(matches.length!==1)return {changed:null,verification:unavailable()};
  const copy=matches[0];
  const mapping=(!source.schematic||!!copy.schematic?.uuid&&copy.schematic.uuid!==source.schematic.uuid)&&(!source.pcb||!!copy.pcb?.uuid&&copy.pcb.uuid!==source.pcb.uuid);
  const originals=before.every(b=>after.some(a=>a.name===b.name&&identity(a)===identity(b)));
  return mapping&&originals&&after.length===before.length+1?observed({boardName:newName,board:copy,source:{schematicUuid:source.schematic?.uuid,pcbUuid:source.pcb?.uuid}},['native_copy_returned_board_identity','fresh_destination_document_mapping','source_and_other_board_bindings_unchanged'],true):{changed:null,verification:unavailable(),evidence:after};
 });
 await c.effect(async()=>{const live=await eda.dmt_Board.getBoardInfo(name);if(!live||identity(live)!==bound)throw Error('V2_BOARD_IDENTITY_MISMATCH');newName=await eda.dmt_Board.copyBoard(name);});return c.verify();
}};

export function netflagCreate(serialize:(component:unknown)=>unknown):NativeAction {
 const flags={power:'Power',ground:'Ground',analog_ground:'AnalogGround',protective_ground:'ProtectGround',protect_ground:'ProtectGround'} as const;
 const ports={net_port_in:'IN',net_port_out:'OUT',net_port_bi:'BI'} as const;
 return {mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{
  fields(p,{kind:'string',net:'string',x:'number',y:'number',rotation:'number',mirror:'boolean'},['kind','x','y']);
  if(!(p.kind as string in flags)&&!(p.kind as string in ports)&&p.kind!=='net_label'&&p.kind!=='short_circuit')throw Error('V2_UNKNOWN_NETFLAG_KIND');
  if(p.kind!=='short_circuit'&&(typeof p.net!=='string'||!p.net))throw Error('V2_NET_REQUIRED');
 },run:async c=>{
  const p=c.request.input,kind=p.kind as string,label=kind==='net_label';
  const before=new Set((label?array(await eda.sch_PrimitiveAttribute.getAll()):array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll())).map(x=>x.getState_PrimitiveId()));
  let id:string|undefined;
  c.prepare(async()=>{
   if(!id||before.has(id))return {changed:null,verification:unavailable()};
   if(label){const found=array(await eda.sch_PrimitiveAttribute.getAll()).filter(x=>x.getState_PrimitiveId()===id);if(found.length!==1)return {changed:null,verification:unavailable()};const a=found[0];return a.getState_Value()===p.net&&a.getState_X()===p.x&&a.getState_Y()===p.y?observed({primitiveId:id},['fresh_netlabel_identity','fresh_netlabel_value_position'],true):{changed:null,verification:unavailable()};}
   const found=array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll()).filter(x=>x.getState_PrimitiveId()===id);if(found.length!==1)return {changed:null,verification:unavailable()};const a=found[0];
   const type=String(a.getState_ComponentType()),rawName=((a.getState_Component() as {name?:string}|undefined)?.name??a.getState_Name()??'').toLowerCase();
   // Same native marker-name classification used by the baseline group-move
   // business logic; this is not legacy result interpretation.
   let actualKind='';
   if(type==='netflag')actualKind=rawName.includes('analog')?'AnalogGround':rawName.includes('protect')?'ProtectGround':rawName.startsWith('ground')?'Ground':rawName.startsWith('power')?'Power':'';
   else if(type==='netport')actualKind=rawName.endsWith('-bi')?'BI':rawName.endsWith('-in')?'IN':rawName.endsWith('-out')?'OUT':'';
   else if(type==='short_symbol')actualKind='short_circuit';
   const wanted=kind in flags?flags[kind as keyof typeof flags]:kind in ports?ports[kind as keyof typeof ports]:'short_circuit';
   const rotation=(n:number)=>(n%360+360)%360;
   const pose=a.getState_X()===p.x&&a.getState_Y()===p.y&&(p.mirror===undefined||a.getState_Mirror()===p.mirror)&&(p.rotation===undefined||rotation(a.getState_Rotation())===rotation(p.rotation as number)||rotation(a.getState_Rotation())===rotation(-(p.rotation as number)));
   return actualKind===wanted&&pose&&(kind==='short_circuit'||a.getState_Net()===p.net)?observed({primitiveId:id,component:serialize(a)},['fresh_marker_identity_kind','fresh_marker_position_orientation','fresh_marker_net_when_applicable'],true):{changed:null,verification:unavailable(),evidence:{actualKind,wanted,component:serialize(a)}};
  });
  await c.effect(async()=>{
   const made=label?await eda.sch_PrimitiveAttribute.createNetLabel(p.x as number,p.y as number,p.net as string):kind in flags?await eda.sch_PrimitiveComponent.createNetFlag(flags[kind as keyof typeof flags],p.net as string,p.x as number,p.y as number,p.rotation as number|undefined,p.mirror as boolean|undefined):kind in ports?await eda.sch_PrimitiveComponent.createNetPort(ports[kind as keyof typeof ports],p.net as string,p.x as number,p.y as number,p.rotation as number|undefined,p.mirror as boolean|undefined):await eda.sch_PrimitiveComponent.createShortCircuitFlag(p.x as number,p.y as number,p.rotation as number|undefined,p.mirror as boolean|undefined);
   id=made?.getState_PrimitiveId();
  });return c.verify();
 }};
}

export const groupAddNets:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{declaredReadFields('pcb.equal_length_group.add_nets')(p);if(!Array.isArray(p.nets)||!p.nets.length)throw Error('V2_MISSING_NETS');},run:async c=>{
 const name=c.request.input.name as string,nets=c.request.input.nets as string[];
 const pull=async()=>nativeNamedList(await eda.pcb_Drc.getAllEqualLengthNetGroups());
 const before=await pull(),old=before.find(g=>g.name===name);if(!old||!Array.isArray(old.nets))throw Error('V2_GROUP_NOT_FOUND');
 const initial=[...old.nets],added=nets.filter(n=>!initial.includes(n));
 if(!added.length)return observed({name,nets:initial,added:[],alreadyMembers:nets,verified:true},['fresh_exact_group_membership'],false);
 const available=array(await eda.pcb_Net.getAllNetsName());if(!added.every(n=>available.includes(n)))throw Error('V2_NET_NOT_FOUND');
 c.prepare(async()=>{
  const all=await pull(),after=all.find(g=>g.name===name);
  if(!after||!Array.isArray(after.nets)||!initial.every(n=>after.nets.includes(n))||after.nets.some(n=>!initial.includes(n)&&!added.includes(n))||JSON.stringify(all.filter(g=>g.name!==name))!==JSON.stringify(before.filter(g=>g.name!==name)))return {changed:null,verification:unavailable()};
  const landed=added.filter(n=>after.nets.includes(n)),notApplied=added.filter(n=>!after.nets.includes(n));
  return {value:{name,nets:after.nets,added:landed,verified:!notApplied.length,...(notApplied.length?{partial:true,notApplied}:{})},changed:landed.length>0,verification:{verdict:!notApplied.length?'satisfied':landed.length?'partial':'unchanged',checked:['fresh_membership','unrelated_groups','complete_requested_nets'],complete:true,required:added.length,satisfied:landed.length,residual:notApplied.length}};
 });
 await c.effect(async()=>{const fresh=(await pull()).find(g=>g.name===name);if(!fresh||JSON.stringify(fresh.nets)!==JSON.stringify(initial))throw Error('V2_GROUP_DRIFT');await eda.pcb_Drc.addNetToEqualLengthNetGroup(name,added);});
 return c.verify();
}};

export function fastRead(action:string):NativeAction{return read(async c=>{
 const t=c.request.target_ref,p=c.request.input;
 if(p.project_uuid!==undefined&&p.project_uuid!==t.project_uuid||p.document_uuid!==undefined&&p.document_uuid!==t.document_uuid)throw Error('V2_TARGET_MISMATCH');
 const snapshot=await fastPath.snapshotData(nativePort(),{project_uuid:t.project_uuid,document_uuid:t.document_uuid});
 return {fast_observation:'v2',snapshot:snapshot.data};
},declaredReadFields(action));}
