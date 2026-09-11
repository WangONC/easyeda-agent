// Native observations, before JSON can collapse undefined array entries to null.
export interface DrillInventory { complete:boolean; pad_count:number; pads_without_holes:number; via_count:number; pth_count:number; npth_count:number }
interface Pad {getState_PrimitiveId():string;getState_Hole():unknown;getState_Metallization():boolean}
interface Via {getState_PrimitiveId():string;getState_HoleDiameter():number}
export function observeDrills(pads:Pad[],vias:Via[],coverage:boolean):DrillInventory {
 const result:DrillInventory={complete:coverage,pad_count:pads.length,pads_without_holes:0,via_count:vias.length,pth_count:0,npth_count:0};
 const ids=new Set<string>();
 for(const p of pads){
  const id=p.getState_PrimitiveId();if(!id||ids.has(id))result.complete=false;ids.add(id);
  let hole:unknown;try{hole=p.getState_Hole();}catch{result.complete=false;continue;}
  if(hole===null){result.pads_without_holes++;continue;}
  if(!Array.isArray(hole)||!((hole[0]==='ROUND'&&hole.length===2)||(hole[0]==='SLOT'&&hole.length===3))||!hole.slice(1).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)){result.complete=false;continue;}
  let plated:unknown;try{plated=p.getState_Metallization();}catch{result.complete=false;continue;}
  if(plated===true)result.pth_count++;else if(plated===false)result.npth_count++;else result.complete=false;
 }
 for(const v of vias){const id=v.getState_PrimitiveId();if(!id||ids.has(id))result.complete=false;ids.add(id);let hole:unknown;try{hole=v.getState_HoleDiameter();}catch{result.complete=false;continue;}if(typeof hole!=='number'||!Number.isFinite(hole)||hole<=0)result.complete=false;else result.pth_count++;}
 return result;
}
