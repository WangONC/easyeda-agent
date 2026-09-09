/// <reference types="@jlceda/pro-api-types" />
import { ActionError } from './protocol';

// Diagnostic projection of the native fill, never the requested pour boundary.
// Explicit opt-in: large source arrays must not become the default Agent result.
export async function readPourGeometry(pours: IPCB_PrimitivePour[], limit: number) {
 if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new ActionError('INVALID_PAYLOAD', 'geometry_limit must be 1..64');
 const started = Date.now();
 const ids = new Set(pours.map(p => p.getState_PrimitiveId()));
 let regions: IPCB_PrimitivePoured[];
 try { regions = await eda.pcb_PrimitivePoured.getAll(); }
 catch (e) { return { status: 'unavailable', reason: String(e), native_api_call_count: 1, duration_ms: Date.now() - started, complete: false, fills: [] }; }
 const fills: Array<Record<string, unknown>> = [];
 const observed = new Set<string>();
 let omitted = 0;
 let sourceBytes = 0;
 const maxBytes = 128 * 1024;
 for (const region of regions) {
  const parent = region.getState_PourPrimitiveId();
  if (!ids.has(parent)) continue;
  observed.add(parent);
  for (const fill of region.getState_PourFills()) {
   const source = fill.path.getSource();
   const bytes = JSON.stringify(source).length * 3;
   if (fills.length >= limit || sourceBytes + bytes > maxBytes) { omitted++; continue; }
   sourceBytes += bytes;
   fills.push({ pour_id: parent, poured_id: region.getState_PrimitiveId(), fill_id: fill.id, filled: fill.fill, line_width: fill.lineWidth, source });
  }
 }
 const missing = [...ids].filter(id => !observed.has(id));
 return { status: missing.length || omitted ? 'incomplete' : 'observed', complete: missing.length === 0 && omitted === 0,
  freshness: 'unverified', connectivity: 'unknown', fills, missing_pour_ids: missing, omitted,
  source_bytes: sourceBytes, native_api_call_count: 1, duration_ms: Date.now() - started };
}
