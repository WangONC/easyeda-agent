# Minimal receipt handoff and live recovery

Base repair commit: `bed7819511efdf2279887c8b052f91d21c7bf650`.

## Implemented boundary

- Daemon graceful shutdown and POST `/v2/handoff` close admission and atomically write a bounded local receipt file (same-directory temporary file, sync, rename). A failed write leaves admission closed. The explicit endpoint prepares shutdown; it does not kill the process.
- Normal handoff includes all in-memory receipts, retaining duplicate-operation tombstones as well as the unresolved owner. Requests, digests, outcomes, effects, target, evidence and owner are stored; sockets/callbacks are not.
- `--v2-receipt-file` is restored before listening. Invalid/truncated/foreign digest/invalid owner files refuse startup. Restoration never invokes an executor or re-finalizes an Outcome. Pending remains pending and cannot be released from process-exit evidence.
- Automatic replacement of a running daemon is disabled. The separate per-start safety assertion is not persisted or enabled automatically. This is graceful handoff, not crash/power-loss exactly-once: after an unclean exit, a stale snapshot is not proof that later native operations never started.
- Explicit cross-session recovery uses exact project/document UUID/type and current target guards. Released UNKNOWN receipts stay UNKNOWN. A missing historical socket gives a recovery-required error rather than a panic.

## First deployment bootstrap

The pre-handoff binary cannot execute newly added shutdown code. `v2 capture-held-handoff REQUEST_FILE RECEIPT_FILE` therefore performs three **GET-only** requests to the live loopback daemon: status, evidence, status. It refuses changing receipts, pending settlement, foreign digest/target, non-UNKNOWN results, non-effect requests, redirects and an existing destination file. It captures only the explicitly identified held operation, not an invented full historical receipt inventory. The old owner stays fenced until the validated file is durable. No request is sent to the original action endpoint.

Subsequent deployments use the daemon's own full snapshot endpoint/shutdown. Do not use the bootstrap as a general history import, restoration of missing evidence, or permission to replay an old operation absent from the snapshot.

## Actual Host evidence, 2026-09-11

Original: `ffa19787-8523-4362-ac06-89c570c523be` (`pcb.manufacturing.export`). Captured handoff SHA256: `6A94E51E12458D906B816758F754F18E664FE397C942F31427BE68ABCD8F0BD5`.

The old daemon process was replaced only after validated atomic capture. Before any Connector reconnected, new `/health` reported `v2_effect_owner=ffa19787-8523-4362-ac06-89c570c523be`: startup did not expose an empty authority.

The Connector reconnected as session `c2b77842-10de-448c-9abc-1747aa7c41ae`, retaining its activation. Exact fresh `document.current` read `08ba26e5-8e49-4cd7-9297-b85bf491195d` succeeded with effect_started=false. Release returned original Outcome UNKNOWN and ownership_released=true. No manufacturing mutation was replayed.

Then fresh V2 `pcb.save` operation `344c54cd-fa8c-4d96-ba65-3bb35b406edc` SUCCEEDED with native_settled=true; health had no owner. This confirms the reconnected Connector accepted a subsequent controlled effect after release. Save ACK is not persistence proof. Manufacturing content qualification remains unresolved.

Evidence files are in `artifacts/handoff-*.json` (local, not committed). The original manufacturing bytes/receipt fixtures remain unchanged. The one cumulative Connector installation was requested only after safe release and save; no per-fix package cycle was added.

## Offline tests

- Coordinator restart: settled and pending UNKNOWN, barrier restoration, exact-target recovery, release, duplicate no replay, new effect only after release, repeated atomic replacement.
- Corruption: truncated JSON, foreign digest, missing owner, unproven settlement, invalid Outcome, duplicate IDs; no partial restore.
- Daemon: corrupt handoff fails before port binding, including embedded routes.
- Bootstrap: GET-only capture, foreign and pending refusal, restore preserves UNKNOWN and ownership.
- Go full tests and build PASS; affected recovery/restart suites PASS. No 151-action audit was repeated.

## Host batch after the first handoff

- New Connector activation: `easyeda-agent-e158b0e9-a7d6-4db6-96cf-52f11ebae555`.
- Exact project open `84d05f40-c2fe-48ae-8fec-d78ed89efe91` and document open `7bd3da8b-307d-4ec3-a1d5-a03804655fc8`: SUCCEEDED.
- Fresh snapshot `a4d82e20-19bf-4de4-9ed1-84d63b6a58bb` retained both component IDs, placements, pad nets and saved outline. Old-session read was rejected with V2_SESSION_LOST.
- Resume no-op `fad43015-8334-4fc6-8d32-148cd116c2c0`: SUCCEEDED, effect_started=false/state_changed=false. A subsequent outline rewrite `b4eb3eae-a86b-4d9c-8de9-34c1e262a68e` SUCCEEDED with the real reversed/subdivided Host representation. This is a bounded manually initiated close/reopen checkpoint, not a fully autonomous reload workflow or final E2E PASS.
- Wire `db6d4967-de98-40af-a3e6-0effe1201427`: NOT_APPLIED, effect_started=false, missing Host structuredClone. Its exact evidence is a fixture. All three production uses (wire create, connect_pin, group move) now copy extracted wire data without structuredClone; undefined/nonfinite observations remain uncoerced. The 3072 geometry property cases run with structuredClone absent.
- Native drill inventory is now recorded before JSON serialization. Undefined hole getters cannot become a zero-hole proof. Manufacturing inspection permits a missing PTH/NPTH program only with complete explicit zero-category evidence from the same operation. Original ZIP tests cover absent/partial/foreign-count/positive-hole cases. Positive-hole inventory is not claimed as full mapping or DFM certification.
- Offline regression at this batch: Go full tests PASS; Connector 824 PASS; typecheck and production bundle/package PASS. New package SHA256 `B0E2EA99EB2A66FAAF7D0DF3F35F5CA19FC386E1E6480CE7344EC964863CF56B` awaits Host installation/qualification.
