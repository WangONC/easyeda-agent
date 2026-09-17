export function projectV2(result) {
 if (!result || result.protocol !== 'execution.v2' || !['SUCCEEDED','NOT_APPLIED','PARTIAL','UNKNOWN','RETIRED_UNRESOLVED'].includes(result.outcome)) throw Error('V2_MALFORMED_RESULT');
 const e=result.effects;
 if(typeof result.operation_id!=='string'||!result.operation_id||result.evidence_ref!==result.operation_id||!e||typeof e.effect_scope!=='string'||!e.effect_scope||![e.effect_started,e.state_changed].every(v=>v===null||typeof v==='boolean')||typeof e.native_settled!=='boolean'||typeof e.reconciled!=='boolean')throw Error('V2_MALFORMED_RESULT');
 return {isError:result.outcome !== 'SUCCEEDED',structuredContent:result,content:[{type:'text',text:JSON.stringify(result)}]};
}
