import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export const DOMAIN_NAMES = [
  'artifact',
  'board',
  'document',
  'pcb',
  'project',
  'schematic',
  'system',
];

export function easyedaBinary() {
  return process.env.EASYEDA_BIN || fileURLToPath(new URL('../../bin/easyeda.exe', import.meta.url));
}

export async function runEasyeda(args, timeoutMs = 300_000) {
  try {
    const { stdout, stderr } = await execFileAsync(easyedaBinary(), args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: timeoutMs,
    });
    return {
      ok: true,
      result: parseOutput(stdout),
      stderr: stderr.trim() || undefined,
    };
  }
  catch (error) {
    return {
      ok: false,
      error: {
        message: error.message,
        code: error.code ?? null,
        stdout: parseOutput(error.stdout || ''),
        stderr: String(error.stderr || '').trim() || undefined,
      },
    };
  }
}

export function parseOutput(stdout) {
  const text = String(stdout).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  }
  catch {
    return text;
  }
}

export function filterActions(actions, { domain, search, mutates } = {}) {
  const needle = String(search || '').trim().toLowerCase();
  return actions.filter((action) => {
    if (domain && action.domain !== domain) return false;
    if (typeof mutates === 'boolean' && action.mutates !== mutates) return false;
    if (!needle) return true;
    return [action.name, action.description, ...(action.inputs || [])]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}

export function buildCallArgs(action, input = {}) {
  const args = [];
  if (input.project) args.push('--project', input.project);
  if (input.doc) args.push('--doc', input.doc);
  const fast = { 'board.snapshot_compact': 'snapshot-compact', 'route.preflight': 'route-preflight', 'route.apply_batch': 'route-apply-batch', 'route.tuning_plan': 'tuning-plan', 'route.pair_plan': 'pair-plan', 'pcb.routing_profile': 'routing-profile', 'pcb.plane.refresh': 'plane-refresh', 'pcb.drc.compare': 'drc-compare', 'pcb.report': 'report', 'pcb.manufacturing.export': 'manufacturing-export' };
  if (fast[action]) args.push('pcb', fast[action]);
  else args.push('call', action);
  if (input.payload && Object.keys(input.payload).length > 0) {
    args.push('--payload', JSON.stringify(input.payload));
  }
  if (input.window) args.push('--window', input.window);
  return args;
}

export function buildWorkflowArgs(input) {
  const allowed = ['operation','project','doc','reconcile','minScore','maxCrossings','confirmation','note','resetAll','resetFrom','profile','tier','parts','empty'];
  for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new Error(`unsupported workflow argument: ${key}`);
  if (!input.project) throw new Error('project is required for workflow operations');
  if (['advance','confirm','set_assembly','confirm_tier'].includes(input.operation) && !input.doc) throw new Error('doc is required for workflow acceptance operations');
  if (input.minScore !== undefined && (!Number.isInteger(input.minScore) || input.minScore < 0 || input.minScore > 100)) throw new Error('minScore must be 0..100');
  if (input.maxCrossings !== undefined && (!Number.isInteger(input.maxCrossings) || input.maxCrossings < -1)) throw new Error('maxCrossings must be >= -1');
  const args = ['--project', input.project];
  if (input.doc) args.push('--doc', input.doc);
  if (input.operation === 'set_assembly') {
    if (!['hand-solder','reflow'].includes(input.profile)) throw new Error('profile must be hand-solder or reflow');
    return [...args, 'pcb', 'stage', 'set-assembly', '--profile', input.profile];
  }
  if (input.operation === 'confirm_tier') {
    if (!Number.isInteger(input.tier) || input.tier < 1 || input.tier > 4) throw new Error('tier must be 1..4');
    if (input.parts !== undefined && (!Array.isArray(input.parts) || input.parts.some(p => typeof p !== 'string' || !p.trim() || p.includes(',')))) throw new Error('parts must contain individual designators');
    if (input.empty && input.parts?.length) throw new Error('empty and parts are mutually exclusive');
    args.push('pcb','stage','confirm-tier',String(input.tier));
    for (const part of input.parts || []) args.push('--parts',part);
    if (input.empty === true) args.push('--empty');
    if (input.note) args.push('--note',input.note);
    return args;
  }
  args.push('workflow', input.operation);
  switch (input.operation) {
    case 'init':
      break;
    case 'status':
      args.push('--json');
      if (input.reconcile) args.push('--reconcile');
      break;
    case 'advance':
      if (Number.isInteger(input.minScore)) args.push('--min-score', String(input.minScore));
      if (Number.isInteger(input.maxCrossings)) args.push('--max-crossings', String(input.maxCrossings));
      break;
    case 'confirm':
      if (!['layout', 'outline'].includes(input.confirmation)) {
        throw new Error('confirmation must be layout or outline');
      }
      args.push(input.confirmation);
      if (input.note) args.push('--note', input.note);
      break;
    case 'reset':
      if (input.resetAll === true) args.push('--all');
      else if (input.resetFrom) args.push('--from', input.resetFrom);
      else throw new Error('reset requires resetAll=true or resetFrom');
      break;
    default:
      throw new Error(`unsupported workflow operation: ${input.operation}`);
  }
  return args;
}

export function buildBlocksArgs(input) {
  switch (input.operation) {
    case 'list':
      return ['blocks', 'ls'];
    case 'search':
      if (!input.query) throw new Error('query is required for blocks search');
      return ['blocks', 'search', input.query];
    case 'show':
      if (!input.id) throw new Error('id is required for blocks show');
      return ['blocks', 'show', input.id];
    default:
      throw new Error(`unsupported blocks operation: ${input.operation}`);
  }
}

export function toMcpResult(execution, options = {}) {
  const rawValue = execution.ok ? execution.result : execution.error;
  const value = execution.ok && execution.stderr
    ? { result: rawValue, warnings: execution.stderr }
    : rawValue;
  const result = {
    content: [{ type: 'text', text: JSON.stringify(value, null, options.compact ? 0 : 2) }],
    isError: !execution.ok,
  };
  if ((execution.ok || options.structuredErrors) && value && typeof value === 'object' && !Array.isArray(value)) {
    result.structuredContent = value;
  }
  return result;
}

export function buildReloadArgs(input) {
  for(const key of Object.keys(input)) if(!['project','doc'].includes(key)) throw new Error(`unsupported reload argument: ${key}`);
  if(!input.project || !input.doc) throw new Error('reload requires project and doc');
  return ['--project',input.project,'doc','reload',input.doc,'--json'];
}
