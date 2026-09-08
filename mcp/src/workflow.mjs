import { buildWorkflowArgs, runEasyeda } from './core.mjs';

// Projection only: Go owns transitions, thresholds, fingerprints and persistence.
export async function runWorkflow(input, run = runEasyeda) {
  const execution = await run(buildWorkflowArgs(input));
  if (input.operation === 'status') return execution.ok ? {ok:true,result:{...execution.result,diagnostics:execution.stderr}} : execution;
  const status = await run(buildWorkflowArgs({operation:'status',project:input.project,doc:input.doc}));
  const details = execution.ok ? execution.stderr : (execution.error?.stderr || execution.error?.message);
  const output = execution.ok ? execution.result : execution.error?.stdout;
  const limit = 6000;
  const clip = value => typeof value === 'string' && value.length > limit ? value.slice(0,limit) : value;
  const value = {
    operation: input.operation,
    command_ok: execution.ok,
    state: status.ok ? status.result : null,
    diagnostics: clip(details),
    error_code: execution.ok ? undefined : execution.error?.code,
    diagnostics_truncated: typeof details === 'string' && details.length > limit,
    output: clip(output),
    output_truncated: typeof output === 'string' && output.length > limit,
    status_error: status.ok ? undefined : status.error,
  };
  return execution.ok && status.ok ? {ok:true,result:value} : {ok:false,error:value};
}
