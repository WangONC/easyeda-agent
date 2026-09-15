import { armDeadline } from './deadlines';

export const V2 = 'execution.v2' as const;
export interface Target {
 scope: 'HOME' | 'PROJECT' | 'DOCUMENT' | 'LIBRARY'; session: string; activation: string;
 project_uuid?: string; document_uuid?: string; document_type?: string; tab_id?: string; library_uuid?: string;
}
export interface Request {
 protocol: typeof V2; action: string; action_revision: string; schema: string;
 request_id: string; operation_id: string; parent_operation_id?: string;
 target_ref: Target; input: Record<string, unknown>; expected_revision?: number; budget_ms: number;
}
export interface Effects {
 effect_started: boolean; state_changed: boolean | null; native_settled: boolean;
 effect_scope: string; reconciled: boolean;
}
export interface Verification {
 verdict: 'satisfied' | 'unchanged' | 'partial' | 'unavailable'; checked: string[];
 complete: boolean; required: number; satisfied: number; residual: number;
}
export interface Timing {
 queue_wait_ms: number; target_binding_guard_ms: number; pre_read_snapshot_ms: number;
 native_effect_ms: number; post_read_ms: number | null; verification_ms: number | null;
 post_read_verification_ms?: number; reconcile_ms: number; total_ms: number;
}
export interface Observation { value?: unknown; evidence?: unknown; verification: Verification; changed: boolean | null }
export interface HandlerResult {
 protocol: typeof V2; operation_id: string; digest: string; target_ref: Target;
 effects: Effects; verification: Verification; timing: Timing; value?: unknown; evidence?: unknown;
}
export interface VerificationStages<T = unknown> {
 read(): Promise<T>;
 verify(fresh: T): Promise<Observation> | Observation;
}
export interface NativeContext {
 request: Request;
 effect<T>(invoke: () => Promise<T> | T): Promise<T>;
 prepare(readback: () => Promise<Observation>): void;
 prepare<T>(stages: VerificationStages<T>): void;
 navigationTarget(target: Target): void;
 verify(): Promise<Observation>;
}
export interface NativeAction {
 mode: 'V2_NATIVE'; scope: string;
 validate(input: Record<string, unknown>): void;
 run(context: NativeContext): Promise<Observation>;
}
export function unavailable(): Verification {
 return { verdict: 'unavailable', checked: [], complete: false, required: 0, satisfied: 0, residual: 0 };
}
export function observed(value: unknown, checked: string[], changed: boolean | null = false): Observation {
 return { value, changed, verification: { verdict: 'satisfied', checked, complete: true, required: checked.length, satisfied: checked.length, residual: 0 } };
}
export function fields(input: Record<string, unknown>, allowed: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'string|number'>, required: string[] = []): void {
 for (const [k,v] of Object.entries(input)) {
  if (!(k in allowed) || !(allowed[k] === 'string|number' ? typeof v === 'string' || typeof v === 'number' : typeof v === allowed[k]) || v === null || (typeof v === 'number' && !Number.isFinite(v))) throw Error('V2_INVALID_INPUT:' + k);
 }
 for (const k of required) if (!(k in input) || input[k] === '') throw Error('V2_MISSING_INPUT:' + k);
}
function sameTarget(a: Target,b: Target): boolean {
 return (['scope','session','activation','project_uuid','document_uuid','document_type','tab_id','library_uuid'] as const).every(k=>a[k]===b[k]);
}
interface Slot { digest: string; promise: Promise<HandlerResult>; reconcile?: () => Promise<HandlerResult>; result?: HandlerResult; sealed?: boolean }
// Activation-local ownership is independent of FIFO abandonment and WebSocket
// lifetime. Reconnecting the transport does not clear these records.
export class ControlledExecutor {
 private slots = new Map<string, Slot>();
 private owner: string | undefined;
 constructor(private resolve: (name: string) => NativeAction | undefined, private target: (wanted: Target) => Promise<Target>, private capacity = 2048, private schedule: (run: () => Promise<HandlerResult>, request: Request) => Promise<HandlerResult> = run=>run()) {}
 execute(request: Request,digest: string,deadlineAt = Date.now()+request.budget_ms): Promise<HandlerResult> {
  const old=this.slots.get(request.operation_id);
  if (old) {
   if (old.digest!==digest) return Promise.reject(Error('V2_OPERATION_ID_CONFLICT'));
   return old.promise;
  }
  const action=this.resolve(request.action);
  if (!action) return Promise.reject(Error('V2_ACTION_NOT_MIGRATED'));
  if (request.parent_operation_id) return Promise.reject(Error('V2_CHILD_NOT_SUPPORTED'));
  if (this.slots.size>=this.capacity) return Promise.reject(Error('V2_RECEIPT_CAPACITY'));
  if (action.scope!=='NONE' && this.owner) return Promise.reject(Error('V2_EFFECT_BARRIER'));
  if (action.scope!=='NONE') this.owner=request.operation_id;
  // Reserve the slot before scheduling any Host call, even a context read.
  const deadline=deadlineAt,enqueuedAt=Date.now();
  const promise=Promise.resolve().then(()=>this.schedule(()=>this.run(request,digest,action,deadline,enqueuedAt),request));
  this.slots.set(request.operation_id,{digest,promise});
  return promise;
 }
 release(id: string,digest: string): void {
  const slot=this.slots.get(id);
  if(!slot || slot.digest!==digest || !slot.result?.effects.native_settled) throw Error('V2_FOREIGN_OR_PENDING_RELEASE');
  slot.sealed=true;
  if(this.owner===id)this.owner=undefined;
 }
 async reconcile(id: string): Promise<HandlerResult> {
  const slot=this.slots.get(id);
  if(slot?.sealed && slot.result)return slot.result;
  if(!slot?.result || !slot.reconcile) throw Error("V2_RECONCILIATION_UNAVAILABLE");
  return slot.reconcile();
 }
 private async run(request: Request,digest: string,action: NativeAction,deadline: number,enqueuedAt: number): Promise<HandlerResult> {
  const startedAt=Date.now();
  const timing:Timing={queue_wait_ms:Math.max(0,startedAt-enqueuedAt),target_binding_guard_ms:0,pre_read_snapshot_ms:0,native_effect_ms:0,post_read_ms:null,verification_ms:null,reconcile_ms:0,total_ms:0};
  const effects: Effects={effect_started:false,state_changed:false,native_settled:true,effect_scope:action.scope,reconciled:false};
  let expired=Date.now()>=deadline;
  let verifier: (()=>Promise<Observation>) | undefined;
  let splitVerifier: VerificationStages<unknown> | undefined;
  let destination:Target|undefined;
  let verifying=false;
  let activeNative=0;
  let accepting=true;
  let actionStartedAt=0,preReadCaptured=false;
  let pendingDone:Promise<void>|undefined;
  const cancel=armDeadline(Math.max(0,deadline-Date.now()),()=>{expired=true;});
  const result: HandlerResult={protocol:V2,operation_id:request.operation_id,digest,target_ref:request.target_ref,effects,verification:unavailable(),timing};
  const guard=async()=>{
   const began=Date.now();
   try {
    try {if(sameTarget(await this.target(request.target_ref),request.target_ref))return;}catch{/* a registered navigation destination is checked below */}
    if(effects.effect_started&&destination&&sameTarget(await this.target(destination),destination))return;
    throw Error('V2_TARGET_MISMATCH');
   } finally {timing.target_binding_guard_ms+=Math.max(0,Date.now()-began);}
  };
  const runVerifier=async(reconcile:boolean)=>{
   const began=Date.now();
   try {
    if(splitVerifier){
     const readAt=Date.now(),fresh=await splitVerifier.read();
     const readMS=Math.max(0,Date.now()-readAt),verifyAt=Date.now(),observation=await splitVerifier.verify(fresh),verifyMS=Math.max(0,Date.now()-verifyAt);
     timing.post_read_ms=(timing.post_read_ms??0)+readMS;
     timing.verification_ms=(timing.verification_ms??0)+verifyMS;
     return observation;
    }
    if(!verifier)throw Error('V2_VERIFICATION_NOT_READY');
    const observation=await verifier(),elapsed=Math.max(0,Date.now()-began);
    timing.post_read_verification_ms=(timing.post_read_verification_ms??0)+elapsed;
    return observation;
   } finally {if(reconcile)timing.reconcile_ms+=Math.max(0,Date.now()-began);}
  };
  try {
   action.validate(request.input);
   await guard();
   actionStartedAt=Date.now();
   let observation=await action.run({request,navigationTarget:target=>{
    if(effects.effect_started||action.scope!=='NAVIGATION_SELECTION'||target.session!==request.target_ref.session||target.activation!==request.target_ref.activation||target.scope!=='PROJECT'||!target.project_uuid)throw Error('V2_INVALID_NAVIGATION_TARGET');
    if(destination&&!sameTarget(destination,target))throw Error('V2_NAVIGATION_TARGET_ALREADY_BOUND');
    destination={...target};
   },prepare:(readback: (()=>Promise<Observation>) | VerificationStages<unknown>)=>{
    if(effects.effect_started) throw Error('V2_VERIFIER_MUST_BE_PREPARED_BEFORE_EFFECT');
    if(typeof readback==='function')verifier=readback;
    else {splitVerifier=readback;verifier=()=>runVerifier(false);}
   },verify:async()=>{
    if(!verifier || activeNative) throw Error('V2_VERIFICATION_NOT_READY');
    verifying=true;try{return await runVerifier(false);}finally{verifying=false;}
   },effect:async invoke=>{
    if (!verifier) throw Error('V2_SCOPED_VERIFIER_REQUIRED_BEFORE_EFFECT');
    if (!accepting || action.scope==='NONE' || verifying || activeNative || expired || Date.now()>=deadline) throw Error('V2_EFFECT_NOT_ADMITTED');
    if(!preReadCaptured){timing.pre_read_snapshot_ms=Math.max(0,Date.now()-actionStartedAt);preReadCaptured=true;}
    activeNative++;let finished!:()=>void;pendingDone=new Promise<void>(r=>{finished=r;});
    try {await guard();
     if(expired || Date.now()>=deadline)throw Error('V2_DEADLINE');
     effects.effect_started=true;effects.state_changed=null;effects.native_settled=false;
     const began=Date.now();try{return await invoke();}finally{timing.native_effect_ms+=Math.max(0,Date.now()-began);}
    }finally{activeNative--;effects.native_settled=activeNative===0;finished();}
   }});
   if(!preReadCaptured){timing.pre_read_snapshot_ms=Math.max(0,Date.now()-actionStartedAt);preReadCaptured=true;}
   accepting=false;
   if(activeNative && pendingDone){await pendingDone;if(verifier){observation=await runVerifier(true);effects.reconciled=true;}}
   // run() must perform its semantic readback after awaiting native settlement.
   // A target change at any point invalidates its entire observation.
   await guard();
   expired ||= Date.now()>=deadline;
   if(expired && effects.effect_started) {
    if(!verifier) {observation={changed:null,verification:unavailable()};}
    else {verifying=true;try{observation=await runVerifier(true);await guard();effects.reconciled=true;}finally{verifying=false;}}
   }
   result.verification=observation.verification; result.value=observation.value; result.evidence=observation.evidence;
   effects.state_changed=observation.changed;

  } catch (e) {
   accepting=false;
   if(activeNative && pendingDone)await pendingDone;
   result.evidence={error:String(e)};
   // Native rejection (including a rejection after the caller deadline) cannot
   // skip the pre-registered scoped readback. This path NEVER invokes run().
   if(effects.effect_started && effects.native_settled && verifier) {
    try {
     await guard();verifying=true;const observation=await runVerifier(true);await guard();
     result.verification=observation.verification;result.value=observation.value;
     result.evidence={handler_error:String(e),readback:observation.evidence};
     effects.state_changed=observation.changed;effects.reconciled=true;
    } catch(readError) {result.evidence={handler_error:String(e),readback_error:String(readError)};}
    finally {verifying=false;}
   }
   // A pre-effect refusal is proven by the controlled boundary, not an error code.
   if (!effects.effect_started) {
    effects.reconciled=expired||Date.now()>=deadline;
    result.verification={verdict:'unchanged',checked:['controlled_effect_entry_not_called'],complete:true,required:1,satisfied:0,residual:1};
   }
  } finally { cancel.cancel();timing.total_ms=Math.max(0,Date.now()-enqueuedAt); }
  const slot=this.slots.get(request.operation_id)!;
  slot.result=result;
  if(verifier) slot.reconcile=async()=>{
   await guard();verifying=true;let observation:Observation;try{observation=await runVerifier(true);await guard();}finally{verifying=false;}
   timing.total_ms=Math.max(0,Date.now()-enqueuedAt);
   const fresh: HandlerResult={...result,effects:{...effects,state_changed:observation.changed,reconciled:true},verification:observation.verification,timing:{...timing},value:observation.value,evidence:observation.evidence};
   slot.result=fresh;return fresh;
  };
  return result;
 }
}
