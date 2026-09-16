import { type NativeAction, unavailable } from './execution-v2';
import { canonical, fastPath, normalizeRotation, validPlacements, type NativePort, type Primitive } from './fast-path';
import { nativePort } from './fast-path-native';
import { declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';

const pose=(p:Primitive)=>canonical([p.id,p.x,p.y,normalizeRotation(p.rotation??0),p.layer,p.locked,p.bbox]);

export function placementBatch(port:()=>NativePort=nativePort):NativeAction {
 return {mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>{declaredReadFields('placement.apply_batch')(p);validPlacements(p.placements)},run:async c=>{
  const p=c.request.input;if(p.client_transaction_id!==c.request.operation_id)throw Error('V2_TRANSACTION_ID_MISMATCH');
  const bound={...p,project_uuid:c.request.target_ref.project_uuid,document_uuid:c.request.target_ref.document_uuid};
  validPlacements(p.placements);const placements=p.placements,n=port();
  const before=(await fastPath.snapshotData(n,bound)).data;if(before.board_revision!==p.base_revision)throw Error('V2_REVISION_MISMATCH');
  const old=new Map(before.components.map(x=>[x.id,x]));
  for(const q of placements){const x=old.get(q.primitiveId);if(!x)throw Error('PLACEMENT_COMPONENT_MISSING');if(x.locked&&(x.x!==q.x||x.y!==q.y||normalizeRotation(x.rotation??0)!==q.rotation||x.layer!==q.layer||q.locked===false))throw Error('PLACEMENT_COMPONENT_LOCKED')}
  if(!n.place)throw Error('PLACEMENT_NATIVE_UNAVAILABLE');
  const attempted=new Set<number>(),errors=new Map<number,string>();let failed:number|null=null;
  c.prepare(async()=>{
   const after=(await fastPath.snapshotData(n,bound)).data,now=new Map(after.components.map(x=>[x.id,x]));
   const items=placements.map((q,index)=>{const x=now.get(q.primitiveId);const ok=!!x&&x.x===q.x&&x.y===q.y&&normalizeRotation(x.rotation??0)===q.rotation&&x.layer===q.layer&&(q.locked===undefined||x.locked===q.locked);return{index,id:q.primitiveId,status:ok?'applied':attempted.has(index)?'failed':'skipped',postcondition_satisfied:ok,attempted:attempted.has(index),error:errors.get(index)}});
   const unrelated=[...old].filter(([id])=>!placements.some(q=>q.primitiveId===id)).every(([id,x])=>pose(now.get(id)!)===pose(x));
   const identity=after.components.length===before.components.length&&[...old.keys()].every(id=>now.has(id));
   const satisfied=items.filter(x=>x.postcondition_satisfied).length;
   const value={status:identity&&unrelated&&satisfied===placements.length?'complete':failed===null?'uncertain':'partial',applied:items.filter(x=>x.postcondition_satisfied).map(x=>x.id),failed:items.filter(x=>x.status==='failed').map(x=>x.id),skipped:items.filter(x=>x.status==='skipped').map(x=>x.id),item_results:items,failed_index:failed,revision_before:before.board_revision,revision_after:after.board_revision,readback_verified:identity&&unrelated&&satisfied===placements.length,native_api_call_count:n.calls};
   if(!identity||!unrelated)return{value,changed:null,verification:unavailable()};
   return covered(value,placements.length,satisfied,placements.some(q=>pose(old.get(q.primitiveId)!)!==pose(now.get(q.primitiveId)!)),['fresh_exact_component_pose_lock','unrelated_components_unchanged','component_identity_set_unchanged','fresh_board_revision']);
  });
  for(let i=0;i<placements.length;i++){try{await c.effect(async()=>{attempted.add(i);await n.place!(placements[i])})}catch(e){failed=i;errors.set(i,String(e));break}}
  return c.verify();
 }};
}
