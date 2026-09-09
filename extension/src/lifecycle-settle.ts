import { ActionError } from './protocol';

export interface SchematicIdentity { uuid:string;parentProjectUuid:string;page?:unknown[];parentBoardName?:string }
interface ReadPort { current():Promise<string>; inventory():Promise<SchematicIdentity[]>; wait(ms:number):Promise<void> }
// No empty observation can prove a freshly opened Host has finished initializing.
// Require positive inventory evidence; empty at the deadline remains unknown.
export async function settleSchematic(port:ReadPort,project:string,uuid?:string,attempts=41,interval=250):Promise<SchematicIdentity|undefined>{
 let previous='';
 for(let i=0;i<attempts;i++) {
  if(await port.current()!==project)throw new ActionError('DOCUMENT_GUARD','Project changed during schematic settlement');
  let items:SchematicIdentity[]|undefined;
  try {items=await port.inventory();}catch { /* bounded readback, never replay create */ }
  if(await port.current()!==project)throw new ActionError('DOCUMENT_GUARD','Project changed during schematic readback');
  if(items) {
   const found=items.filter(s=>s.parentProjectUuid===project&&(!uuid||s.uuid===uuid));
   if(found.length>1)throw new ActionError('SCHEMATIC_IDENTITY_AMBIGUOUS','Multiple candidate schematic containers; no create');
   const pages=found[0]?.page;
   const ready=found.length===1&&(uuid!==undefined||(Array.isArray(pages)&&pages.length>0&&pages.every(p=>typeof (p as {uuid?:unknown})?.uuid==='string')));
   const signature=ready?JSON.stringify([found[0].uuid,pages]):'';
   if(ready&&signature===previous)return found[0];
   previous=signature;
  }else previous='';
  if(i+1<attempts)await port.wait(interval);
 }
 return undefined;
}
