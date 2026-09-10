import { interpret } from './execution.generated.mjs';
// Same reducer for every action. Raw envelope, native status and errors survive.
export function authoringResult(action, invocation, payload = {}) {
 const envelope = invocation.ok ? invocation.result : invocation.error?.stdout;
 if (!envelope || typeof envelope !== 'object') return invocation;
 const evidence = 'ok' in envelope || envelope.result !== undefined || envelope.execution ? envelope : {ok:invocation.ok,result:envelope};
 const execution = interpret({action,payload,id:evidence.id}, evidence);
 const value = {...evidence, execution};
 return execution.request_satisfied ? {ok:true,result:value,...(invocation.stderr?{stderr:invocation.stderr}:{})} : {ok:false,error:{...value,evidence:envelope,warnings:invocation.stderr,invocation_error:invocation.error}};
}
