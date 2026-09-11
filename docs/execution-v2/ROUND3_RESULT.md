# Execution V2 Round 3 result

**ROUND3_BLOCKED** — offline convergence is committed for review; final autonomous Host qualification did not pass. This is not an EXECUTION_V2_COMPLETE claim and not a request to start another architecture round.

Round 2 baseline: `6f2e562aca77bd9ae416ccf5dd7abe92966bd0da` (`完成 Execution V2 全量动作迁移`). Existing `codex/execution-v2` worktree retained. Final commit is the commit containing this report (`git rev-parse HEAD`); its full hash is reported in the handoff. No main merge/reset, push or tag.

## Final inventory and qualification

151 formal actions: **144 V2_NATIVE, 7 UNSUPPORTED, 0 NOT_MIGRATED, 0 LEGACY_RUNTIME**. [Complete 151-row qualification matrix](ROUND3_QUALIFICATION_MATRIX.md), [machine data](round3-qualification.json).

| Level | Total | Native | Unsupported |
|---|---:|---:|---:|
| 1 | 33 | 33 | 0 |
| 2 | 46 | 46 | 0 |
| 3 | 47 | 45 | 2 |
| 4 | 21 | 18 | 3 |
| 5 | 4 | 2 | 2 |

Conservative whole-action qualification: **QUALIFIED 1 / HOST_QUALIFICATION_REQUIRED 142 / UNSUPPORTED 7 / FAILED 1**. Only daemon-local system.health is marked fully qualified. Positive narrow Host results are recorded separately, rather than promoting all parameter branches, lifecycle scenarios or persistence to PASS. The failed action is manufacturing export, whose actual incomplete proof retains UNKNOWN ownership.

## Actual fixes

- Wire geometry batch: reversed endpoints, unordered/nested segment arrays, collinear merging, zero-length filler, exact-grid tolerance and complete interval coverage. Native-returned IDs, net/style and unrelated identity scope remain mandatory. All shared create/connect/group/replace/disconnect/cascade/check/read consumers were traced. Restored baseline wire `line` output.
- Frozen group geometry prevents mutable native handles changing the expected proof. Disconnect/cascade no longer invent diagonal segments from native segment pairs.
- PCB outline accepts winding/start-point/subdivision changes with complete straight closed-path coverage, not bbox equality. Actual updated Host verifier remains unqualified.
- Restored board current-getter fallback; undefined PCB creation no longer leads to invalid compensation assumptions.
- Ten native list/search projections reject malformed/missing values instead of manufacturing empty success. DRC rule retrieval and report sections preserve incomplete evidence. Normal empty/default/alias output remains baseline tested.
- Pour creation now requires the returned primitive ID and exact foreign/unrelated scope checks; it cannot infer created identity from a matching name.
- Track-lock verification avoids repeated full-board scans per selected item.
- Core stage/check/layout/rules reads now use one stable binding and V2 read-only operations. They consume daemon Outcome directly, reject foreign receipts and effect actions, never retry or navigate, and refuse duplicate-name/target drift. Legacy business-fixture transport adaptation is test-only.
- Daemon restart defaults to an explicit effect fence. In-memory lost receipt identity cannot silently authorize new effects after restart.
- Manufacturing missing drill counters are null, not zero. Real original files and historical receipt are fixtures; no invented drill program or fabricated absence proof.

## Semantic differential audit

[All 151 baseline direct-key audit](round3-business-audit.json): zero missing direct handler keys. The required-schema promotion candidates (`pcb.pour.create.net`, `pcb.view.side.side`) match actual baseline refusal behavior, despite the stale optional pour-net description. 53 fake-Host differential scenarios execute immutable a583bf7 source, including real symbol-build defaults/native arguments and output.

The bounded matrix assessment records 131 PRESERVED, 13 INTENTIONAL_BREAK and 7 UNSUPPORTED in the inspected business scope, with no outstanding **detected** accidental regression. This is explicitly **not an exhaustive dynamic proof of all 151 actions/branches/output shapes**. Full semantic qualification remains incomplete; the report does not claim that the user's exhaustive equivalence criterion is proven merely by checking parameter keys.

Intentional boundaries: explicit V2 identity/operation envelope, strict invalid top-level input, no legacy completion/retry, malformed native shape fail-closed, explicit seven unsupported actions, and actual-segment disconnect scope instead of the baseline phantom diagonal. No new required convenience locator was introduced by this batch. Save ACK remains save-command success; checkpoint persistence is separate.

## Legacy / bypass convergence

[Mechanical pattern table](round3-convergence-audit.json): 39 scoped production runtime files, zero compatibility reducer/prior merge/repeated Interpret references; seven raw business/transport flag references have non-finalizer dispositions. `/action` and `/writeverify` reject, old runAction/conn.dispatch reject, registry entries are native objects, nonempty typed parent IDs reject. Effect-before-verifier and effect-during-reconcile are runtime refusal conditions, exercised with controllable promises.

No executable fallback, parent→legacy child, blind replay or background save bypass was found. This combines entrypoint inspection and tests; it is not a formal whole-program proof. Retained unreachable source helpers and a583 test-only oracle are not counted as runtime bridges. Some old CLI workflows remain explicitly unusable against the closed transport; they are not compatibility fallbacks.

## Property and Level 4/5 evidence

14,096 deterministic property cases: 10,000 finalizer metamorphic cases, 1,024 batch residual cases, 2,048 axis wire and 1,024 diagonal wire cases. No unexplained invariant violation. Same-op/digest and conflict, late-settle/reject, target drift, readback failure and no replay remain covered by Foundation tests.

| Level 4/5 family | Offline evidence | Host status |
|---|---|---|
| project create/open, schematic create | lifecycle identity/transaction tests; native guards | project/document creation/open smoke PASS; retired/same-name/reload matrix incomplete |
| board new_pcb/rebind | native identity, donor/no-op, fallback and compensation tests | new_pcb PASS; full donor/rebind cases NOT_RUN |
| symbol/footprint build | geometry/identity/save/late tests; new ten-case symbol suite and baseline oracle | NOT_RUN |
| PCB component add | actual source and via-owner tests, aliases and bbox oracle | R0603 placement PASS; embedded via owner NOT_RUN |
| DRC compare | shared DRC parser/comparison/daemon fixture tests | check positive/negative PASS; compare lifecycle NOT_RUN |
| manufacturing | real byte fixtures, parser/transport tests, missing inventory fail closed | FAIL; retained UNKNOWN |
| outline/page clear/plane/via-hop | scoped geometry, batch residual/late/compensation templates | outline old verifier FAIL, fix offline; remaining complex Host cases NOT_RUN |
| schematic group/clear/disconnect/connect_pin | scoped deletion/geometry/late/merge tests | updated wire-dependent batch NOT_RUN |
| route.apply_batch | native preflight/revision/receipt/late/compensation tests | preflight PASS; apply native NOT_RUN (stage admission refused) |
| component.replace | source/replacement/compensation/wire-preservation tests | NOT_RUN full replacement/reload |
| five unsupported Level 4/5 | explicit refusal and product-impact review | no prohibited fallback attempted |

These are bounded deep suites and actual evidence, **not full Level 4/5 Host certification**. Typed parent/child execution is refused, not a hidden generic DAG; fixed native composites are tested without inventing child receipts.

## Host / checkpoint / E2E

Detailed operations and original evidence: [Host evidence](ROUND3_HOST_EVIDENCE.md). Batch scope: [wire geometry](ROUND3_WIRE_GEOMETRY_BATCH.md). Original wire fixtures and real manufacturing files are committed under `extension/src/fixtures/round3-wire-host` and `internal/manufacture/testdata/round3-host`.

- PASS: actual MCP read, isolated project/document operations, two PCB components, component move and verified no-op, compact snapshot, route preflight, save ACK.
- PASS: native DRC clear report and deliberately overlapping fixture report (2 clearance + 4 connection violations); execution SUCCEEDED with design_pass=false.
- FAIL: installed wire/outline representation verifiers; corrected offline but no updated Host retest.
- FAIL: manufacturing content proof; three files delivered, BOM/PnP structurally verified, missing drill inventory not proven zero.
- NOT_RUN: save→reload→rebind→semantic readback→resume. Save ACK is not substituted for this checkpoint.
- E2E **FAIL / incomplete**: schematic attempts stopped at wire verification. Subsequent PCB-only smoke used an empty schematic and does not establish schematic→PCB/ECO transfer or the full chain.

Current held operation: `ffa19787-8523-4362-ac06-89c570c523be`, **UNKNOWN / native_settled=true / reconciled=true**. No mutation was replayed and neither daemon nor Connector was reloaded to clear it. The batch package is built but installation is held; SHA256 `3892EBCB47EDEB0DDCE73E26DA763731AEFEFAF8D6FF75F494F04A2DD368EEE3` (`extension/build/dist/easyeda-agent-connector_v1.4.15.eext`). It supersedes the earlier uninstalled package. No installation request was issued per individual fix.

## Remaining real blockers

1. Manufacturing's settled but unverifiable operation cannot currently be safely resolved/released with available evidence. This prevents further Host effects and updated Connector qualification. No reset/reload escape was used.
2. Formal checkpoint/reload/rebind/resume remains unimplemented/unqualified end to end. Old reload dispatch is closed. Restart fencing is safety refusal, not a persistence recovery implementation.
3. `pcb.import_changes` is unavailable with no qualified full schematic→PCB/ECO alternative. Board binding and explicit placement do not prove complete mapping. This is a declared product blocker.
4. Source rebind alternatives and complex Host ownership/workarounds remain unqualified. [Seven unsupported actions and precise impact](ROUND3_QUALIFICATION_BOUNDARIES.md).
5. Whole-action Host matrix, full E2E and exhaustive branch-level semantic differential assurance are incomplete. The conservative matrix exposes these gaps instead of assigning artificial PASS.

## Offline regression commands and counts

Run with the installed Go toolchain and Node; TS commands from extension; MCP commands from mcp with EASYEDA_BIN set to the newly built V2 review binary. The running daemon was not replaced.

```text
go build ./...
go build -o <temp>/easyeda-v2-round3-review.exe ./cmd/easyeda
go test -json -timeout 120s ./...
node extension/node_modules/typescript/bin/tsc --noEmit --incremental false -p extension/tsconfig.json
(cd extension) node --require ts-node/register --test --test-concurrency=1 src/*.test.ts
(cd extension) node --require ts-node/register config/esbuild.prod.ts
(cd extension) node --require ts-node/register build/packaged.ts
(cd mcp) node --test test/*.test.mjs src/*.test.mjs
node scripts/generate-v2-catalog.mjs --check
node scripts/audit-v2-migration.mjs --check
node scripts/audit-v2-business.mjs --all --write
node scripts/audit-v2-convergence.mjs --write
node scripts/audit-v2-qualification.mjs --check
git diff --check
```

- Go: 13 packages PASS, four packages without tests; **2,804 tests/subtests PASS, zero failures/skips**.
- Connector: **815 PASS, zero FAIL/skip**. Typecheck and production bundle/package PASS.
- MCP: **27 PASS, 1 explicit Host opt-in SKIP, zero FAIL**. Separate earlier actual Host MCP read PASS; the skip is not counted as Host PASS.
- Catalog/inventory/convergence consistency PASS. [Machine summary](round3-offline-results.json).
- Regression classification: old stage HTTP fixtures needed test-only V2 transport boundaries (A); wire/read/identity/board/efficiency issues were real regressions and fixed (B). Wrong-cwd TS invocation and wrong binary MCP invocation were environment errors, rerun correctly. New symbol negative cases initially expected reconcile success incorrectly; corrected to assert rejection and retained mutation count for foreign/ambiguous identity.

No real Host fuzz was performed. No push/tag. Final git status is checked after the commit; the committed report is a blocked qualification record, not a completion certificate.
