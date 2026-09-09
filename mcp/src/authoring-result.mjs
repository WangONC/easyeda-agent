// Preserve native evidence and autosave semantics; only project the authoring
// outcome to MCP. An accepted write with incomplete readback is not success.
export function authoringResult(action, execution) {
  if (!['schematic.component.modify', 'schematic.wire.create', 'project.create', 'project.open', 'schematic.create'].includes(action) || !execution.ok) return execution;
  const envelope = execution.result;
  const value = envelope?.result ?? envelope;
  if (!value || typeof value !== 'object') return execution;
  const partial = value.partial === true || (Array.isArray(value.notApplied) && value.notApplied.length > 0);
  const unverified = value.verified === false || value.status === 'unverified' || value.status === 'uncertain' || value.status === 'failed' || value.status === 'partial' || value.status === 'stale';
  if (!partial && !unverified) return execution;
  return { ok: false, error: {
    code: partial ? 'AUTHORING_PARTIAL' : 'AUTHORING_UNVERIFIED',
    message: 'Host write may have occurred. Inspect authoritative readback before any retry; no automatic replay.',
    evidence: envelope,
    ...(execution.stderr ? { warnings: execution.stderr } : {}),
  } };
}
