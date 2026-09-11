# Settled UNKNOWN recovery repair

Baseline: `0a4f31393c5eddc352e70bd6ed513e118ea012ce`.

## Scope

This is a limited recovery repair, not another migration round. The four Outcomes and Finalize rules are unchanged. A semantic UNKNOWN can retain its meaning after effect ownership ends. `ownership_released: true` records explicit daemon release authorization; it is not proof of semantic success or an acknowledgement that the Connector received the release frame.

## Recovery API

POST `/v2/operation?id=<original-operation-id>&view=recover` with a full ordinary V2 Request as JSON. Supply a **new** read operation ID, current session/activation/tab, and exactly the original project UUID, document UUID and document type. Only catalog-admitted `NONE` Host-effect scope is accepted. No names or legacy requests are resolved. Normal current-target guards still run. Response contains separate `operation` and `readback` receipts. Read success does not change the original Outcome.

POST the same endpoint with `view=release` and a fresh `document.current` Request to end settled ownership. Release requires an authenticated original HandlerResult matching protocol, operation ID, digest, original target and effect scope, plus explicit native settlement and a successful fresh identity read. Missing/foreign/malformed settlement and pending native work are rejected. The daemon checks the currently registered target again before authorizing release. Current recovery only supports DOCUMENT identity; no cross-scope inference is made.

The original request, target and digest are immutable. Recovery creates a separate read, never invokes the original handler or mutation, and does not revive an old verifier closure on a foreign session. Semantic supplementation remains in the separate read receipt/evidence. Explicitly released original receipts are frozen so later observations cannot turn an old UNKNOWN into success after subsequent work.

Same activation / new transport: release authorization is delivered to that transport. New activation: there is no original Connector slot to release; no slot is reconstructed. A lost release frame remains safe because the Connector keeps its own fence. `reconcile` on an explicitly released record resends release authorization, never the original mutation. Another fresh release request may update the transport after a further reconnect.

## Barrier boundary

The coordinator permits actions with `NONE` Host-effect scope while an effect owner exists. ControlledExecutor still prohibits their native effect entry. All other scopes remain blocked. This does not assert filesystem immutability of local query caches; it prohibits Host mutations, navigation, save and recompute. Release does not certify manufacturing content, persistence, DRC qualification or residual semantic correctness.

## Offline validation

Targeted tests cover lost session, exact UUID/type rebind, current read-only recovery, wrong UUID/type, foreign settlement, pending release refusal, original duplicate identity, zero recovery mutation, and release-only delivery on a reconnected WebSocket. Connector tests prove pending reads are allowed but do not unlock ownership, and settled unavailable verification can receive daemon release without replay. MCP projection preserves UNKNOWN and reports isError even with ownership_released.

No live daemon restart, Connector installation, manufacturing re-export or Host mutation was performed for this repair. The running operation `ffa19787-8523-4362-ac06-89c570c523be` has not been released by this source change. Its manufacturing content qualification remains unresolved. Deployment and live recovery evidence are still required; this document does not mark the overall release complete.

## Deployment preflight (2026-09-11)

The live old daemon still reports the original operation UNKNOWN, native_settled=true, reconciled=true. A POST to its recovery view returned HTTP 400 `V2_UNSUPPORTED_OPERATION` before any action dispatch. Installing a Connector package cannot update this Go route.

There is no implemented hot code reload or receipt/ownership handoff in the running version. Killing/restarting it would discard its in-memory operation records, so that was not done. Deployment needs a supported evidence-preserving handoff before the new daemon can operate on this original receipt. Saving JSON alone is not an implemented handoff and is not claimed as one.

Offline results for the committed repair: Go full tests and build PASS; Connector 816 PASS; TypeScript typecheck PASS; MCP 28 PASS, 1 Host opt-in SKIP. The unified Connector production bundle and package were rebuilt successfully. Package: `extension/build/dist/easyeda-agent-connector_v1.4.15.eext`, SHA256 `8E53C334A4E20F69F14279023DC9E4F88FB82884D65D63CB316834E75BB6FC75`. Built, NOT INSTALLED.

Live status, original evidence and unsupported-route probe were saved to `%TEMP%/easyeda-release-deployment/`. No mutation, original export replay, daemon restart or Connector reload occurred. Wire/outline/rebind, ECO, checkpoint and final E2E remain blocked behind live ownership recovery; no qualification was promoted.
