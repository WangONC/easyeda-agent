import test from 'node:test';
import assert from 'node:assert/strict';
import { FastPath, type NativePort, type Observation, type Operation, type Primitive } from './fast-path';
import { ActionQueue } from './action-queue';

function mock() {
 const state: Observation = { components: [], pads: [], traces: [], vias: [], fills: [], copper_layers: [1,2] };
 let seq = 0;
 const n: NativePort = {
  calls: 0,
  async context() { n.calls += 2; return { projectUuid: 'project', documentUuid: 'pcb', documentType: 'pcb' }; },
  async read() { n.calls += 10; return JSON.parse(JSON.stringify(state)); },
  async create(o: Operation) {
   n.calls++; const id = `id${++seq}`;
   const p: Primitive = o.type === 'add_trace' ? {id,kind:'trace',net:o.net,layer:o.layer,width:o.width,points:o.points} : {id,kind:'via',net:o.net,layer:12,x:o.x??0,y:o.y??0,diameter:o.diameter,hole:o.hole};
   (p.kind==='trace'?state.traces:state.vias).push(p); return id;
  },
  async remove(kind, id) { n.calls++; const group=kind==='trace'?state.traces:state.vias;const i=group.findIndex(p=>p.id===id);if(i<0)return false;group.splice(i,1);return true; },
 };
 return {n,state};
}
const scope={document_uuid:'pcb',project_uuid:'project'};
const operations: Operation[]=[{type:'add_trace',net:'N',layer:1,width:6,points:[[0,0],[100,0]]},{type:'add_trace',net:'N',layer:2,width:6,points:[[100,0],[200,0]]},{type:'add_via',net:'N',x:100,y:0,hole:12,diameter:24,from_layer:1,to_layer:2}];
async function request(f:FastPath,n:NativePort,tx='tx') {const s=await f.snapshot(n,scope);return {...scope,base_revision:s.result!.board_revision,plan_hash:'plan',client_transaction_id:tx,operations,expires_at_ms:Date.now()+60000};}

test('matching/stale revision; mutation changes token; one queue action handles multi trace + via',async()=>{
 const f=new FastPath(),{n,state}=mock(),p=await request(f,n);const unchanged=await f.snapshot(n,scope);assert.equal(unchanged.result!.board_revision,p.base_revision);
 const q=new ActionQueue();const outcome=await q.submit({id:'one',run:()=>f.apply(n,p)});assert.equal(outcome.status,'ok');assert.equal(q.counters().seq,1);
 if(outcome.status!=='ok')return;const r=outcome.value.result!;assert.equal(r.status,'complete');assert.equal(r.readback_verified,true);assert.equal((r.item_results as unknown[]).length,3);assert.equal(state.traces.length,2);assert.equal(state.vias.length,1);assert.notEqual(r.revision_after,p.base_revision);
 const after=await f.snapshot(n,scope);assert.equal(after.result!.board_revision,r.revision_after);
 const stale=await f.apply(n,{...p,client_transaction_id:'stale'});assert.equal(stale.result!.status,'stale');assert.equal(state.traces.length,2);
 const duplicate=await f.apply(n,p);assert.equal(duplicate.result!.duplicate,true);assert.equal(state.traces.length,2);
 await assert.rejects(()=>f.apply(n,{...p,operations:[operations[0]]}),/TRANSACTION_ID_REUSED/);
});
test('GUI geometry and legacy/reload invalidate; stale before any native write',async()=>{
 const f=new FastPath(),{n,state}=mock(),p=await request(f,n);state.vias.push({id:'gui',kind:'via',net:'G',layer:12,x:9,y:9,diameter:24});assert.equal((await f.apply(n,p)).result!.status,'stale');assert.equal(state.traces.length,0);
 const p2=await request(f,n,'legacy');const finish=f.legacyBegin();await assert.rejects(()=>f.snapshot(n,scope),/FAST_STATE_BUSY/);finish();assert.equal((await f.apply(n,p2)).result!.status,'stale');
 const newer=new FastPath();assert.equal((await newer.apply(n,{...p2,client_transaction_id:'reload'})).result!.status,'stale');
});
test('failed native create stops remaining and compensates known IDs honestly',async()=>{
 const f=new FastPath(),{n,state}=mock(),p=await request(f,n);const create=n.create;let calls=0;n.create=async o=>{if(++calls===2)throw new Error('native failed');return create(o)};
 const r=(await f.apply(n,p)).result!;assert.equal(r.status,'uncertain');assert.equal(r.failed_index,1);assert.equal(r.rollback_attempted,true);assert.equal(r.rollback_complete,false);assert.equal(state.traces.length,0);assert.equal(state.vias.length,0);assert.equal(calls,2);
});
test('partial boundary failure can fully compensate; rollback failure remains incomplete',async()=>{
 for(const breakRollback of [false,true]){
  const f=new FastPath(),{n,state}=mock(),p=await request(f,n);const context=n.context;let once=false;
  n.context=async()=>{if(state.traces.length===1&&!once){once=true;throw new Error('context temporarily unavailable')}return context()};
  if(breakRollback)n.remove=async()=>false;
  const r=(await f.apply(n,p)).result!;assert.equal(r.status,'partial');assert.equal(r.rollback_attempted,true);assert.equal(r.rollback_complete,!breakRollback);assert.equal(state.traces.length,breakRollback?1:0);
 }
});
test('native hang + queue abandon never permits duplicate or a later primitive; deadline includes queue time',async()=>{
 const f=new FastPath(),{n,state}=mock(),p=await request(f,n);const create=n.create;let release!:()=>void;n.create=async o=>{await new Promise<void>(r=>{release=r});return create(o)};
 const q=new ActionQueue({graceMs:0,fallbackTimeoutMs:10});const deadline=Date.now()+10;
 const out=await q.submit({id:'hang',timeoutMs:10,run:()=>f.apply(n,{...p,expires_at_ms:deadline})});assert.equal(out.status,'abandoned');
 const dup=(await f.apply(n,p)).result!;assert.equal(dup.status,'uncertain');assert.equal(dup.duplicate,true);release();await new Promise(r=>setTimeout(r,10));assert.equal(state.traces.length,1);assert.equal(state.vias.length,0);
 const result=(await f.apply(n,p)).result!;assert.equal(result.status,'uncertain');assert.equal(result.readback_verified,false);
 await assert.rejects(()=>f.apply(n,{...p,client_transaction_id:'expired',expires_at_ms:Date.now()-1}),/BATCH_EXPIRED/);
});
test('readback mismatch is uncertain; no false success',async()=>{
 const f=new FastPath(),{n}=mock(),p=await request(f,n);n.create=async()=> 'unobserved-id';const r=(await f.apply(n,p)).result!;assert.equal(r.status,'uncertain');assert.equal(r.readback_verified,false);
});
test('document guard and invalid layer refuse before mutating',async()=>{
 const f=new FastPath(),{n,state}=mock();await assert.rejects(()=>f.snapshot(n,{...scope,document_uuid:'other'}),/DOCUMENT_GUARD/);
 const p=await request(f,n);await assert.rejects(()=>f.apply(n,{...p,dryRun:true}),/INVALID_DRY_RUN/);const r=(await f.apply(n,{...p,operations:[{...operations[0],layer:3}]})).result!;assert.equal(r.status,'partial');assert.equal(state.traces.length,0);
});
