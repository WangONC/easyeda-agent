import { ActionError, type ActionResult } from './protocol';

export type Point = [number, number];
export type Box = [number, number, number, number];
export interface Primitive {
 id: string; kind: string; net?: string; layer?: number; points?: Point[]; width?: number;
 x?: number; y?: number; diameter?: number; hole?: number; bbox?: Box; locked?: boolean;
 unsupported?: boolean; designator?: string; rotation?: number; component_id?: string;
}
export interface Observation {
 components: Primitive[]; pads: Primitive[]; traces: Primitive[]; vias: Primitive[]; fills: Primitive[];
 copper_layers: number[]; rules?: unknown; warnings?: string[]; outline_fingerprint_input?: Record<string, unknown>; revision_geometry?: unknown;
}
export interface Operation {
 type: 'add_trace' | 'add_via' | 'delete_trace' | 'delete_via'; id?: string; net?: string;
 layer?: number; points?: Point[]; width?: number; x?: number; y?: number; diameter?: number;
 hole?: number; from_layer?: number; to_layer?: number;
}
export interface NativePort {
 context(): Promise<{ projectUuid: string; documentUuid: string; documentType: string; tabId?: string }>;
 read(): Promise<Observation>;
 create(op: Operation): Promise<string | undefined>;
 remove(kind: string, id: string): Promise<boolean>;
 calls: number;
}
export function canonical(v: unknown): string {
 if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
 if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
 return JSON.stringify(v);
}
function failure(code: string): never { throw new ActionError(code, code); }
function validOperations(value: unknown): asserts value is Operation[] {
 if (!Array.isArray(value) || value.length < 1 || value.length > 512) failure('INVALID_OPERATIONS');
 const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e8;
 const ids = new Set<string>();
 for (const o of value as Operation[]) {
  if (!o || typeof o !== 'object') failure('INVALID_OPERATIONS');
  if (o.type === 'add_trace') {
   if (!o.net || !finite(o.width) || o.width! <= 0 || !Number.isInteger(o.layer) || !Array.isArray(o.points) || o.points.length !== 2 || o.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !finite(n))) || canonical(o.points[0]) === canonical(o.points[1])) failure('INVALID_TRACE');
  } else if (o.type === 'add_via') {
   if (!o.net || !finite(o.x ?? 0) || !finite(o.y ?? 0) || !finite(o.diameter) || !finite(o.hole) || o.hole! <= 0 || o.diameter! <= o.hole! || !((o.from_layer === 1 && o.to_layer === 2) || (o.from_layer === 2 && o.to_layer === 1))) failure('INVALID_THROUGH_VIA');
  } else if (o.type === 'delete_trace' || o.type === 'delete_via') {
   if (!o.id || ids.has(o.id)) failure('INVALID_DELETE'); ids.add(o.id);
  } else failure('INVALID_OPERATION_TYPE');
 }
}
interface BatchResult extends Record<string, unknown> {
 status: 'complete' | 'partial' | 'stale' | 'uncertain'; created_ids: string[]; deleted_ids: string[];
 item_results: Array<{ index: number; status: string; id?: string; error?: string }>;
 failed_index: number | null; revision_before: string; revision_after: string | null;
 readback_verified: boolean; rollback_attempted: boolean; rollback_complete: boolean; warnings: string[];
}
// Lifetime is one Connector activation. Entries are never silently evicted: reset/reload
// creates a new session revision, so old plans cannot execute in a new ledger.
export class FastPath {
 private readonly session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
 private epoch = 0;
 private activeLegacy = 0;
 private activeBatch = false;
 private readonly revisions = new Map<string, { signature: string; revision: string }>();
 private readonly transactions = new Map<string, { signature: string; result?: BatchResult }>();
 legacyBegin(): () => void { this.activeLegacy++; this.epoch++; return () => { this.epoch++; this.activeLegacy--; }; }
 private async observe(n: NativePort, p: Record<string, unknown>) {
  const epoch = this.epoch;
  const context = await n.context();
  if (!p.document_uuid || context.documentUuid !== p.document_uuid || !p.project_uuid || context.projectUuid !== p.project_uuid || context.documentType !== 'pcb') failure('DOCUMENT_GUARD');
  if (this.activeLegacy) failure('FAST_STATE_BUSY');
  const data = await n.read();
  const after = await n.context();
  if (canonical(context) !== canonical(after) || epoch !== this.epoch || this.activeLegacy) failure('FAST_STATE_CHANGED');
  const key = `${context.projectUuid}/${context.documentUuid}/${context.tabId ?? ''}`;
  // Geometry enumeration order is not meaningful.
  for (const group of [data.components, data.pads, data.traces, data.vias, data.fills]) group.sort((a, b) => a.id.localeCompare(b.id));
  const signature = canonical({ data, epoch });
  let state = this.revisions.get(key);
  if (!state || state.signature !== signature) { state = { signature, revision: `${this.session}:${++this.epoch}` }; this.revisions.set(key, state);
   // Store with the incremented epoch to keep unchanged reads stable.
   state.signature = canonical({ data, epoch: this.epoch });
  }
  return { data, context, revision: state.revision };
 }
 async snapshot(n: NativePort, p: Record<string, unknown>): Promise<ActionResult> {
  if (this.activeBatch) failure('FAST_STATE_BUSY');
  const s = await this.observe(n, p);
  return { context: s.context, result: { ...s.data, board_revision: s.revision, native_api_call_count: n.calls } };
 }
 async apply(n: NativePort, p: Record<string, unknown>): Promise<ActionResult> {
  if (p.dryRun === true) failure('INVALID_DRY_RUN');
  validOperations(p.operations);
  const operations = p.operations;
  if (typeof p.client_transaction_id !== 'string' || !p.client_transaction_id || p.client_transaction_id.length > 160 || typeof p.plan_hash !== 'string' || !p.plan_hash || typeof p.base_revision !== 'string') failure('INVALID_BATCH_CONTRACT');
  const key = p.client_transaction_id;
  const signature = canonical({ document: p.document_uuid, project: p.project_uuid, base: p.base_revision, plan: p.plan_hash, operations });
  const previous = this.transactions.get(key);
  if (previous) {
   if (previous.signature !== signature) failure('TRANSACTION_ID_REUSED');
   if (!previous.result) return { result: { status: 'uncertain', created_ids: [], deleted_ids: [], item_results: [], failed_index: null, revision_before: p.base_revision, revision_after: null, readback_verified: false, rollback_attempted: false, rollback_complete: false, warnings: ['Original transaction is still in flight; no replay.'], duplicate: true, native_api_call_count: n.calls } };
   return { result: { ...previous.result, duplicate: true, native_api_call_count: n.calls } };
  }
  if (this.activeBatch || this.activeLegacy) failure('FAST_STATE_BUSY');
  if (this.transactions.size >= 2048) failure('TRANSACTION_LEDGER_FULL');
  const deadline = Number(p.expires_at_ms);
  if (!Number.isFinite(deadline) || Date.now() >= deadline) failure('BATCH_EXPIRED');
  this.activeBatch = true;
  const entry: { signature: string; result?: BatchResult } = { signature };
  this.transactions.set(key, entry);
  const r: BatchResult = { status: 'uncertain', created_ids: [], deleted_ids: [], item_results: [], failed_index: null,
   revision_before: p.base_revision, revision_after: null, readback_verified: false, rollback_attempted: false,
   rollback_complete: false, warnings: [] };
  const created: Array<{ id: string; op: Operation }> = [];
  let context: Awaited<ReturnType<NativePort['context']>> | undefined;
  let wrote = false;
  try {
   const before = await this.observe(n, p); context = before.context; r.revision_before = before.revision;
   if (p.base_revision !== before.revision) { r.status = 'stale'; r.revision_after = before.revision; return { context, result: r }; }
   const byID = new Map([...before.data.traces, ...before.data.vias].map(o => [o.id, o]));
   for (const o of operations) {
    if (o.type.startsWith('delete')) { const old = byID.get(o.id!); if (!old || old.locked || old.kind !== o.type.slice(7) || (old.kind === 'trace' && !before.data.copper_layers.includes(old.layer!))) failure('PROTECTED_OR_INVALID_DELETE'); }
    else if (o.type === 'add_trace' && !before.data.copper_layers.includes(o.layer!)) failure('INVALID_COPPER_LAYER');
   }
   // Recheck identity before EVERY write. Still not an atomic GUI transaction.
   this.epoch++;
   const epoch = this.epoch;
   const guard = async () => {
    if (Date.now() >= deadline) failure('BATCH_EXPIRED');
    if (this.activeLegacy || epoch !== this.epoch || canonical(await n.context()) !== canonical(context)) failure('FAST_STATE_CHANGED');
    if (Date.now() >= deadline) failure('BATCH_EXPIRED');
   };
   let nativeFailed = false;
   for (let i = 0; i < operations.length; i++) {
    const o = operations[i];
    try {
     await guard(); wrote = true;
     let id: string | undefined;
     try {
      if (o.type.startsWith('add')) { id = await n.create(o); if (!id) failure('CREATE_RETURNED_NO_ID'); created.push({ id, op: o }); r.created_ids.push(id); }
      else { if (!await n.remove(o.type.slice(7), o.id!)) failure('DELETE_NOT_CONFIRMED'); id = o.id; r.deleted_ids.push(id!); }
     } catch (e) { nativeFailed = true; throw e; }
     r.item_results.push({ index: i, status: 'applied', id });
     // A native call that settles late must never start another operation.
     if (Date.now() >= deadline || this.epoch !== epoch) failure('LATE_EXECUTION');
    } catch (e) {
     r.failed_index = i;
     if (r.item_results.at(-1)?.index === i) r.item_results.pop();
     r.item_results.push({ index: i, status: 'failed', error: String(e) });
     r.status = nativeFailed || Date.now() >= deadline || this.epoch !== epoch ? 'uncertain' : 'partial'; break;
    }
   }
   if (r.failed_index !== null) {
    for (let i = r.failed_index + 1; i < operations.length; i++) r.item_results.push({ index: i, status: 'skipped' });
    // Compensation cannot restore deletions; never claim ACID rollback.
    if (created.length && Date.now() < deadline && this.epoch === epoch) {
     r.rollback_attempted = true;
     for (const c of [...created].reverse()) { try { await guard(); await n.remove(c.op.type.slice(4), c.id); } catch (e) { r.warnings.push(`Rollback unconfirmed: ${c.id}: ${String(e)}`); break; } }
    }
   }
   if (Date.now() < deadline && this.epoch === epoch) {
    const after = await this.observe(n, p);
    r.revision_after = after.revision;
    const present = new Map([...after.data.traces, ...after.data.vias].map(o => [o.id, o]));
    if (r.failed_index === null) {
     const matches = created.every(c => matchesOperation(present.get(c.id), c.op));
     r.readback_verified = matches && r.deleted_ids.every(id => !present.has(id));
     r.status = r.readback_verified ? 'complete' : 'uncertain';
    } else {
     r.rollback_complete = r.rollback_attempted && !nativeFailed && r.deleted_ids.length === 0 && created.every(c => !present.has(c.id));
     r.readback_verified = false;
    }
   }
   if (r.status !== 'complete') r.warnings.push('Stop and inspect compact state. Native rejection/timeout may have effects; do not invent a new transaction id to retry.');
  } catch (e) { r.warnings.push(String(e)); r.status = wrote ? 'uncertain' : 'partial'; }
  finally {
   if (wrote && !r.revision_after) this.epoch++;
   // Invalidate the old token even after full compensation, without claiming a fresh observation.
   // No observed post-state => revision_after stays null, never a fabricated token.
   r.mutation_started = wrote;
   entry.result = r;
   this.activeBatch = false;
   r.native_api_call_count = n.calls;
  }
  return { context, result: r };
 }
}
export function matchesOperation(p: Primitive | undefined, o: Operation): boolean {
 if (!p || p.net !== o.net) return false;
 if (o.type === 'add_trace') return p.kind === 'trace' && p.layer === o.layer && p.width === o.width && canonical(p.points) === canonical(o.points);
 return p.kind === 'via' && (p.x ?? 0) === (o.x ?? 0) && (p.y ?? 0) === (o.y ?? 0) && p.diameter === o.diameter && p.hole === o.hole;
}
export const fastPath = new FastPath();
