import contracts from './action-contracts.json';
import type { RequestFrame, ResponseFrame, Execution } from './protocol';
export function contractFor(action: string) { return (contracts as Record<string, {
    version: string;
    hash: string;
    executor: string;
    effects: string[];
    dry_run: string;
    operations?: string[];
    verification: {
        required: string[];
    };
}>)[action]; }
export function validateContract(req: Partial<RequestFrame> & {
    action: string;
}, executor = 'CONNECTOR'): string | undefined {
    const c = contractFor(req.action);
    if (!c)
        return 'UNKNOWN_ACTION';
    if ((req.contractVersion && req.contractVersion !== c.version) || (req.contractHash && req.contractHash !== c.hash))
        return 'CONTRACT_MISMATCH';
    if (req.payload?.dryRun === true && c.dry_run !== 'preview')
        return 'INVALID_DRY_RUN';
    if (executor === 'CONNECTOR' && c.executor !== 'CONNECTOR')
        return 'EXECUTOR_UNAVAILABLE';
}
const nonempty = (x: unknown) => !!x && typeof x === 'object' && Object.keys(x).length > 0;
export function negativeResult(r: Record<string, unknown>) {
    return r.partial === true || r.verified === false || r.deleted === false || r.disconnected === false || nonempty(r.notApplied) || nonempty(r.survived) || nonempty(r.survivedIds) || (typeof r.survivedTotal === 'number' && r.survivedTotal > 0) || ['partial', 'uncertain', 'stale', 'failed', 'unverified'].includes(String(r.status));
}
export function interpret(req: Partial<RequestFrame> & {
    action: string;
}, resp?: Partial<ResponseFrame>, beforeDispatch = false): Execution {
    const c = contractFor(req.action);
    const mutation = c?.effects.some(e => ['DESIGN_CONTENT', 'PROJECT_TOPOLOGY', 'LIBRARY_ASSET'].includes(e));
    let e: Execution = { operation_id: req.operationId || req.payload?.client_transaction_id as string | undefined, parent_operation_id: req.parentOperationId, request_id: req.id || '', contract_version: c?.version || '', contract_hash: c?.hash || '', expected_target: req.expectedTarget, verification: { state: 'UNAVAILABLE', coverage: 'PARTIAL', required: [], observed: [], missing: [], evidence_refs: [] }, recovery: { state: 'NOT_REQUESTED' }, persistence: { state: 'NOT_REQUESTED' }, request_satisfied: false, next_action: mutation ? 'reconcile_without_replay' : 'inspect', reason: 'legacy evidence does not prove semantic completion' };
    if (mutation)
        e.mutation_outcome = 'UNCERTAIN';
    if (beforeDispatch) {
        if (mutation)
            e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.reason = 'refused before dispatch';
        return e;
    }
    if (!resp)
        return e;
    if (resp.execution !== undefined && resp.execution !== null) {
        const prior = resp.execution;
        if (prior.invalid_evidence != null || !validExecutionShape(prior)) {
            e.invalid_evidence = prior.invalid_evidence ?? prior;
            e.verification.state = 'INVALID';
            e.reason = 'invalid execution structure';
            return e;
        }
    }
    if (req.payload?.dryRun === true && c?.dry_run === 'preview') {
        e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.request_satisfied = resp.ok === true && !negativeResult(resp.result || {});
        e.reason = 'declared no-write preview';
        return e;
    }
    const prior = resp.execution;
    if (prior) {
        const copy = structuredClone(prior);
        copy.persistence = {...prior.persistence};
        copy.recovery = {...prior.recovery};
        e = copy;
        const cvalid = prior.contract_version === c?.version && prior.contract_hash === c?.hash && prior.request_id === (resp.id || '') && (!req.id || req.id === resp.id);
        if (mutation && req.action !== 'route.apply_batch') {
            let valid = cvalid;
            const r = resp.result || {};
            switch (prior.mutation_outcome) {
                case 'NO_WRITE':
                    valid = valid && prior.write_attempted === false && r.mutation_started !== true && !nonempty(r.created_ids) && !nonempty(r.deleted_ids);
                    if (prior.request_satisfied)
                        valid = valid && completeEvidence(prior.verification);
                    break;
                case 'COMPLETE':
                    valid = valid && prior.native_settled === true && !!c?.verification.required.length && completeEvidence(prior.verification) && !negativeResult(r) && prior.recovery?.state !== 'RESTORED';
                    break;
                case 'PARTIAL':
                    valid = valid && prior.native_settled === true && prior.write_attempted === true && completeEvidence(prior.verification);
                    copy.request_satisfied = false;
                    break;
                case 'UNCERTAIN':
                    copy.request_satisfied = false;
                    break;
                default: valid = false;
            }
            if (!valid) {
                copy.mutation_outcome = 'UNCERTAIN';
                copy.request_satisfied = false;
                copy.reason = 'incomplete or conflicting execution evidence';
                copy.next_action = 'reconcile_without_replay';
            }
            return copy;
        }
    }
    if (prior) {
        const valid = prior.contract_version === c?.version && prior.contract_hash === c?.hash && prior.request_id === (resp.id || '') && (!req.id || req.id === resp.id);
        let blocked = !valid || ['INVALID','UNSUPPORTED'].includes(prior.verification?.state);
        if (req.action === 'route.apply_batch' && valid && prior.mutation_outcome === 'NO_WRITE' && prior.write_attempted === false && prior.reason === 'refused before dispatch' && !resp.result) return e;
        if (req.action === 'route.apply_batch' && ((prior.write_attempted === false || prior.mutation_outcome === 'NO_WRITE') && resp.result?.mutation_started === true)) blocked = true;
        if (req.action === 'route.apply_batch' && ((resp.result?.status === 'complete' && prior.recovery.state !== 'NOT_REQUESTED') || (prior.recovery.state === 'RESTORED' && (resp.result?.rollback_attempted !== true || resp.result?.rollback_complete !== true)))) { blocked = true; e.reason = 'recovery conflicts with Fast receipt'; }
        if (req.action === 'route.apply_batch' && prior.item_results != null && canonical(prior.item_results) !== canonical(resp.result?.item_results)) blocked = true;
        if (req.action === 'route.apply_batch') blocked ||= prior.native_settled === false || prior.mutation_outcome === 'UNCERTAIN' || (['COMPLETE','PARTIAL'].includes(prior.mutation_outcome || '') && prior.native_settled !== true);
        else if (!mutation && !prior.request_satisfied) blocked ||= !(c?.effects.includes('ARTIFACT_DELIVERY') && prior.persistence?.state === 'PENDING_DELIVERY');
        if (blocked) {
            e.request_satisfied = false;
            if (mutation) { e.mutation_outcome = 'UNCERTAIN'; e.next_action = 'reconcile_without_replay'; }
            return e;
        }
    }
    e.observed_target_after ??= resp.context;
    const r = resp.result || {};
    if (mutation) {
        if (req.action === 'route.apply_batch') {
            e.mutation_outcome = 'UNCERTAIN'; e.request_satisfied = false;
            e.item_results = r.item_results;
            if (typeof r.mutation_started === 'boolean')
                e.write_attempted = r.mutation_started;
            if (['stale', 'partial'].includes(String(r.status))) {
                if (r.mutation_started === false && fastNoWrite(r))
                    e.mutation_outcome = 'NO_WRITE';
                else if (r.status === 'partial' && fastSettled(r, req.payload || {}, false)) {
                    e.mutation_outcome = 'PARTIAL'; e.native_settled = true;
                }
            }
            if (r.status === 'complete' && fastComplete(r, req.payload || {})) {
                e.mutation_outcome = 'COMPLETE'; e.native_settled = true;
                e.request_satisfied = true;
                e.verification.state = 'AVAILABLE';
                e.verification.coverage = 'COMPLETE';
                if (!e.verification.source) e.verification.source = 'FastPath.matchesOperation';
                if (!e.verification.evidence_refs.length) e.verification.evidence_refs = ['result'];
                e.next_action = 'continue';
                e.reason = 'Fast Path semantic readback';
            }
            if (r.rollback_complete === true && e.mutation_outcome === 'PARTIAL') {
                e.recovery.state = 'RESTORED';
                if (!('evidence_refs' in e.recovery)) e.recovery.evidence_refs = ['result'];
                e.request_satisfied = false;
            }
        }
    }
    else {
        e.request_satisfied = !!c && resp.ok === true && !negativeResult(r) && r.ok !== false && r.saved !== false;
        if (c?.effects.includes('SAVE')) {
            e.request_satisfied = e.request_satisfied && r.saved === true;
            e.persistence.state = e.request_satisfied ? 'SAVE_ACKNOWLEDGED' : 'UNKNOWN';
        }
        if (c?.effects.includes('ARTIFACT_DELIVERY')) {
            const invocationOK = e.request_satisfied;
            e.request_satisfied = e.request_satisfied && !!resp.artifacts?.length && resp.artifacts.every(a => typeof a.path === 'string' && !!a.path && typeof a.sha256 === 'string' && !!a.sha256);
            if (e.request_satisfied) { e.persistence.state = 'DELIVERED'; e.reason = 'artifact delivery completed'; }
            else if (invocationOK && resp.artifacts?.length && resp.artifacts.every(a => (!!a.path && !!a.sha256) || !!a.inlineBase64)) { e.persistence.state = 'PENDING_DELIVERY'; e.reason = 'artifact delivery evidence pending'; }
            else { e.persistence.state = 'DELIVERY_FAILED'; e.reason = 'artifact delivery failed'; }
        }
    }
    if (req.payload?.dryRun === true && c?.dry_run === 'preview') {
        e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.request_satisfied = resp.ok === true && !negativeResult(r);
        e.reason = 'declared no-write preview';
    }
    return e;
}
function completeEvidence(v: Execution['verification']) {
    const text = (s: unknown) => typeof s === 'string' && s.length > 0;
    const list = (a: unknown): a is string[] => Array.isArray(a) && a.every(text);
    return !!v && v.state === 'AVAILABLE' && v.coverage === 'COMPLETE' && list(v.required) && v.required.length > 0 && list(v.missing) && !v.missing.length && list(v.observed) && list(v.evidence_refs) && v.evidence_refs.length > 0 && text(v.activation) && text(v.revision) && text(v.observed_at) && text(v.verifier_version) && text(v.source) && !!v.scope && typeof v.scope === 'object' && !Array.isArray(v.scope) && v.required.every(f => v.observed.includes(f));
}
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0) && new Set(v).size === v.length;
function fastNoWrite(r: Record<string, unknown>) {
    return ids(r.created_ids) && ids(r.deleted_ids) && !r.created_ids.length && !r.deleted_ids.length && Array.isArray(r.item_results) && !r.item_results.length;
}
function fastComplete(r: Record<string, unknown>, payload: Record<string, unknown>) {
    return r.readback_verified === true && r.rollback_attempted === false && r.rollback_complete === false && !negativeResult(r) && fastSettled(r,payload,true);
}
function fastSettled(r: Record<string, unknown>, payload: Record<string, unknown>, complete: boolean) {
    if (r.mutation_started !== true || r.duplicate === true) return false;
    if (typeof r.revision_before !== 'string' || !r.revision_before.trim() || typeof r.revision_after !== 'string' || !r.revision_after.trim()) return false;
    if (r.revision_before === r.revision_after || ('duplicate' in r && typeof r.duplicate !== 'boolean')) return false;
    if (!complete && r.readback_verified !== false) return false;
    if (r.rollback_complete === true && (r.rollback_attempted !== true || nonempty(r.deleted_ids))) return false;
    if ('base_revision' in payload && payload.base_revision !== r.revision_before) return false;
    if ('native_settled' in r && r.native_settled !== true) return false;
    if (typeof r.rollback_attempted !== 'boolean' || typeof r.rollback_complete !== 'boolean') return false;
    if (!ids(r.created_ids) || !ids(r.deleted_ids)) return false;
    const items = r.item_results, ops = payload.operations;
    if (!Array.isArray(items) || !Array.isArray(ops) || !items.length || items.length !== ops.length) return false;
    if (!('failed_index' in r)) return false;
    let failed = -1;
    if (complete) { if (r.failed_index !== null) return false; }
    else { if (typeof r.failed_index !== 'number' || !Number.isInteger(r.failed_index) || r.failed_index < 0 || r.failed_index >= items.length) return false; failed = r.failed_index; }
    const created = new Set<string>(), deleted = new Set<string>(), seen = new Set<string>();
    for (let i=0;i<items.length;i++) {
        const item=items[i], op=ops[i];
        if (!item || typeof item !== 'object' || item.index !== i || !op || typeof op !== 'object') return false;
        const add=['add_trace','add_arc','add_via'].includes(op.type), del=['delete_trace','delete_via'].includes(op.type);
        if (!add && !del) return false;
        const status=failed === i ? 'failed' : failed >= 0 && i > failed ? 'skipped' : 'applied';
        if (item.status !== status) return false;
        if (status !== 'applied') { if ('id' in item) return false; continue; }
        if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        if (add) created.add(item.id); else { if (op.id !== item.id) return false; deleted.add(item.id); }
    }
    return r.created_ids.length === created.size && r.deleted_ids.length === deleted.size && r.created_ids.every(id=>created.has(id)) && r.deleted_ids.every(id=>deleted.has(id));
}

function canonical(value: unknown): string {
 if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value) ?? 'undefined';
}

function validExecutionShape(raw: unknown): boolean {
 const object = (x: unknown): x is Record<string,unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
 const list = (x: unknown) => Array.isArray(x) && x.every(v=>typeof v === 'string');
 if (!object(raw) || !object(raw.verification)) return false;
 const v=raw.verification;
 if (!['AVAILABLE','UNAVAILABLE','INVALID','UNSUPPORTED'].includes(v.state as string) || !['COMPLETE','PARTIAL'].includes(v.coverage as string)) return false;
 for (const k of ['required','observed','missing','evidence_refs']) if (!list(v[k])) return false;
 for (const k of ['source','revision','activation','observed_at','verifier_version']) if (k in v && typeof v[k] !== 'string') return false;
 if ('scope' in v) {
  if (!object(v.scope)) return false;
  for (const k of ['projectUuid','projectName','documentUuid','documentType','tabId','unit']) if (k in v.scope && typeof v.scope[k] !== 'string') return false;
 }
 for (const k of ['recovery','persistence']) {
  const obj=raw[k];if (!object(obj) || typeof obj.state !== 'string' || !obj.state) return false;
  if ('evidence_refs' in obj && !list(obj.evidence_refs)) return false;
 }
 return true;
}
