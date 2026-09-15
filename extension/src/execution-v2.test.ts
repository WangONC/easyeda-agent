import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, fields, observed, V2, type Request, type NativeAction } from './execution-v2';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
const req=(id:string):Request=>({protocol:V2,action:'test',action_revision:'1',schema:'schema',request_id:'request',operation_id:id,target_ref:target,input:{},budget_ms:10});
test('pending native promise retains ownership, duplicate never writes twice; reconcile only reads',async()=>{
 let settle!:()=>void;const native=new Promise<void>(r=>{settle=r;});let writes=0,reads=0;
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>fields(p,{}),run:async c=>{
  c.prepare(async()=>{reads++;return observed({exists:true},['fresh_identity'],true);});
 await c.effect(async()=>{writes++;await native;});
  return c.verify();
 }};
 const runtime=new ControlledExecutor(()=>action,async()=>target);
 const first=runtime.execute(req('one'),'digest');
 await new Promise(r=>setTimeout(r,20));
 await assert.rejects(runtime.execute(req('two'),'other'),/BARRIER/);
 const same=runtime.execute(req('one'),'digest');assert.equal(same,first);
 await assert.rejects(runtime.execute(req('one'),'different'),/CONFLICT/);
 assert.equal(writes,1);settle();const result=await first;
 assert.equal(result.effects.native_settled,true);assert.equal(result.effects.reconciled,true);
 await assert.rejects(runtime.execute(req('still-blocked'),'b'),/BARRIER/);
 await runtime.reconcile('one');assert.equal(writes,1);assert.ok(reads>=2);
 runtime.release('one','digest');
 assert.throws(()=>runtime.release('one','foreign'),/FOREIGN/);
});
test('target mismatch and unmigrated child cannot enter effect',async()=>{
 let writes=0;
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{c.prepare(async()=>observed({},['fresh'],true));await c.effect(()=>{writes++;});return observed({},['fresh'],true);}};
 const runtime=new ControlledExecutor(()=>action,async()=>({...target,document_uuid:'foreign'}));
 const result=await runtime.execute(req('one'),'digest');assert.equal(writes,0);assert.equal(result.effects.effect_started,false);
 await assert.rejects(runtime.execute({...req('two'),parent_operation_id:'legacy'},'d'),/CHILD/);
 await assert.rejects(new ControlledExecutor(()=>undefined,async()=>target).execute(req('x'),'d'),/NOT_MIGRATED/);
});
test('verified no-op records satisfied and no effect separately',async()=>{
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async()=>observed({locked:true},['fresh_lock'],false)};
 const result=await new ControlledExecutor(()=>action,async()=>target).execute(req('no-op'),'d');
 assert.equal(result.verification.verdict,'satisfied');assert.equal(result.effects.effect_started,false);assert.equal(result.effects.state_changed,false);
});

for(const failure of ['native-rejects-late','throw-after-settle'] as const) test(failure+' still invokes pre-registered fresh readback without replay',async()=>{
 let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});let changed=false,writes=0,reads=0,prepared=false;
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{
  c.prepare(async()=>{reads++;return observed({changed},['fresh_mutated_state'],changed);});prepared=true;
  await c.effect(async()=>{assert.equal(prepared,true);writes++;await wait;changed=true;if(failure==='native-rejects-late')throw Error('native failed after applying');});
  // Simulates exactly the continuation hazard: verify() is never reached.
  throw Error('deadline continuation throws');
 }};
 const runtime=new ControlledExecutor(()=>action,async()=>target);
 const pending=runtime.execute(req('late'),'d');await new Promise(r=>setTimeout(r,20));
 await assert.rejects(runtime.execute(req('blocked'),'b'),/BARRIER/);release();
 const result=await pending;assert.equal(result.effects.native_settled,true);assert.equal(result.effects.reconciled,true);assert.equal(result.verification.verdict,'satisfied');assert.equal(writes,1);assert.equal(reads,1);
 await runtime.reconcile('late');assert.equal(writes,1);assert.equal(reads,2);
});
test('effect without a prepared scoped verifier never invokes native',async()=>{
 let writes=0;
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{await c.effect(()=>{writes++;});return observed({},['fake'],true);}};
 const result=await new ControlledExecutor(()=>action,async()=>target).execute(req('missing'),'d');
 assert.equal(writes,0);assert.equal(result.effects.effect_started,false);assert.match(JSON.stringify(result.evidence),/SCOPED_VERIFIER_REQUIRED/);
});

test('expired queued work never enters native and returns explicit no effect',async()=>{
 let writes=0;const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{c.prepare(async()=>observed({},['fresh'],true));await c.effect(()=>{writes++;});return c.verify();}};
 const result=await new ControlledExecutor(()=>action,async()=>target).execute(req('expired'),'d',Date.now()-10);
 assert.equal(writes,0);assert.equal(result.effects.effect_started,false);assert.equal(result.effects.native_settled,true);assert.equal(result.verification.verdict,'unchanged');assert.equal(result.effects.reconciled,true);
});
test('unknown input returns explicit no-effect evidence before native entry',async()=>{
 let writes=0;const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:p=>fields(p,{}),run:async c=>{writes++;return observed({},['should not run'],true);}};
 const result=await new ControlledExecutor(()=>action,async()=>target).execute({...req('invalid'),input:{surprise:true}},'d');assert.equal(writes,0);assert.equal(result.effects.effect_started,false);assert.equal(result.verification.verdict,'unchanged');
});

test('failed late readback retains ownership; explicit reconciliation reads without replay', async () => {
 let settle!: () => void;
 const native = new Promise<void>(resolve => { settle = resolve; });
 let writes = 0, reads = 0, readbackAvailable = false;
 const action: NativeAction = {
  mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: () => {},
  run: async c => {
   c.prepare(async () => {
    reads++;
    if (!readbackAvailable) throw Error('fresh readback unavailable');
    return observed({ exists: true }, ['fresh_identity'], true);
   });
   await c.effect(async () => { writes++; await native; });
   return c.verify();
  },
 };
 const runtime = new ControlledExecutor(() => action, async () => target);
 const pending = runtime.execute(req('late-readback-failure'), 'digest');
 await new Promise(resolve => setTimeout(resolve, 20));
 settle();
 const unknown = await pending;
 assert.equal(unknown.effects.native_settled, true);
 assert.equal(unknown.verification.verdict, 'unavailable');
 assert.equal(unknown.effects.state_changed, null);
 await assert.rejects(runtime.execute(req('blocked-after-settle'), 'other'), /BARRIER/);
 const failedReads = reads;
 readbackAvailable = true;
 const fresh = await runtime.reconcile('late-readback-failure');
 assert.equal(fresh.effects.reconciled, true);
 assert.equal(fresh.verification.verdict, 'satisfied');
 assert.equal(reads, failedReads + 1);
 assert.equal(writes, 1);
 // Even a successful local readback does not authorize local barrier release.
 await assert.rejects(runtime.execute(req('await-daemon-release'), 'other'), /BARRIER/);
 runtime.release('late-readback-failure', 'digest');
});

test('recovery reads survive transport rebind while pending; only daemon releases settled UNKNOWN', async () => {
 let settle!: () => void;
 const native = new Promise<void>(resolve => { settle = resolve; });
 let writes = 0;
 let current = target;
 const mutation: NativeAction = { mode:'V2_NATIVE', scope:'DESIGN_CONTENT', validate:()=>{}, run:async c=>{
  c.prepare(async()=>{throw Error('semantic proof unavailable');});
  await c.effect(async()=>{writes++;await native;});
  return c.verify();
 }};
 const read: NativeAction = { mode:'V2_NATIVE', scope:'NONE', validate:()=>{}, run:async()=>observed({document:current.document_uuid},['fresh identity'],false) };
 const runtime = new ControlledExecutor(name=>name==='read'?read:mutation,async()=>current);
 const original = req('recovery-original');
 const pending = runtime.execute(original,'original-digest');
 await new Promise(resolve=>setTimeout(resolve,20));
 current={...target,session:'reconnected',tab_id:'rebound-tab'};
 const readRequest={...req('recovery-read'),action:'read',target_ref:current};
 const result=await runtime.execute(readRequest,'read-digest');
 assert.equal(result.effects.effect_started,false);
 assert.equal(result.verification.verdict,'satisfied');
 assert.throws(()=>runtime.release(original.operation_id,'original-digest'),/PENDING/);
 await assert.rejects(runtime.execute({...req('blocked'),target_ref:current},'b'),/BARRIER/);
 settle();
 const unknown=await pending;
 assert.equal(unknown.effects.native_settled,true);
 assert.notEqual(unknown.verification.verdict,'satisfied');
 assert.equal(writes,1);
 // Transport release authorization, not read success, terminates ownership.
 runtime.release(original.operation_id,'original-digest');
 runtime.release(original.operation_id,'original-digest');
 await runtime.execute(original,'original-digest');
 assert.equal(writes,1);
});

test('timing evidence separates queue, guard, snapshot, native, post-read, verification and reconcile', async()=>{
 let state=false;
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{
  await new Promise(r=>setTimeout(r,3));
  c.prepare({read:async()=>{await new Promise(r=>setTimeout(r,3));return state;},verify:async fresh=>{await new Promise(r=>setTimeout(r,3));return observed({state:fresh},['fresh_state'],fresh);}});
  await c.effect(async()=>{await new Promise(r=>setTimeout(r,3));state=true;});
  return c.verify();
 }};
 const scheduled=async(run:()=>Promise<any>)=>{await new Promise(r=>setTimeout(r,5));return run();};
 const runtime=new ControlledExecutor(()=>action,async()=>target,8,scheduled);
 const result=await runtime.execute({...req('timing'),budget_ms:1000}, 'd');
 assert.ok(result.timing.queue_wait_ms>=4);
 assert.ok(result.timing.target_binding_guard_ms>=0);
 assert.ok(result.timing.pre_read_snapshot_ms>=2);
 assert.ok(result.timing.native_effect_ms>=2);
 assert.ok((result.timing.post_read_ms??0)>=2);
 assert.ok((result.timing.verification_ms??0)>=2);
 assert.equal(result.timing.post_read_verification_ms,undefined);
 assert.equal(result.timing.reconcile_ms,0);
 assert.ok(result.timing.total_ms>=result.timing.queue_wait_ms);
 const reconciled=await runtime.reconcile('timing');
 assert.ok(reconciled.timing.reconcile_ms>=5);
});

test('Connector executor uses the daemon absolute deadline without falling back to request budget', async()=>{
 let writes=0;
 const action:NativeAction={mode:'V2_NATIVE',scope:'DESIGN_CONTENT',validate:()=>{},run:async c=>{
  c.prepare(async()=>observed({primitiveId:'wire-1'},['fresh_wire_geometry'],true));
  await c.effect(async()=>{writes++;await new Promise(r=>setTimeout(r,25));});
  return c.verify();
 }};
 const request={...req('forwarded-deadline'),action:'schematic.wire.create',budget_ms:5};
 const result=await new ControlledExecutor(()=>action,async()=>target).execute(request,'d',Date.now()+250);
 assert.equal(writes,1);
 assert.equal(result.effects.reconciled,false,'a hidden request-budget deadline would force reconciliation');
 assert.equal(result.verification.verdict,'satisfied');
});
