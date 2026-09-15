# Round 3 qualification status

**ROUND3_BLOCKED**. See [Round 3 result](ROUND3_RESULT.md), [151-action qualification matrix](ROUND3_QUALIFICATION_MATRIX.md), and [Host evidence](ROUND3_HOST_EVIDENCE.md). Offline convergence passed; current manufacturing ownership, checkpoint and full E2E remain blocked/unqualified. No complete autonomous Host certification is claimed.

# Execution V2 current status

Round 2: **144 V2_NATIVE / 7 UNSUPPORTED / 0 NOT_MIGRATED**, total 151. See [Round 2 implementation report](ROUND2_RESULT.md), [mechanical inventory](ACTION_MIGRATION.md), and [baseline business audit](round2-business-audit.json). This is offline implementation qualification, not real Host certification.

The following Round 1 record is historical; its migration counts and deferred-action notes are superseded by Round 2.

# Execution V2 Round 1 implementation

Baseline: `a583bf731d946d2d39f1223e078d711bd41710d5`. Branch: `codex/execution-v2`. Stage A archive remains `594f78b3204ab0ff1110ff6aa7219ab6c0bef726`.

This is the frozen execution-model implementation, not Host qualification. No real EasyEDA Host was used. The later user constraints (no transitional compatibility, preserve baseline business semantics, save ACK is command completion) take precedence over the original freeze document's migration-period compatibility language.

## Foundation

| Boundary | Implementation |
|---|---|
| Request | `internal/executionv2/model.go`: explicit protocol/action revision/schema/request ID/operation ID/target/input/budget. Parent ID and expected revision are represented but unsupported uses fail closed this round. |
| Target | HOME/PROJECT/DOCUMENT/LIBRARY; exact registration session and activation. DOCUMENT requires project UUID/document UUID/type/tab. Connector checks fresh identity around execution and observation. Names resolve business objects inside the bound scope; retired-window redirects cannot authorize V2 effects. |
| Operation | Daemon coordinator, 2,048 retained in-memory records, no eviction/replay. Same ID+digest joins/returns one operation; different digest refuses. Caller budget/request ID do not alter the operation digest. |
| Effect gate | One Host-wide effect owner; Connector controlled effect entry plus existing FIFO. Gated routing actions reuse catalog workflow stage gates. Disabled action policy remains enforced. |
| Pending barrier | Deadline publishes UNKNOWN without releasing native ownership. Only explicitly diagnostic no-effect reads may pass. Connector reload is not cancellation. |
| HandlerResult | Fixed protocol/op/digest/target, explicit effect facts, verification coverage and timing evidence; business value and diagnostic evidence are separate. `prepare()` must register the verifier before `effect()`. |
| Verification | Fresh identity/geometry/metadata/absence/selection checks, or a documented native command-return contract. Late resolve, late reject and continuation failure all reach the registered fresh verifier. |
| Finalizer | Only `internal/executionv2/model.go:Finalize` creates public Outcomes. Four outcomes only. No action-name/raw-status/evidence-shape reducer. Full postcondition proof can establish success without inventing a measured state change. Unknown residual coverage still cannot establish success. |
| Receipt/evidence | A SUCCEEDED public result retains its complete business `value`; payload size can never project a successful read as empty. Bounded transports fail explicitly, while the full current HandlerResult remains independently available as evidence. |
| Reconcile | `POST /v2/operation?id=…&view=reconcile` invokes the stored verifier, never handler replay. The request returns current status; poll status for the fresh result. A settled but unverifiable operation remains fenced. |
| Projection | `easyeda v2 call/status/evidence/reconcile/catalog`; MCP domain multiplex tools consume the same daemon result. Exit/isError projection does not reinterpret business success. |
| Isolation | `/action` and `/writeverify` return 410; `conn.dispatch` and `runAction` refuse. Missing V2 catalog metadata/handler means `V2_ACTION_NOT_MIGRATED`. All parent operations are refused this round, so no V2 parent can invoke a legacy child. |

Public effect facts are `effect_started`, nullable `state_changed`, `native_settled`, `effect_scope`, `reconciled`. A verified no-op records no change. Save/notification command acceptance does not claim a physical persistence/UI change. Stage invalidation uses effect facts, not Outcome. Legacy autosave construction is disabled; no background save bypass remains. Connection/menu diagnostics use logging instead of uncoordinated Host toasts/dialogs. Extension connection preferences remain control-plane configuration, not design operations.

Every receipt also carries `timing`: queue wait, target/binding guard, pre-read/snapshot,
native effect, post-read, verification, reconcile and total milliseconds. Actions migrated
to split verifier stages report post-read and verification separately; older combined
verifiers expose `post_read_verification_ms` and leave the split fields null rather than
inventing precision. Timing is diagnostic only and cannot change Outcome.

## Business API preservation audit

`a583bf7` ActionSpecs and real handlers were compared; discrepancies in the old catalog are resolved in favor of actual handler behavior. [The machine-generated inventory](ACTION_MIGRATION.md) lists all 151 actions, their baseline input descriptions and current mode. [Detailed JSON](migration-inventory.json) includes baseline descriptions/source locations and V2 schema metadata. `reality-levels.json` is immutable audit classification, never a runtime action registry.

Corrections made during this round:

- Equal-length delete and differential rename retain name-only input; no extra nets are demanded. Layer ID/string/name/aliases, presets, show/hide/exclusive and normalized side input remain supported.
- Selection accepts a scalar ID, array, duplicate IDs and an empty clear-selection request; native selection is read back as a set.
- Library namespacing, scope/library resolution, metadata, device associations, copy/import inputs and reasonable business output fields are retained.
- PCB component patch aliases/nullable metadata/manufacturer/supplier/otherProperty use fresh requested-field verification; lock completion retains the Host workaround.
- Polygon defaults, ignored extra point coordinates, wire flat/nested coordinates and all official image polygon tokens are preserved. Arbitrary new collection limits were removed; existing report bounds remain.
- Ordinary create operations do not impose a new pre-existing-net requirement. Constraint actions retain their native net-membership preconditions.
- Pour creation proves the created region. Duplicate names are accepted; new identity plus geometry distinguishes it. Copper rebuild remains best-effort and can return `poured:false`; successful fill computation is not a new prerequisite.
- Unknown titleblock fields are ignored and reported. Existing structural-field protection and fresh field readback remain.
- Save ACK true proves save-command completion; it does not prove a checkpoint or persistence after reload. Toast preserves warning alias/unknown-type default, and viewport uses its formal command-return contract.
- `pcb.report` retains geometry, telemetry, paths, profile, reference-net and tolerance inputs. Its original pure Go calculations were moved to `internal/measurement`. One V2 read gathers native report/snapshot data; daemon computes the business report before the sole finalizer. No legacy typed child is called. The formal Fast typed actions themselves remain NOT_MIGRATED.
- Existing topology identity mapping, schematic page readiness/name readback, compact geometry and source-identity business code are retained. This round does not claim all retained code is V2-executable.

Intentional breaking boundaries:

1. Legacy request/result envelopes, `ok/verified/partial` completion semantics, old raw CLI dispatch and old Fast dedicated tools are unavailable. Use the explicit V2 surface. This is required by NO TRANSITIONAL COMPATIBILITY.
2. Unknown top-level parameters and invalid/unsupported native branches fail closed. A historical ignored placeholder such as wire `style` is not advertised as an implemented feature; actual color/lineWidth/lineType inputs remain. Known domain defaults (toast type, pour fill) are preserved.
3. Effect targets require the frozen stable identity envelope. No implicit current-document/name/window guessing or automatic retired-window redirects. Ambiguous or mismatching identity refuses before effect.
4. A fulfilled native promise alone cannot certify a content mutation. Insufficient or foreign verification yields UNKNOWN; old apparent success is intentionally not preserved. Conversely a verified already-satisfied request may succeed without writing.
5. HTTP V2 requests have an explicit 16 MiB body bound. This accommodates model input beyond the original temporary 1 MiB bound while retaining a finite transport allocation limit.
6. Legacy force overrides are not silently translated into V2; workflow gates remain enforced. Parent execution, optimistic expected_revision use, persistent receipt recovery and checkpoint automation are not implemented and are not silently simulated.

## Migration

- Total 151; V2_NATIVE 81; NOT_MIGRATED 70; RETIRED/UNSUPPORTED 0.
- Level 1: 33/33; Level 2: 46/46; Level 3: 2/47; Level 4: 0/21; Level 5: 0/4.
- Additional Level 3: `pcb.component.modify`, `pcb.drc.check`.
- Full migrated and deferred lists, with reasons: [ACTION_MIGRATION.md](ACTION_MIGRATION.md).

V2_NATIVE means the execution boundary is migrated and offline tested. It does not assert autonomous qualification on an untested Host/version. The 70 remaining actions fail closed and are Round 2 work; no fallback is retained to make them appear functional.

## Verification and test scope

Run from repository root unless stated otherwise. On this Windows host, `GO_BIN` points to the installed temporary Go toolchain and Node is `C:\User\Environment\nodejs\node.exe`.

```text
go build ./...
go test ./...
node extension/node_modules/typescript/bin/tsc --noEmit --incremental false -p extension/tsconfig.json
(cd extension) node --require ts-node/register config/esbuild.prod.ts
(cd extension) node --require ts-node/register --test --test-concurrency=1 src/*.test.ts
node --test mcp/src/v2-projection.test.mjs
node scripts/generate-v2-catalog.mjs --check
node scripts/audit-v2-migration.mjs --check
```

Foundation tests cover duplicate digest, conflict, foreign/malformed results, no-op, partial, pending, missing verification, target mismatch, forbidden child execution and timeout without replay. Template tests cover successful fresh readback, verifier failure, wrong target and controlled late native settlement. Model import additionally verifies settled partial metadata completion. Daemon HTTP/WebSocket tests and Connector transport/FIFO tests exercise real framing against offline fakes. CLI tests execute the command against an HTTP fake; MCP tests verify identical Outcome projection. These are integration segments, not a real-Host end-to-end qualification run.

`v2-baseline-equivalence.test.ts` executes immutable baseline handler bodies against fake native APIs as a business oracle. `retained-business.test-support.ts` exposes retained current business functions only inside tests; it neither exports a production dispatch route nor certifies their migration. Old Fast business tests call the retained engine directly. Closed legacy endpoint tests now assert refusal. Windows fixture changes isolate USERPROFILE and avoid asserting POSIX executable bits/root-path assumptions on Windows; application behavior was not changed for those tests.

## Runtime audit

- V2 legacy fallback: **no**.
- V2 legacy reducer: **no**.
- V2 parent → legacy child: **no** (parent execution is explicitly unsupported).
- CLI/MCP Outcome reinterpretation: **no**.
- V2 Host effects bypassing coordinator: **no exposed path found**; old transport/dispatch is closed and background save is disabled. Retained unreachable business functions remain source/test assets.

Known bounded limitations: in-memory receipts do not survive daemon loss; no WAL/exactly-once power-loss claim. Lost activation/native ownership cannot be cleared by pretending reload cancelled it. Operator-assisted recovery and a new trusted binding are required when state cannot be established. Autosave/checkpoint, stale/writeHealth migration and remaining composites are not claimed complete. Round 1 is a reviewable foundation, not the final autonomous EDA release.

## Final offline regression result

Go build and all Go package tests passed. Connector typecheck and production build passed; the complete serial Connector suite passed 530/530 (zero skipped). MCP projection passed 6/6; generated catalog and mechanical migration checks passed. Late DRC settlement verifies the original operation report under fresh target guards, without a second recompute. No real Host was operated.
