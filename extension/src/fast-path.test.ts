import { arcPoints } from './compact-polygon';
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesOperation, FastPath, type NativePort, type Observation, type Operation, type Primitive } from './fast-path';
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
test('native hang + queue abandon never permits duplicate or a later primitive; deadline includes queue time',async(t)=>{
 const realNow=Date.now;let clockOffset=0;t.mock.method(Date,'now',()=>realNow()+clockOffset);
 const f=new FastPath(),{n,state}=mock(),p=await request(f,n);const create=n.create;let release!:()=>void;n.create=async o=>{await new Promise<void>(r=>{release=r});return create(o)};
 const q=new ActionQueue({graceMs:0,fallbackTimeoutMs:10});const deadline=Date.now()+60000;
 const pending={...p,expires_at_ms:deadline};
 let batch!:ReturnType<FastPath['apply']>;
 const out=await q.submit({id:'hang',timeoutMs:10,run:()=>batch=f.apply(n,pending)});assert.equal(out.status,'abandoned');
 const dup=(await f.apply(n,p)).result!;assert.equal(dup.status,'uncertain');assert.equal(dup.duplicate,true);clockOffset=60001;release();await batch;assert.equal(state.traces.length,1);assert.equal(state.vias.length,0);
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

test('explicit quarter arc batch validates native readback, signed sweep and compensation',async()=>{
 const op:Operation={type:'add_arc',net:'N',layer:1,width:6,points:[[0,0],[20,20]],arc_angle:90};
 for(const corrupt of [false,true]){
  const f=new FastPath(),{n,state}=mock();n.create=async o=>{state.traces.push({id:'arc',kind:'arc',net:o.net,layer:o.layer,width:o.width,arc_angle:corrupt?-90:o.arc_angle,points:arcPoints(o.points![0],o.points![1],o.arc_angle!)});return 'arc'};
  const p=await request(f,n,`arc-${corrupt}`);p.operations=[op];const r=(await f.apply(n,p)).result!;assert.equal(r.status,corrupt?'uncertain':'complete');assert.equal(r.readback_verified,!corrupt);
 }
 const f=new FastPath(),{n,state}=mock();let calls=0;let removed='';n.create=async()=>{if(++calls===2)throw Error('native failed');state.traces.push({id:'arc',kind:'arc',net:'N'});return 'arc'};n.remove=async(kind)=>{removed=kind;state.traces.splice(0);return true};
 const p=await request(f,n,'arc-rollback');p.operations=[op,operations[0]];const r=(await f.apply(n,p)).result!;assert.equal(r.status,'uncertain');assert.equal(removed,'arc');assert.equal(state.traces.length,0);
});

test('EDA 3.2 rounded getter lattice never widens explicit arc readback matching',()=>{
 const op:Operation={type:'add_arc',net:'N',layer:1,width:6,arc_angle:-90,points:[[200,548.5066385686536],[206,554.5066385686536]]};
 const quantized=op.points!.map(p=>p.map(v=>Math.round(v*10+1e-10)/10) as [number,number]);
 const observed:Primitive={id:'native',kind:'arc',net:'N',layer:1,width:6,arc_angle:-90,points:arcPoints(quantized[0],quantized[1],-90)};
 assert.equal(matchesOperation(observed,op),false);
 assert.equal(matchesOperation(observed,{...op,points:quantized}),true);
 assert.equal(matchesOperation({...observed,arc_angle:90},{...op,points:quantized}),false);
});


test('Host line45 IEEE roundoff verifies, actual coordinate changes remain uncertain',async()=>{
 const op:Operation={type:'add_trace',net:'N',layer:1,width:6,points:[[100,60],[108.48528137423857,94.97056274847712]]};
 const p:Primitive={id:'native',kind:'trace',net:'N',layer:1,width:6,points:[[100,60],[108.48528137423857,94.97056274847711]]};
 assert.equal(matchesOperation(p,op),true);
 for(const delta of [1e-8,1e-5,0.1]) assert.equal(matchesOperation({...p,points:[[100,60],[op.points![1][0],op.points![1][1]+delta]]},op),false);
 assert.equal(matchesOperation({...p,net:'OTHER'},op),false);
 assert.equal(matchesOperation({...p,layer:2},op),false);
 for(const drift of [0,1e-5]) {
  const f=new FastPath(),{n,state}=mock();const original=n.create;
  n.create=async o=>{const id=await original(o);state.traces[0].points=[[100,60],[108.48528137423857,94.97056274847711+drift]];return id};
  const requestPayload=await request(f,n);requestPayload.operations=[op];
  const r=(await f.apply(n,requestPayload)).result!;
  assert.equal(r.status,drift===0?'complete':'uncertain');
  assert.equal(r.readback_verified,drift===0);
 }
});
