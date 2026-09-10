import { interpret } from './execution.generated.mjs';
// Same reducer for every action. Raw envelope, native status and errors survive.
export function authoringResult(action, invocation, payload = {}) {
 const envelope = invocation.ok ? invocation.result : invocation.error?.stdout;
 if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
  return {ok:false,error:{...invocation.error,code:invocation.error?.code ?? 'INVALID_ACTION_RESPONSE',protocol_error:'INVALID_ACTION_RESPONSE',message:invocation.error?.message ?? 'Action returned no JSON object evidence',execution:interpret({action,payload}),evidence:envelope,stdout:envelope,stderr:invocation.stderr ?? invocation.error?.stderr,warnings:invocation.stderr,invocation_error:invocation.error}};
 }
 const evidence = 'ok' in envelope || envelope.result !== undefined || envelope.execution ? envelope : {ok:invocation.ok,result:envelope};
 const execution = interpret({action,payload,id:evidence.id}, evidence);
 const value = {...evidence, execution};
 return execution.request_satisfied ? {ok:true,result:value,...(invocation.stderr?{stderr:invocation.stderr}:{})} : {ok:false,error:{...value,evidence:envelope,warnings:invocation.stderr,invocation_error:invocation.error}};
}
