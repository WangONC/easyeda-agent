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
    const e: Execution = { operation_id: req.operationId || req.payload?.client_transaction_id as string | undefined, parent_operation_id: req.parentOperationId, request_id: req.id || '', contract_version: c?.version || '', contract_hash: c?.hash || '', expected_target: req.expectedTarget, verification: { state: 'UNAVAILABLE', coverage: 'PARTIAL', required: [], observed: [], missing: [], evidence_refs: [] }, recovery: { state: 'NOT_REQUESTED' }, persistence: { state: 'NOT_REQUESTED' }, request_satisfied: false, next_action: mutation ? 'reconcile_without_replay' : 'inspect', reason: 'legacy evidence does not prove semantic completion' };
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
    if (req.payload?.dryRun === true && c?.dry_run === 'preview') {
        e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.request_satisfied = resp.ok === true && !negativeResult(resp.result || {});
        e.reason = 'declared no-write preview';
        return e;
    }
    const prior = resp.execution;
    if (prior && (req.action !== 'route.apply_batch' || prior.mutation_outcome === 'NO_WRITE')) {
        const copy = { ...prior };
        const cvalid = prior.contract_version === c?.version && prior.contract_hash === c?.hash && prior.request_id === resp.id && (!req.id || req.id === resp.id);
        if (mutation) {
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
    if (prior && !mutation && (!prior.request_satisfied || prior.contract_version !== c?.version || prior.contract_hash !== c?.hash || ['INVALID', 'UNSUPPORTED'].includes(prior.verification?.state))) {
        return { ...prior, request_satisfied: false };
    }
    e.observed_target_after = resp.context;
    const r = resp.result || {};
    if (mutation) {
        if (req.action === 'route.apply_batch') {
            e.item_results = r.item_results;
            if (typeof r.mutation_started === 'boolean')
                e.write_attempted = r.mutation_started;
            if (['stale', 'partial'].includes(String(r.status))) {
                if (r.mutation_started === false && !nonempty(r.created_ids) && !nonempty(r.deleted_ids))
                    e.mutation_outcome = 'NO_WRITE';
                else if (r.status === 'partial' && r.mutation_started === true && r.revision_after != null)
                    e.mutation_outcome = 'PARTIAL';
            }
            if (r.status === 'complete' && fastComplete(r, req.payload || {})) {
                e.mutation_outcome = 'COMPLETE';
                e.request_satisfied = true;
                e.verification.state = 'AVAILABLE';
                e.verification.coverage = 'COMPLETE';
                e.verification.source = 'FastPath.matchesOperation';
                e.verification.evidence_refs = ['result'];
                e.next_action = 'continue';
                e.reason = 'Fast Path semantic readback';
            }
            if (r.rollback_complete === true && e.mutation_outcome === 'PARTIAL') {
                e.recovery = { state: 'RESTORED', evidence_refs: ['result'] };
                e.request_satisfied = false;
            }
        }
    }
    else {
        e.request_satisfied = resp.ok === true && !negativeResult(r) && r.ok !== false && r.saved !== false;
        if (c?.effects.includes('SAVE')) {
            e.request_satisfied = e.request_satisfied && r.saved === true;
            e.persistence.state = e.request_satisfied ? 'SAVE_ACKNOWLEDGED' : 'UNKNOWN';
        }
        if (c?.effects.includes('ARTIFACT_DELIVERY')) {
            e.request_satisfied = e.request_satisfied && !!resp.artifacts?.length && resp.artifacts.every(a => !!a.path && !!a.sha256);
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
    return !!v && v.state === 'AVAILABLE' && v.coverage === 'COMPLETE' && Array.isArray(v.required) && v.required.length > 0 && Array.isArray(v.missing) && !v.missing.length && Array.isArray(v.observed) && Array.isArray(v.evidence_refs) && v.evidence_refs.length > 0 && !!v.activation && !!v.revision && !!v.observed_at && !!v.verifier_version && !!v.source && !!v.scope && v.required.every(f => v.observed?.includes(f));
}
function fastComplete(r: Record<string, unknown>, payload: Record<string, unknown>) {
    if (r.readback_verified !== true || r.mutation_started !== true || r.duplicate === true || r.rollback_attempted !== false || r.rollback_complete !== false || negativeResult(r))
        return false;
    if (typeof r.revision_before !== 'string' || !r.revision_before || typeof r.revision_after !== 'string' || !r.revision_after || !('failed_index' in r) || r.failed_index !== null)
        return false;
    if (!Array.isArray(r.item_results) || !r.item_results.length || r.item_results.some((v, i) => !v || v.index !== i || v.status !== 'applied' || typeof v.id !== 'string' || !v.id))
        return false;
    if (!Array.isArray(r.created_ids) || r.created_ids.some(v => typeof v !== 'string') || !Array.isArray(r.deleted_ids) || r.deleted_ids.some(v => typeof v !== 'string'))
        return false;
    if ('operations' in payload && (!Array.isArray(payload.operations) || payload.operations.length !== r.item_results.length))
        return false;
    return true;
}
