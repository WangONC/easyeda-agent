/// <reference types="@jlceda/pro-api-types" />
// Opt-in raw observations only. Never sets/imports a netlist or interprets DRC.
async function textObservation(read:()=>Promise<unknown>) {
 try { const value=await read();
  if(typeof value!=='string'||!value.length) return {status:'unavailable',reason:'native returned no nonempty string'};
  if(value.length>4*1024*1024) return {status:'unavailable',reason:'native netlist exceeds diagnostic limit',length:value.length};
  return {status:'observed',raw:value};
 } catch(e) {return {status:'unavailable',reason:String(e)};}
}
export async function netlistDiagnostic(kind:'pcb'|'schematic', components:unknown[]) {
 const bindings=components.map(item=>{
  const object=item as Record<string,unknown>;const out:Record<string,unknown>={};
  for(const field of ['PrimitiveId','UniqueId','Designator','Component','Device','Symbol','Footprint','Pads','AddIntoPcb']) {
   const getter=object['getState_'+field];
   if(typeof getter!=='function'){out[field]={status:'not_exposed'};continue;}
   try {const value=getter.call(item);out[field]=value===undefined?{status:'undefined'}:{status:'observed',value};}
   catch(e){out[field]={status:'unavailable',reason:String(e)};}
  }
  return out;
 });
 const file=await textObservation(async()=>{
  const f=kind==='pcb'?await eda.pcb_ManufactureData.getNetlistFile():await eda.sch_ManufactureData.getNetlistFile();
  return f?await f.text():undefined;
 });
 const stored=kind==='pcb'?await textObservation(()=>eda.pcb_Net.getNetlist()):{status:'not_called',reason:'deprecated schematic getter; authoritative manufacture file used'};
 return {kind,bindings,manufacture_netlist:file,stored_netlist:stored,net_uuid_getter:'not exposed by inspected public Net/Pad interfaces; raw netlist may contain internal fields'};
}
