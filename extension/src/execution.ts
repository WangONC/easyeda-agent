import evidenceInventory from '../../internal/protocol/execution-evidence.json';
import contracts from './action-contracts.json';
import type { RequestFrame, ResponseFrame, Execution } from './protocol';
export function contractFor(action: string) {
    return (contracts as Record<string, {
        version: string;
        hash: string;
        executor: string;
        effects: string[];
        dry_run: string;
        operations?: string[];
        verification: {
            required: string[];
        };
    }>)[action];
}
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
    return !!adaptEvidence(r).negative;
}
type Facts = {
    req: Partial<RequestFrame> & {
        action: string;
    };
    resp?: Partial<ResponseFrame>;
    c: ReturnType<typeof contractFor>;
    raw: Record<string, unknown>;
    receipt: ReturnType<typeof normalizeReceipt>;
    possible: boolean; incomplete: boolean; absence: boolean;
    prior?: Execution;
    meta: Execution;
    invalid?: unknown;
    before: boolean;
    preview: boolean;
    mutation: boolean;
    effectful: boolean;
    observed: boolean;
    unsettled: boolean;
    priorUncertain: boolean;
    negative: boolean;
    attributionMismatch?: boolean;
    issue: string;
    basis: string;
};
export function interpret(req: Partial<RequestFrame> & {
    action: string;
}, resp?: Partial<ResponseFrame>, before = false): Execution {
    return deriveExecution(reconcileExecution(validateExecution(req, resp, before)));
}
function emptyExecution(req: Facts['req'], c: Facts['c']): Execution {
    return { operation_id: req.operationId || req.payload?.client_transaction_id as string | undefined, parent_operation_id: req.parentOperationId, request_id: req.id || '', contract_version: c?.version || '', contract_hash: c?.hash || '', expected_target: req.expectedTarget, verification: { state: 'UNAVAILABLE', coverage: 'PARTIAL', required: [], observed: [], missing: [], evidence_refs: [] }, recovery: { state: 'NOT_REQUESTED' }, persistence: { state: 'NOT_REQUESTED' }, request_satisfied: false, next_action: '', reason: '', possible_effect: false, autosave_eligible: false, health_effect: 'UNKNOWN', freshness_restored: false };
}
function validateExecution(req: Facts['req'], resp: Facts['resp'], before: boolean): Facts {
    const c = contractFor(req.action), meta = emptyExecution(req, c);
    meta.observed_target_after = resp?.context;
    const f = { req, resp, c, raw: resp?.result || {}, prior: resp?.execution, meta, before, preview: req.payload?.dryRun === true && c?.dry_run === 'preview', mutation: !!c?.effects.some(e => ['DESIGN_CONTENT', 'PROJECT_TOPOLOGY', 'LIBRARY_ASSET'].includes(e)), effectful: !!c?.effects.length, observed: false, unsettled: false, priorUncertain: false, negative: false, issue: '', basis: '' } as Facts;
    if (resp && (req.id || '') !== (resp.id || '')) {
        f.attributionMismatch=true; f.issue='CONFLICT';
        f.meta=emptyExecution(req,c);
        if(resp.execution) f.meta.prior_evidence=resp.execution.decision_basis==='CONFLICT'?resp.execution.prior_evidence:structuredClone(resp.execution);
        f.prior=undefined;
        return f;
    }
    f.receipt = normalizeReceipt(f);
    f.observed = !!f.receipt.side.write; f.unsettled = !!f.receipt.side.unsettled;
    f.possible = !!f.receipt.side.possible; f.incomplete = !!f.receipt.side.incomplete; f.absence = !!f.receipt.side.absence;
    if (f.prior != null) {
        f.effectful ||= f.prior.possible_effect === true;
        const prior = f.prior;
        if (validExecutionShape(prior) && validPriorTuple(prior,c) && prior.decision_basis === 'REFUSED' && prior.contract_version === (c?.version || '') && prior.contract_hash === (c?.hash || '') && prior.request_id === (req.id || '') && prior.request_id === (resp?.id || '') && prior.write_attempted === false && prior.possible_effect === false && !prior.request_satisfied && (prior.mutation_outcome === 'NO_WRITE' || !f.mutation && !prior.mutation_outcome))
            f.before = true;
        const p = f.prior, evidence = validExecutionShape(p) ? (p.invalid_evidence ?? p) : p;
        const side = adaptEvidence(evidence), wrote = !!side.write, pending = !!side.unsettled;
        f.possible ||= !!side.possible; f.incomplete ||= !!side.incomplete;
        if(validExecutionShape(p) && validPriorTuple(p,c) && p.contract_version===c?.version && p.contract_hash===c?.hash && p.request_id===(req.id || '')) f.observed ||= !p.invalid_evidence && wrote || p.write_attempted === true;
        f.unsettled ||= pending || p.native_settled === false;
        if (p.invalid_evidence != null || !validExecutionShape(evidence)) {
            f.invalid = evidence;
            f.issue = 'INVALID';
            if (p.invalid_evidence != null && validExecutionShape(p))
                f.meta = structuredClone(p);
        }
        else {
            f.meta = structuredClone(p);
            f.priorUncertain = p.mutation_outcome === 'UNCERTAIN';
            if(!validPriorTuple(p,c)) f.issue='CONFLICT';
            if (p.contract_version !== c?.version || p.contract_hash !== c?.hash || p.request_id !== (resp?.id || '') || (req.id && req.id !== resp?.id))
                f.issue = 'CONFLICT';
            if (!f.mutation && p.mutation_outcome) {
                f.issue = 'CONFLICT';
                f.effectful = true;
            }
        }
    }
    if (!validRawEvidence(resp?.result, req.action)) {
        f.invalid = { result: resp?.result ?? null };
        f.issue = 'INVALID';
    }
    if (!c || (req.contractVersion && req.contractVersion !== c.version) || (req.contractHash && req.contractHash !== c.hash)) {
        if (f.issue !== 'INVALID')
            f.issue = 'CONFLICT';
    }
    if (req.payload && 'dryRun' in req.payload && typeof req.payload.dryRun !== 'boolean') {
        f.issue = 'INVALID';
        f.invalid = { payload: req.payload };
    }
    if (req.payload?.dryRun === true && c?.dry_run !== 'preview' && !before)
        f.issue = 'CONFLICT';
    if (f.observed || f.unsettled || f.possible || f.incomplete)
        f.effectful = true;
    f.negative = !!f.receipt.side.negative;
    return f;
}
function reconcileExecution(f: Facts): Facts {
    const p = f.prior, n = f.receipt;
    const risk = f.observed || f.possible || f.incomplete || f.unsettled;
    const choose = (basis: string) => { f.basis = basis; return f; };
    if (f.attributionMismatch) return choose('CONFLICT');
    if (f.before && !risk && !f.priorUncertain)
        return choose('REFUSED');
    if (p?.decision_basis === 'CONFLICT' && f.issue !== 'INVALID')
        return choose('CONFLICT');
    if (f.issue)
        return choose(f.issue);
    if (((f.preview || f.before) && risk) || (f.absence && risk))
        return choose('CONFLICT');
    if (p) {
        const v = p.verification;
        const persistence = p.persistence.state, save = !!f.c?.effects.includes('SAVE'), delivery = !!f.c?.effects.includes('ARTIFACT_DELIVERY');
        if ((!['NOT_REQUESTED', 'UNKNOWN'].includes(String(persistence)) && !save && !delivery) || (persistence === 'SAVE_ACKNOWLEDGED' && !save) || (['DELIVERED', 'PENDING_DELIVERY', 'DELIVERY_FAILED'].includes(String(persistence)) && !delivery) || (v.state === 'UNAVAILABLE' && v.coverage === 'COMPLETE') || (p.mutation_outcome === 'NO_WRITE' && (p.possible_effect || p.write_attempted !== false)) || (p.mutation_outcome === 'COMPLETE' && (!p.request_satisfied || p.native_settled !== true || p.write_attempted !== true)) || (p.mutation_outcome === 'PARTIAL' && p.request_satisfied))
            return choose('CONFLICT');
        if (p.recovery.state !== 'NOT_REQUESTED' && f.req.action !== 'route.apply_batch')
            return choose('UNRESOLVED');
        if (persistence === 'DELIVERY_FAILED')
            return choose('DELIVERY_FAILED');
        const missing = v.missing.length > 0 || (v.required.length > 0 && (v.coverage !== 'COMPLETE' || !v.required.every(x => v.observed.includes(x)))) || (v.state === 'AVAILABLE' && v.coverage !== 'COMPLETE');
        if (v.state === 'INVALID')
            return choose('INVALID');
        if (v.state === 'UNSUPPORTED' || missing)
            return choose('UNRESOLVED');
        if ((p.mutation_outcome === 'NO_WRITE' || p.write_attempted === false) && risk)
            return choose('CONFLICT');
        if (f.req.action === 'route.apply_batch') {
            if (n.recoveryConflict)
                return choose('CONFLICT');
            if (n.itemsConflict)
                return choose('CONFLICT');
        }
    }
    if (f.unsettled)
        return choose('UNRESOLVED');
    if (f.priorUncertain) {
        if (['UNVERIFIED', 'LEGACY_NEGATIVE'].includes(p?.decision_basis || '') && f.req.action !== 'route.apply_batch' && !f.preview)
            return choose(f.negative ? 'LEGACY_NEGATIVE' : 'UNVERIFIED');
        return choose('UNRESOLVED');
    }
    if (p?.decision_basis === 'REFUSED' && p.write_attempted === false && !risk)
        return choose('REFUSED');
    if (n.side.unknown && (f.preview || f.absence)) return choose('UNRESOLVED');
    if (f.preview)
        return choose(f.absence || (p?.mutation_outcome === 'NO_WRITE' && p.write_attempted === false) ? 'PREVIEW' : 'UNRESOLVED');
    if (p?.mutation_outcome === 'NO_WRITE' && p.write_attempted === false && !risk)
        return choose(p.decision_basis === 'REFUSED' ? 'REFUSED' : 'NO_WRITE');
    if (f.absence && !risk) return choose('NO_WRITE');
    if (f.mutation) {
        if (f.req.action === 'route.apply_batch') {
            if (n.fastNoWrite) return choose('NO_WRITE');
            if (n.fastPartial) return choose('FAST_PARTIAL');
            if (n.fastComplete) return choose('FAST_COMPLETE');
            return choose('UNRESOLVED');
        }
        return choose(f.negative ? 'LEGACY_NEGATIVE' : 'UNVERIFIED');
    }
    if (risk && !f.c?.effects.length)
        return choose('CONFLICT');
    let satisfied = n.acknowledged && !f.negative;
    if (p && !p.request_satisfied && p.persistence.state !== 'PENDING_DELIVERY')
        satisfied = false;
    if (f.c?.effects.includes('SAVE'))
        satisfied &&= n.saveAcknowledged;
    if (f.c?.effects.includes('ARTIFACT_DELIVERY')) {
        const delivered = satisfied && n.delivered;
        const pending = n.pending;
        return choose(delivered ? 'DELIVERED' : satisfied && pending ? 'PENDING_DELIVERY' : 'DELIVERY_FAILED');
    }
    return choose(satisfied ? 'SATISFIED' : 'REJECTED');
}
function deriveExecution(f: Facts): Execution {
    const e = f.meta, b = f.basis;
    if (b === 'CONFLICT' && e.prior_evidence == null && f.prior && f.prior.decision_basis !== 'CONFLICT')
        e.prior_evidence = structuredClone(f.prior);
    e.request_id = f.req.id || "";
    e.contract_version = f.c?.version || "";
    e.contract_hash = f.c?.hash || "";
    e.decision_basis = b;
    delete e.mutation_outcome;
    delete e.write_attempted;
    if(b==='CONFLICT'||b==='INVALID')delete e.native_settled;
    e.request_satisfied = false;
    e.next_action = 'inspect';
    e.reason = 'request not satisfied';
    e.possible_effect = f.effectful || f.observed;
    e.autosave_eligible = false;
    e.health_effect = 'UNKNOWN';
    e.freshness_restored = false;
    if (f.mutation)
        e.mutation_outcome = 'UNCERTAIN';
    if (f.invalid != null) {
        e.invalid_evidence = f.invalid;
        e.verification.state = 'INVALID';
    }
    if (f.unsettled)
        e.native_settled = false;
    if ((f.possible || f.incomplete || f.unsettled) && e.write_attempted === false) delete e.write_attempted;
    if (f.observed)
        e.write_attempted = true;
    if(!f.attributionMismatch)e.observed_target_after ??= f.resp?.context;
    switch (b) {
        case 'INVALID':
        case 'CONFLICT':
        case 'UNRESOLVED':
            e.next_action = 'reconcile_without_replay';
            e.reason = b === 'INVALID' ? 'invalid execution evidence' : b === 'CONFLICT' ? 'conflicting execution evidence' : 'execution evidence is unresolved';
            if (b === 'INVALID')
                e.verification.state = 'INVALID';
            break;
        case 'REFUSED':
        case 'NO_WRITE':
        case 'PREVIEW':
            e.possible_effect = false;
            e.write_attempted = false;
            if (f.mutation)
                e.mutation_outcome = 'NO_WRITE';
            e.reason = 'no write established';
            if (b === 'REFUSED')
                e.reason = 'refused before dispatch';
            if (b === 'PREVIEW') {
                e.request_satisfied = f.receipt.acknowledged && !f.negative;
                e.reason = 'declared no-write preview';
            }
            break;
        case 'FAST_COMPLETE':
        case 'FAST_PARTIAL':
            e.possible_effect = true;
            e.native_settled = true;
            e.write_attempted = true;
            e.item_results = f.receipt.items;
            e.mutation_outcome = 'PARTIAL';
            e.health_effect = 'NOT_LANDED';
            e.next_action = 'reconcile_without_replay';
            e.reason = 'Fast Path partial receipt';
            if (b === 'FAST_COMPLETE') {
                e.mutation_outcome = 'COMPLETE';
                e.request_satisfied = true;
                e.health_effect = 'LANDED';
                e.reason = 'Fast Path semantic readback';
                e.verification.state = 'AVAILABLE';
                e.verification.coverage = 'COMPLETE';
                e.verification.required=[...(f.c?.verification.required || [])];
                e.verification.observed=[...f.receipt.verifiedRequirements];
                e.verification.missing=[];
                if (!e.verification.source)
                    e.verification.source = 'FastPath.matchesOperation';
                if (!e.verification.evidence_refs.length)
                    e.verification.evidence_refs = ['result'];
            }
            if (f.receipt.restored) {
                e.recovery.state = 'RESTORED';
                if (!('evidence_refs' in e.recovery))
                    e.recovery.evidence_refs = ['result'];
            }
            e.autosave_eligible = true;
            break;
        case 'UNVERIFIED':
        case 'LEGACY_NEGATIVE':
            e.next_action = 'reconcile_without_replay';
            e.reason = 'legacy evidence does not prove semantic completion';
            e.autosave_eligible = f.receipt.acknowledged;
            if (b === 'LEGACY_NEGATIVE' && f.receipt.side.verifiedNegative)
                e.health_effect = 'NOT_LANDED';
            break;
        case 'SATISFIED':
        case 'DELIVERED':
            e.request_satisfied = true;
            e.reason = 'request satisfied';
            break;
        case 'PENDING_DELIVERY':
            e.reason = 'artifact delivery evidence pending';
            break;
    }
    if (f.c?.effects.includes('SAVE') && !f.mutation)
        e.persistence.state = e.request_satisfied ? 'SAVE_ACKNOWLEDGED' : 'UNKNOWN';
    if (b === 'DELIVERED' || b === 'PENDING_DELIVERY')
        e.persistence.state = b;
    if (b === 'DELIVERY_FAILED') {
        e.persistence.state = b;
        e.reason = 'artifact delivery failed';
    }
    if (e.request_satisfied)
        e.next_action = 'continue';
    if (!f.mutation && f.req.action === 'pcb.pour.rebuild' && e.request_satisfied) {
        e.autosave_eligible = true;
        e.freshness_restored = true;
    }
    if (f.req.action === 'debug.exec_js' && b === 'UNVERIFIED' && f.receipt.acknowledged)
        e.freshness_restored = f.receipt.reload;
    return JSON.parse(JSON.stringify(e)) as Execution;
}
// Shared inventory: composable input facts, never request intent or outcomes.
function adaptEvidence(v: unknown, prewriteFast = false): Record<string, boolean> {
    const facts: Record<string, boolean> = {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) return facts;
    const r = v as Record<string, unknown>;
    for (const a of evidenceInventory) {
        if (prewriteFast && ((a.field === 'status' && ['partial', 'stale'].includes(a.test)) || a.field === 'readback_verified')) continue;
        if (!(a.field in r)) continue;
        const value = r[a.field];
        const matched = a.test === 'true' ? value === true : a.test === 'false' ? value === false : a.test === 'nonempty' ? nonempty(value) : a.test === 'positive' ? typeof value === 'number' && value > 0 : a.test === 'applied' ? Array.isArray(value) && value.some(x => x && x.status === 'applied') : value === a.test;
        if (matched) for (const fact of a.facts) facts[fact] = true;
    }
    return facts;
}
function normalizeReceipt(f: Omit<Facts, 'receipt'>) {
    const r = f.raw, p = f.prior, fast = f.req.action === 'route.apply_batch';
    const noWrite = fast && ['stale', 'partial'].includes(r.status as string) && r.mutation_started === false && fastNoWrite(r);
    const verifiedRequirements=fastVerifiedRequirements(r,f.req.payload || {});
    const side = adaptEvidence(r, noWrite);
    if (!(f.c?.dry_run === 'preview' && f.preview && r.dryRun === true && r.native_settled === true)) delete side.absence;
    if (noWrite) side.absence = true;
    return {
        side, fastNoWrite: noWrite,
        fastPartial: fast && r.status === 'partial' && fastSettled(r, f.req.payload || {}, false),
        verifiedRequirements,
        fastComplete: fast && r.status === 'complete' && verifiedRequirements.length>0 && (f.c?.verification.required || []).every(x=>verifiedRequirements.includes(x)),
        recoveryConflict: fast && !!p && ((r.status === 'complete' && p.recovery?.state !== 'NOT_REQUESTED') || (p.recovery?.state === 'RESTORED' && (r.rollback_attempted !== true || r.rollback_complete !== true))),
        itemsConflict: fast && p?.item_results != null && canonical(p.item_results) !== canonical(r.item_results),
        acknowledged: f.resp?.ok === true && r.ok !== false && r.saved !== false,
        saveAcknowledged: r.saved === true, restored: r.rollback_complete === true, items: r.item_results,
        delivered: !!f.resp?.artifacts?.length && f.resp.artifacts.every(a => !!a.path && !!a.sha256),
        pending: !!f.resp?.artifacts?.length && f.resp.artifacts.every(a => (!!a.path && !!a.sha256) || !!a.inlineBase64),
        reload: f.req.action === 'debug.exec_js' && typeof f.req.payload?.code === 'string' && f.req.payload.code.includes('closeDocument'),
    };
}
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0) && new Set(v).size === v.length;
function fastNoWrite(r: Record<string, unknown>) {
    return ids(r.created_ids) && ids(r.deleted_ids) && !r.created_ids.length && !r.deleted_ids.length && Array.isArray(r.item_results) && !r.item_results.length;
}
function fastComplete(r: Record<string, unknown>, payload: Record<string, unknown>) {
    return r.readback_verified === true && r.rollback_attempted === false && r.rollback_complete === false && !negativeResult(r) && fastSettled(r, payload, true);
}
function fastSettled(r: Record<string, unknown>, payload: Record<string, unknown>, complete: boolean) {
    if (r.mutation_started !== true || r.duplicate === true)
        return false;
    if (typeof r.revision_before !== 'string' || !r.revision_before.trim() || typeof r.revision_after !== 'string' || !r.revision_after.trim())
        return false;
    if (r.revision_before === r.revision_after || ('duplicate' in r && typeof r.duplicate !== 'boolean'))
        return false;
    if (!complete && r.readback_verified !== false)
        return false;
    if (r.rollback_complete === true && (r.rollback_attempted !== true || nonempty(r.deleted_ids)))
        return false;
    if ('base_revision' in payload && payload.base_revision !== r.revision_before)
        return false;
    if ('native_settled' in r && r.native_settled !== true)
        return false;
    if (typeof r.rollback_attempted !== 'boolean' || typeof r.rollback_complete !== 'boolean')
        return false;
    if (!ids(r.created_ids) || !ids(r.deleted_ids))
        return false;
    const items = r.item_results, ops = payload.operations;
    if (!Array.isArray(items) || !Array.isArray(ops) || !items.length || items.length !== ops.length)
        return false;
    if (!('failed_index' in r))
        return false;
    let failed = -1;
    if (complete) {
        if (r.failed_index !== null)
            return false;
    }
    else {
        if (typeof r.failed_index !== 'number' || !Number.isInteger(r.failed_index) || r.failed_index < 0 || r.failed_index >= items.length)
            return false;
        failed = r.failed_index;
    }
    const created = new Set<string>(), deleted = new Set<string>(), seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
        const item = items[i], op = ops[i];
        if (!item || typeof item !== 'object' || item.index !== i || !op || typeof op !== 'object')
            return false;
        const add = ['add_trace', 'add_arc', 'add_via'].includes(op.type), del = ['delete_trace', 'delete_via'].includes(op.type);
        if (!add && !del)
            return false;
        const status = failed === i ? 'failed' : failed >= 0 && i > failed ? 'skipped' : 'applied';
        if (item.status !== status)
            return false;
        if (status !== 'applied') {
            if ('id' in item)
                return false;
            continue;
        }
        if (typeof item.id !== 'string' || !item.id || seen.has(item.id))
            return false;
        seen.add(item.id);
        if (add)
            created.add(item.id);
        else {
            if (op.id !== item.id)
                return false;
            deleted.add(item.id);
        }
    }
    return r.created_ids.length === created.size && r.deleted_ids.length === deleted.size && r.created_ids.every(id => created.has(id)) && r.deleted_ids.every(id => deleted.has(id));
}
function canonical(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
    return JSON.stringify(value) ?? 'undefined';
}
function validExecutionShape(raw: unknown): boolean {
    const object = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
    const list = (x: unknown) => Array.isArray(x) && x.every(v => typeof v === 'string');
    if (!object(raw) || !object(raw.verification))
        return false;
    if ('decision_basis' in raw && (!['possible_effect', 'autosave_eligible', 'freshness_restored'].every(k => typeof raw[k] === 'boolean') || !enumField(raw, 'health_effect', ['UNKNOWN', 'LANDED', 'NOT_LANDED'], false)))
        return false;
    for (const k of ['request_id', 'contract_version', 'contract_hash', 'next_action', 'reason'])
        if (typeof raw[k] !== 'string')
            return false;
    if (typeof raw.request_satisfied !== 'boolean')
        return false;
    for (const k of ['operation_id', 'parent_operation_id', 'payload_hash', 'activation', 'executor_build'])
        if (k in raw && typeof raw[k] !== 'string')
            return false;
    for (const k of ['native_settled', 'write_attempted', 'possible_effect', 'autosave_eligible', 'freshness_restored'])
        if (k in raw && typeof raw[k] !== 'boolean')
            return false;
    if (!enumField(raw, 'mutation_outcome', ['NO_WRITE', 'COMPLETE', 'PARTIAL', 'UNCERTAIN'], true) || !enumField(raw, 'health_effect', ['UNKNOWN', 'LANDED', 'NOT_LANDED'], true) || !enumField(raw, 'next_action', ['', 'inspect', 'continue', 'reconcile_without_replay'], false) || !enumField(raw, 'decision_basis', decisionBases, true))
        return false;
    for (const k of ['expected_target', 'observed_target_before', 'observed_target_after'])
        if (k in raw && !contextShape(raw[k]))
            return false;
    if ('affected_targets' in raw && (!Array.isArray(raw.affected_targets) || !raw.affected_targets.every(contextShape)))
        return false;
    if ('item_results' in raw && !validItems(raw.item_results))
        return false;
    if ('child_responses' in raw && (!Array.isArray(raw.child_responses) || !raw.child_responses.every(x => object(x) && validChildResponse(x) && (!('execution' in x) || x.execution == null || validExecutionShape(x.execution)))))
        return false;
    const v = raw.verification;
    if (!['AVAILABLE', 'UNAVAILABLE', 'INVALID', 'UNSUPPORTED'].includes(v.state as string) || !['COMPLETE', 'PARTIAL'].includes(v.coverage as string))
        return false;
    for (const k of ['required', 'observed', 'missing', 'evidence_refs'])
        if (!list(v[k]))
            return false;
    for (const k of ['source', 'revision', 'activation', 'observed_at', 'verifier_version'])
        if (k in v && typeof v[k] !== 'string')
            return false;
    if ('scope' in v) {
        if (!object(v.scope))
            return false;
        for (const k of ['projectUuid', 'projectName', 'documentUuid', 'documentType', 'tabId', 'unit'])
            if (k in v.scope && typeof v.scope[k] !== 'string')
                return false;
    }
    for (const k of ['recovery', 'persistence']) {
        const obj = raw[k];
        const states = k === 'recovery' ? ['NOT_REQUESTED', 'RESTORED', 'PARTIAL', 'FAILED', 'PENDING', 'UNKNOWN'] : ['NOT_REQUESTED', 'UNKNOWN', 'SAVE_ACKNOWLEDGED', 'PENDING_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED'];
        if (!object(obj) || !enumField(obj, 'state', states, false))
            return false;
        if ('evidence_refs' in obj && !list(obj.evidence_refs))
            return false;
    }
    return true;
}
const decisionBases = ['REFUSED', 'NO_WRITE', 'PREVIEW', 'FAST_COMPLETE', 'FAST_PARTIAL', 'UNVERIFIED', 'LEGACY_NEGATIVE', 'SATISFIED', 'REJECTED', 'DELIVERED', 'PENDING_DELIVERY', 'DELIVERY_FAILED', 'INVALID', 'CONFLICT', 'UNRESOLVED'];
function enumField(o: Record<string, unknown>, k: string, allowed: string[], optional: boolean) { return !(k in o) ? optional : typeof o[k] === 'string' && allowed.includes(o[k] as string); }
function contextShape(x: unknown) {
    if (!x || typeof x !== 'object' || Array.isArray(x))
        return false;
    const o = x as Record<string, unknown>;
    return ['projectUuid', 'projectName', 'documentUuid', 'documentType', 'tabId', 'unit'].every(k => !(k in o) || typeof o[k] === 'string');
}
function validItems(x: unknown) { return Array.isArray(x) && x.every(v => v && typeof v === 'object' && !Array.isArray(v) && (!('index' in v) || (typeof v.index === 'number' && Number.isInteger(v.index) && v.index >= 0)) && (!('status' in v) || typeof v.status === 'string') && (!('id' in v) || typeof v.id === 'string')); }
function validRawEvidence(raw: unknown, action: string) {
    if (raw == null)
        return true;
    if (typeof raw !== 'object' || Array.isArray(raw))
        return false;
    const r = raw as Record<string, unknown>;
    for (const a of evidenceInventory) {
        if (!(a.field in r)) continue;
        const v = r[a.field], collection = !!v && typeof v === 'object';
        const valid = a.shape === 'boolean' ? typeof v === 'boolean' : a.shape === 'string' ? typeof v === 'string' : a.shape === 'collection' ? collection : a.shape === 'boolean-or-collection' ? typeof v === 'boolean' || collection : a.shape === 'count' ? typeof v === 'number' && Number.isInteger(v) && v >= 0 : a.shape === 'items' && validItems(v);
        if (!valid) return false;
    }
    for (const k of ['ok', 'saved', 'dryRun', 'partial', 'verified', 'disconnected', 'mutation_started', 'readback_verified', 'rollback_attempted', 'rollback_complete', 'duplicate', 'native_settled', 'write_attempted'])
        if (k in r && typeof r[k] !== 'boolean')
            return false;
    if ('deleted' in r && typeof r.deleted !== 'boolean' && (!r.deleted || typeof r.deleted !== 'object'))
        return false;
    if ('status' in r && (typeof r.status !== 'string' || (action === 'route.apply_batch' && !enumField(r, 'status', ['complete', 'partial', 'uncertain', 'stale'], false))))
        return false;
    for (const k of ['created_ids', 'deleted_ids'])
        if (k in r && !ids(r[k]))
            return false;
    if ('item_results' in r && !validItems(r.item_results))
        return false;
    for (const k of ['revision_before', 'revision_after'])
        if (k in r && r[k] != null && typeof r[k] !== 'string')
            return false;
    if ('failed_index' in r && r.failed_index != null && (typeof r.failed_index !== 'number' || !Number.isInteger(r.failed_index) || r.failed_index < 0))
        return false;
    if ('survivedTotal' in r && (typeof r.survivedTotal !== 'number' || !Number.isInteger(r.survivedTotal) || r.survivedTotal < 0))
        return false;
    for (const k of ['notApplied', 'survived', 'survivedIds'])
        if (k in r && (!r[k] || typeof r[k] !== 'object'))
            return false;
    return true;
}
function validChildResponse(o: Record<string, unknown>): boolean {
    const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
    const strings = (v: Record<string, unknown>, ks: string[]) => ks.every(k => !(k in v) || typeof v[k] === 'string');
    if (typeof o.id !== 'string' || typeof o.ok !== 'boolean' || ('unordered' in o && typeof o.unordered !== 'boolean') || ('abandonedIds' in o && o.abandonedIds != null && (!Array.isArray(o.abandonedIds) || !o.abandonedIds.every(x => typeof x === 'string'))))
        return false;
    if (!strings(o, ['id', 'type', 'version', 'windowId', 'staleRisk', 'concurrentWriter']) || ('ok' in o && typeof o.ok !== 'boolean'))
        return false;
    if ('createdAt' in o) {
        if (typeof o.createdAt !== 'string' || !/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$/.test(o.createdAt))
            return false;
        const [y, m, d] = o.createdAt.slice(0, 10).split('-').map(Number);
        const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
        if (d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
            return false;
    }
    for (const k of ['seq', 'seqAbandoned'])
        if (k in o && o[k] != null && (typeof o[k] !== 'number' || !Number.isSafeInteger(o[k]) || (o[k] as number) < 0))
            return false;
    if ('result' in o && o.result != null && !object(o.result))
        return false;
    if ('context' in o && o.context != null && !contextShape(o.context))
        return false;
    if ('warnings' in o && o.warnings != null && (!Array.isArray(o.warnings) || !o.warnings.every(x => typeof x === 'string')))
        return false;
    if ('error' in o && o.error != null && (!object(o.error) || !strings(o.error, ['code', 'message', 'detail'])))
        return false;
    if ('artifacts' in o && o.artifacts != null && (!Array.isArray(o.artifacts) || !o.artifacts.every(v => object(v) && strings(v, ['id', 'kind', 'path', 'fileName', 'mimeType', 'sha256', 'inlineBase64']) && (!('size' in v) || (typeof v.size === 'number' && Number.isSafeInteger(v.size) && v.size >= 0)))))
        return false;
    return true;
}

function validPriorTuple(p: Execution,c: Facts['c']): boolean {
 if(!p.decision_basis)return true;
 if(p.request_satisfied!==(p.next_action==='continue'))return false;
 const mutation=!!c?.effects.some(x=>['DESIGN_CONTENT','PROJECT_TOPOLOGY','LIBRARY_ASSET'].includes(x));
 const expected=mutation?'UNCERTAIN':undefined;
 switch(p.decision_basis){
 case 'REFUSED':case 'NO_WRITE':case 'PREVIEW':return p.mutation_outcome===(mutation?'NO_WRITE':undefined)&&!p.possible_effect&&p.write_attempted===false&&(p.decision_basis==='PREVIEW'||!p.request_satisfied);
 case 'FAST_COMPLETE':return mutation&&p.mutation_outcome==='COMPLETE'&&p.request_satisfied&&p.possible_effect&&p.write_attempted===true&&p.native_settled===true;
 case 'FAST_PARTIAL':return mutation&&p.mutation_outcome==='PARTIAL'&&!p.request_satisfied&&p.possible_effect&&p.write_attempted===true&&p.native_settled===true&&p.next_action==='reconcile_without_replay';
 case 'INVALID':case 'CONFLICT':case 'UNRESOLVED':case 'UNVERIFIED':case 'LEGACY_NEGATIVE':return p.mutation_outcome===expected&&(!mutation||p.possible_effect)&&!p.request_satisfied&&p.next_action==='reconcile_without_replay'&&p.write_attempted!==false;
 case 'SATISFIED':case 'DELIVERED':return !mutation&&!p.mutation_outcome&&p.request_satisfied;
 case 'REJECTED':case 'PENDING_DELIVERY':case 'DELIVERY_FAILED':return !mutation&&!p.mutation_outcome&&!p.request_satisfied&&p.next_action==='inspect';
 }
 return false;
}
// Existing FastPath.matchesOperation + deletion readback + settled receipt,
// not a copy of whichever requirements a future contract might declare.
function fastVerifiedRequirements(r: Record<string,unknown>, payload: Record<string,unknown>): string[] {
 return fastComplete(r,payload)?['net','layer','geometry','width','hole','diameter','deleted_absence','all_operations','no_pending_native_write']:[];
}
