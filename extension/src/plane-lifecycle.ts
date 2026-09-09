/// <reference types="@jlceda/pro-api-types" />
import { ActionError } from './protocol';

const previous = new Map<string,string>();
export function logicalPlaneId(p: IPCB_PrimitivePour): string {
 return p.getState_PourName() || `${p.getState_Net()}@L${Number(p.getState_Layer())}`;
}
export async function refreshPlanes(payload: Record<string,unknown>) {
 const project=await eda.dmt_Project.getCurrentProjectInfo();
 const doc=await eda.dmt_SelectControl.getCurrentDocumentInfo();
 if (!project?.uuid || !doc?.uuid || doc.documentType!==3 || payload.project_uuid!==project.uuid || payload.document_uuid!==doc.uuid)
  throw new ActionError('DOCUMENT_GUARD','Plane refresh requires exact active project_uuid/document_uuid');
 const requested=payload.logical_ids;
 if (!Array.isArray(requested)||!requested.length||requested.length>64||!requested.every(v=>typeof v==='string'&&v.length>0)||new Set(requested).size!==requested.length)
  throw new ActionError('INVALID_PAYLOAD','logical_ids must contain 1..64 distinct handles');
 let calls=2;const started=Date.now();
 const read=async()=>{calls++;return eda.pcb_PrimitivePour.getAll()};
 const initial=await read();const results=[];
 let identityLost=false;
 const sameDocument=async()=>{
  calls+=2;
  const active=await eda.dmt_SelectControl.getCurrentDocumentInfo();
  const currentProject=await eda.dmt_Project.getCurrentProjectInfo();
  return active?.uuid===doc.uuid&&active.documentType===3&&currentProject?.uuid===project.uuid;
 };
 for(const logical of requested as string[]) {
  if(identityLost){results.push({logical_id:logical,status:'not_started',failure_reason:'document identity changed; remaining rebuilds stopped'});continue}
  const matches=initial.filter(p=>logicalPlaneId(p)===logical);
  if(matches.length!==1){results.push({logical_id:logical,status:'failed',failure_reason:matches.length?'ambiguous logical handle':'logical plane not found'});continue}
  const p=matches[0];const key=`${project.uuid}/${doc.uuid}/${logical}`;
  const old=previous.get(key)??p.getState_PrimitiveId();let reason: string|undefined;
  try {
   if(!(await sameDocument())){identityLost=true;throw new Error('document identity changed')}
   calls++;if(!(await p.rebuildCopperRegion()))reason='native rebuild returned no copper region';
  }catch(e){reason=String(e)}
  // Resolve only inside the original document. A drift must never bind a
  // logical handle to a different PCB or start another native rebuild.
  if(!identityLost&&!(await sameDocument()))identityLost=true;
  const now=identityLost?[]:(await read()).filter(p=>logicalPlaneId(p)===logical);
  if(!identityLost&&!(await sameDocument()))identityLost=true;
  if(identityLost){results.push({logical_id:logical,status:'uncertain',previous_native_id:old,current_native_id:null,failure_reason:'document identity changed; readback untrusted',connectivity:'unknown'});continue}
  const current=now.length===1?now[0].getState_PrimitiveId():null;
  if(!current)reason=reason??'logical handle missing or ambiguous after rebuild';
  if(current){if(previous.size>=1024&&!previous.has(key))previous.clear();previous.set(key,current)}
  results.push({logical_id:logical,net:p.getState_Net(),layer:Number(p.getState_Layer()),previous_native_id:old,current_native_id:current,
   recreated:current!==null&&old!==current,status:reason?'failed':'complete',failure_reason:reason??null,connectivity:'unknown'});
 }
 return {status:results.every(r=>r.status==='complete')?'complete':'partial',item_results:results,
  requested_scope:{logical_ids:requested},actual_scope:'selected native pours; native solver dependency scope not observable',
  freshness:'requires_authoritative_snapshot',revision:null,old_preflight_invalidated:true,native_api_call_count:calls,duration_ms:Date.now()-started};
}
