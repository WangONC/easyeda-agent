# Schematic replace Value verification — 1.4.15 accepted

Status: CLOSED after user-installed Connector 1.4.15 was confirmed by live health and B passed through official MCP. No new Host mutations were performed during commit finalization. Earlier 1.4.14 deployment observations below are historical evidence.

## Host A/B evidence

Host: EasyEDA 3.2.186; candidate CLI/daemon/connector 1.4.14. MCP server uses EASYEDA_BIN=.easyeda/tmp-builds/easyeda-identity-14.exe; the formal bin/easyeda.exe (1.4.11) was not changed. No version bypass.

Created/opened using MCP project.create/project.open:
- Project: Value_AB_1.4.14_20260910, dece6e4333c6463aa8ef6a69c5642bc9
- Page: 06a81881f2912ca3 (initial schematic 66a9f781a58bb725)
- Library: 0819f05c4eef4c71ace90d822a990e87
- Target: 209453f1b0764552b318805e2b7a5c99
- Different-value source: aca5085151854f90b77a65ef46d8a1c1

| Case | Operation | Immediate Value | After save/reload |
| --- | --- | --- | --- |
| A, R1 | Direct target placement | 10kΩ | 10kΩ |
| B, R2 | Place 5.1kΩ, replace to same target (no keepProperties) | empty, but complete/verified=true | empty |

A primitive: 5e545f29492d7220. B source primitive: 2fe00b24edf41af5; B replacement: 06af8009cee7897f. The blank B remains as diagnostic evidence; no manual backfill.

The real A/B proves that typed placement projects Value correctly and replace loses it. Code confirms replace omitted the existing place-time otherProperty backfill; this request did not preserve old properties. Native create copies empty property values. The final verification previously checked carried top-level fields but skipped otherProperty.

Raw MCP request/results: .easyeda/runtime/value-*.json; client harness: .easyeda/runtime/value-mcp.mjs. The standard easyeda_document_reload tool reported saved=true, reloadCompleted=true. All circuit actions used the official MCP tools; no direct debug or GUI circuit operations.

## Accepted minimal patch

extension/src/actions.ts, schematicComponentReplaceImpl only:
- Reuse planOtherPropertyBackfill and backfillOtherProperty from placement for target properties.
- Before deleting the original, verify projected properties against fresh native get returned by the existing source persistence step. A nonempty source Value must be read back, including when its key is missing.
- Include target otherProperty atomically with carried fields in final modify so omitted values cannot reset; preserve target supplierId during that same write.
- Existing explicit keepProperties=true overrides target properties, including explicitly preserved empty values. No new override API/framework.
- Verify final property readback before complete/verified=true. Mismatch follows the existing cleanup/recovery and no-replay paths.
- Identity/provenance architecture, routing, lifecycle, Fast Path, tuning and manufacturing unchanged by this patch.

## Initial offline validation and diagnostic checks

- Connector: 341 PASS (335 existing + 6 new Value cases).
- New cases cover old empty/nonempty Value with default vs explicit preservation, and silent blank Value at staging/final readback; failure cases also verify no replay.
- MCP: 22 PASS / 1 SKIP with candidate CLI.
- TypeScript typecheck: PASS.
- Candidate bundle compile: PASS (extension/dist/index.js), not loaded in Host.
- git diff --check: PASS (repository CRLF advisory only).
- No Go source changes this run; previous Go/vet acceptance was not re-investigated.
- Diagnostic schematic.check: 4 floating pins on the two intentionally unwired test resistors, passed=false.
- Native schematic DRC: 0 fatal / 0 error / 1 aggregate warning, passed=false. No all-clear electrical-design claim.

## Historical deployment blocker (resolved)

The official MCP tool catalog has no connector build deployment/reload action. User declined the existing non-GUI CLI-debug hot-load mechanism. At that point the Host still ran the pre-patch 1.4.14 connector; the identical version label and offline PASS did not prove deployment.

The blocker remained open pending deployment. The later 1.4.15 acceptance below used a fresh different-value source rather than replaying an already-replaced transaction. Explicit keepProperties semantics are covered by offline tests.

Original STM32 project 78d062716ad740c2987701f55aadba5f was not edited. Current Host remains on the saved diagnostic project. No Integration Run continuation under this request.

## Final Host acceptance — Connector 1.4.15

The only change after the previously passing offline patch was the distinct Connector version. Health reported Connector 1.4.15 on new connections, with no 1.4.14 Connector connected. CLI/daemon stayed 1.4.14 during this version-marker experiment; the normal gate emitted a patch-version warning, not a bypass.

Only B was repeated in the same diagnostic project/page. Fresh source R5 (06ae2dabd5e442b8) was 5.1kΩ. Replacement d19f166d24f8d893 returned complete/verified=true with Value=10kΩ. Independent immediate read and save/reload read both returned Value=10kΩ and source device 209453f1b0764552b318805e2b7a5c99 in library 0819f05c4eef4c71ace90d822a990e87. This supports the diagnosis that the previous same-version install had not activated the patched bundle.

A had already passed direct place and reload. Duplicate transaction and invalid-target fail-closed checks passed on the prior Host run; these were not claimed as newly repeated on 1.4.15. The existing 13 replacement tests were rerun after 1.4.15 B and passed, including blank-value rejection and no-replay. No live fault injection was used to manufacture a verifier failure.

Raw final evidence remains ignored under .easyeda/runtime/value-145-*.json. The diagnostic page retains historical blank R2/R4 as evidence; it is not a completed electrical design. Original STM32 was untouched. Value blocker CLOSED; STM32 integration was not resumed. This closure makes no claim about unrelated full integration/manufacturing readiness.
## Final commit regression — 1.4.15

Connector 341 PASS; MCP 22 PASS / 1 SKIP with a locally built 1.4.15 CLI; typecheck, go vet and git diff --check PASS. Full Go tests reproduced only the four previously documented Windows baseline failures: TestStripArtifactNesting, TestResolveEnrichScriptPriority, TestResolveEnrichScriptNotFoundListsProbedPaths, TestUpdateCLIReplacesBinaryAndVerifiesChecksum. A follow-up had transient local subprocess/port failures in TestRoutingTelemetryReadPath and TestSchematicIdentityCompatProbeUsesFreshOfficialArchive; both passed isolated reruns. Final `go test -p 1 ./...` with only the four baseline names excluded passed. No tests or implementation were changed to mask these failures.

Build binaries, eext bundles, caches and runtime evidence remain excluded by existing ignore rules. No Host mutation, push or tag was performed during finalization.