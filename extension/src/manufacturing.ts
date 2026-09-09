/// <reference types="@jlceda/pro-api-types" />
import {ActionError, type ResponseArtifact} from './protocol';
type ArtifactFactory=(blob:Blob,kind:string,name:string,mime:string)=>Promise<ResponseArtifact>;
export async function manufacturingExport(p:Record<string,unknown>,artifact:ArtifactFactory){
 const profile=p.profile as Record<string,unknown>|undefined;
 if(!profile||profile.reviewed!==true||typeof profile.id!=='string'||!profile.id||profile.units!=='mm'||!Array.isArray(profile.layers)||!profile.layers.length||profile.layers.length>64||!profile.layers.every(l=>Number.isInteger(l))||new Set(profile.layers).size!==profile.layers.length)throw new ActionError('INVALID_PAYLOAD','Reviewed export profile requires id, units:mm and distinct explicit layer IDs');
 if(typeof p.project_uuid!=='string'||typeof p.document_uuid!=='string')throw new ActionError('DOCUMENT_GUARD','Explicit identity required');
 let calls=0;const started=Date.now();
 const guard=async()=>{calls+=2;const project=await eda.dmt_Project.getCurrentProjectInfo();const doc=await eda.dmt_SelectControl.getCurrentDocumentInfo();if(project?.uuid!==p.project_uuid||doc?.uuid!==p.document_uuid||doc?.documentType!==3)throw new ActionError('DOCUMENT_GUARD','Export document changed')};
 await guard();calls++;const layers=await eda.pcb_Layer.getAllLayers();
 if(!(profile.layers as number[]).every(id=>layers.some(l=>l.id===id)))throw new ActionError('INVALID_PAYLOAD','Export profile references nonexistent layer');
 const artifacts:ResponseArtifact[]=[];const items:Record<string,unknown>[]=[];
 const jobs:Array<[string,()=>Promise<File|undefined>,string]>=[
  ['gerber',()=>eda.pcb_ManufactureData.getGerberFile('manufacturing',false,'mm' as ESYS_Unit.MILLIMETER,{integerNumber:4,decimalNumber:6},{metallicDrillingInformation:true,nonMetallicDrillingInformation:true,drillTable:true,flyingProbeTestingFile:false},(profile.layers as number[]).map(layerId=>({layerId,isMirror:false}))),'application/zip'],
  ['bom',()=>eda.pcb_ManufactureData.getBomFile('bom','csv'),'text/csv'],
  ['pnp',()=>eda.pcb_ManufactureData.getPickAndPlaceFile('pnp','csv','mm' as ESYS_Unit.MILLIMETER),'text/csv'],
 ];
 for(const [format,run,mime] of jobs){
  try{
   await guard();calls++;const file=await run();await guard();
   if(!file||!file.size)throw new Error('Native export returned no nonempty File');
   artifacts.push(await artifact(file,`manufacturing_${format}`,file.name||`${format}.${format==='gerber'?'zip':'csv'}`,mime));
   items.push({format,status:'file_returned',bytes:file.size});
  }catch(e){items.push({format,status:'failed',reason:String(e)});break}
 }
 return {artifacts,result:{status:items.length===3&&items.every(i=>i.status==='file_returned')?'unverified':'partial',item_results:items,profile,project_uuid:p.project_uuid,document_uuid:p.document_uuid,native_api_call_count:calls,duration_ms:Date.now()-started,warnings:['Native File presence is not manufacturing package validation; inspect actual archive/CSV and revision in Go manifest.']}};
}
