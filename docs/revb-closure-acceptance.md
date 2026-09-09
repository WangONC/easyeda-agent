# RevB Minimal Closure acceptance — 2026-09-09

## Executive result: REVB READY / MCP FEATURE FREEZE

Base HEAD: `3796470f93bd38b1c5603eeb5ae9dd629e0032ff`. Work remains uncommitted.
Connector: 1.4.9; final CLI/daemon build: 1.4.9-closure.3; tested Host: 3.2.186.
All PCB mutations were confined to `REVB_CLOSURE_FIXTURE_20260909`.
Project UUID: `9d8308bf7645452a95aa1fd7ff307124`; PCB UUID: `98172fb17f8fdcf0`.
The original Fast Path smoke and RevA routing were not altered.

## Final Readiness Closure — accepted on EDA 3.2.186

Both final blockers are CLOSED. No new MCP tool or Connector change was needed
for this final pass. CLI `bin/easyeda-readiness-final.exe` and daemon
`bin/easyeda-readiness-2.exe` report `1.4.9-readiness.2`; the final CLI additionally
fixes report profile validation when geometry is not explicitly selected. Daemon
profile code is identical. Connector remains 1.4.9; MCP package is 0.18.5.
These are development builds: the version gate does not certify release parity.

### Manufacturer profile: CLOSED

Official JLCPCB calculator reviewed test output: JLC08161H-3313, 8 layers,
nominal 1.6 mm (displayed finished 1.57 mm), SE50 L1 referenced L2, width 5.9400
mil. Source: https://jlcpcb.com/pcb-impedance-calculator/ . The displayed 0.5%
calculation tolerance is recorded as such, not a fabrication tolerance certificate.
This test profile is not the final RevB manufacturing selection; unknown material
brand, unit delay and dielectric constant were not invented.

- R1 `FINAL_JLC08161H_3313_SE50_L1_R1`: MANUFACTURER_VERIFIED at revision
  `mttja5z8-k5gvc6hfltq:240` (16 ms / 18 native calls).
- Host physical stackup: UNAVAILABLE; HOST_PHYSICAL_STATE_UNVERIFIABLE.
  Official physical getter is documented since EDA 4.2. Its absence on 3.2 is not
  an infrastructure failure or readiness blocker; no HOST_VERIFIED claim.
- R1 preflight PASS / zero conflicts, 31 ms / 18 native calls. Scoped report
  explicitly returns profile_usable=true, without guessing delay or topology.
- Controlled fixture pour-rule increase: 10 -> 12 mil; native readback verified.
  At revision `:256`, R1 becomes STALE / ROUTING_RULES_CHANGED. Current-revision
  preflight rejects PROFILE_REJECTED (15 ms / 18 calls); report returns
  profile_usable=false and the stale reason. Normal document reload was used.
- Explicit re-review/rebind with new immutable ID
  `FINAL_JLC08161H_3313_SE50_L1_R2` restores MANUFACTURER_VERIFIED at `:273`.
  New preflight PASS / zero conflicts. Old R1 was not overwritten.
- R2 profile hash:
  `80d828a3aeac927f56aa64e5e9af3a97180d3ae91d0180aee06e42cf3d989ed4`.
- No route.apply_batch was executed in this final pass.

### NPTH manufacturing: CLOSED

Existing library footprint/device creation and pcb.add_component placed only
H_NPTH1, a 100 mil ROUND hole at (900,0), metallization=false, empty net.
Component ID `7cf44a08d3e6ae3c`; Pad ID
`7cf44a08d3e6ae3c75f3417c8c092353`. Project-library create returned no UUID;
personal-library typed creation succeeded. No new library capability was built.

Final export: 383 ms / 18 handler native calls (surrounding read calls excluded).
Manifest `a6cb8f69beb3dbf41ac254b58605a82b7173bd145931331e7efaaad3602df02e`,
status `structure_verified`. Revision fence `:273 -> :280`; the existing
sameObservedContent guard confirms unchanged captured design content across the
native export, despite the legacy epoch increment. This is not ACID isolation.

- PTH: 2 unique holes, 0.330200 mm; aggregate and Via subset programs deduplicated.
- NPTH: 1 hole, 2.540000 mm, X22.86 Y0.0. Actual file includes
  `;TYPE=NON_PLATED`, `;Layer: NPTH_Through`, and one Excellon hit.
- Gerber: 15 recognizable members, including all eight copper layers and outline.
- BOM: 2 rows / 3 components. PnP: 3 entries, including the mechanical fixture.
- Actual export files and all Gerber/drill members carry SHA256 and status.
  Empty NPTH files cannot pass this acceptance.

The fixture is not a release-ready product. Adding the mechanical component
correctly invalidated workflow confirmations/pre_route; none were bypassed or
silently restored. The controlled stricter pour rule was retained, without
rebuilding planes or asserting current fixture DRC PASS. Export structure
verification does not certify DFM or replace a fresh release gate.

### Final regressions

Related FastPath/daemon/workflow/stale/profile/measurement/manufacturing/protocol
Go tests PASS. New report regression proves profile_id cannot bypass validation
without geometry:true. MCP/stdio suite: 19/19 PASS including real Host read-only
snapshot/report. Connector: 305/305 PASS; TypeScript typecheck/build PASS;
go vet ./... PASS; git diff --check PASS. No disposable routing JS/checker Python,
force, bypass, or routing write. Frozen eight/sixteen-net transaction machinery
was not redesigned. Four previously proven Windows baseline failures remain
unrelated: TestStripArtifactNesting, TestResolveEnrichScriptPriority,
TestResolveEnrichScriptNotFoundListsProbedPaths,
TestUpdateCLIReplacesBinaryAndVerifiesChecksum.

MCP FEATURE FREEZE. No RevB design work or commit was started. The following
implementation table and fixture matrix retain the earlier closure-pass history;
its P4/I limitations are superseded only by the final acceptance above.

## Implemented packages

| Package | Implementation and reuse | Boundary / acceptance |
|---|---|---|
| P1 | Existing compact snapshot/preflight extended with bounded native arcs, nonzero polygon rings/holes, native poured copper projection, known region semantics and board-edge checks. Real Host source is a regression fixture. | Eight logical copper layers tested; unknown geometry and unknown region rules still reject. Negative-plane and arbitrary custom geometry are unsupported. No polygon kernel. |
| P2 | Existing native pour create/list/rebuild, logical handle mapping and Go guarded snapshot -> rebuild -> snapshot composition. | Repeated refresh, recreate remap and individual failure observed. Connectivity remains unknown; native dependency scope is not an incremental solve. |
| P3 | Existing native DRC flattening plus stored baseline comparison; existing native pcb.report plus scoped per-layer copper sums, explicit single-layer paths, pair/group spread, reference delta and tolerance. | DRC new/cleared cycle passed. Via barrel/entry-exit mapping and delay remain unresolved without authoritative physical profile; no topology guessing. |
| P4 | Immutable reviewed records bound to physical-stackup/rule hashes; context/put/get; profile consistency checks in preflight, report and deterministic helpers. | Automated VERIFIED/STALE/UNKNOWN tests pass. Real Host acceptance blocked by missing physical data. No impedance solver or fabricated manufacturer verification. |
| P5 | Fixed-corridor rectangular tuning and explicit-centerline P/N offsets with caller-specified symmetric endpoint vias. Output explicit plan/operations uses existing preflight/apply/readback. | Real tuning and pair write/measurement passed. Collinear helper segments collapse before emit to avoid native merge/ID ambiguity. No route search or pair skew tuner. |
| P6 | Native UUID project create/list/open, first schematic reuse/container entry, existing import/reload. Native manufacturing File export plus inspected SHA256 manifest. | Lifecycle main path passed; manufacturing partial as above. No project database, import engine or CAM engine. |
| P7 | Reuse existing schematic modify preservation and semantic readback; MCP retains partial/unverified as errors; invalid verifyWith references corrected. | Real component modify and wire passed. One place timed out but readback found it; no duplicate retry. This does not prove all intermittent Host failures eliminated. |
| P8 | Distributable RevB Agent contract: 8–16 net batching, stage freeze, profile/measurement-before-tuning, state capsule, API cache, explicit DRC cadence. | Policy only; no new CAD action. |

## API delta

Existing MCP domain tools dispatch to Go. No new Node state machine, no debug JS.

- `pcb.routing_profile`: context / put / get, exact project/document identity.
- `route.tuning_plan`: explicit selected straight span, fixed corridor, added length,
  pitch/min spacing/max amplitude/side; optional verified single-ended profile.
- `route.pair_plan`: explicit P/N identity, centerline, layer/width/gap and optional
  endpoint transition geometry; optional verified differential profile.
- `pcb.plane.refresh`: base revision and logical IDs, native rebuild, authoritative revision.
- `pcb.drc.compare`: explicit native run, optional baseline ID, compact delta + artifact.
- `pcb.report`: existing action gains nets/pairs/groups, geometry, explicit paths,
  reference_net, tolerance_mil and optional profile delay estimate.
- `pcb.manufacturing.export`: reviewed explicit layer/mm profile and verification IDs.
- `project.list`, `project.create`, `project.open`, `schematic.create`: UUID guards and
  activation-scoped no-replay create receipts.
- `route.preflight`: optional reviewed profile ID; existing three Fast Path MCP tools remain.
- `pcb.layers.list`: opt-in bounded native physical-stackup diagnostic inventory.

Full parameters and limits: [contract](revb-closure-contract.md).
Agent policy: [distributable contract](../skills/easyeda-agent/references/revb-agent-contract.md).

## Real Host acceptance matrix

N/R means not instrumented as a whole fixture, not zero. Timings are operation
telemetry where available, not fabricated whole-fixture wall times. Most Host
operations used the exact workspace CLI; separate real MCP stdio tests prove the
current server readback path. Do not label every CLI action as an MCP round trip.

| Fixture | Result | Evidence and measurement |
|---|---|---|
| A Lifecycle | PASS for native bootstrap path | Project created/opened by UUID; Host auto-created Board1/Schematic1/P1/PCB1. Two resistor instances and GND wire authored; import populated two PCB components; save/reload identities match. Whole duration/native calls N/R. Explicit nonexistent board container create rejected/uncertain and not retried. |
| B Multilayer | PASS for bounded tested set | Eight copper layers; actual poured source with four rings; void route PASS, solid pour/keepout/board-edge routes rejected, unknown follow-rule rejected. Arc collision rejected and clear path PASS. Preflights 10–32 ms / 18 calls each, revision `mttja5z8-k5gvc6hfltq:32`; arc at `:183`, 12–16 ms. |
| C Plane | PASS | Repeated refresh, visible missing-handle partial and remap `bab34189354d17ae` -> `5dccffead16da3cb` for GND@L1. Remap 208 ms / 11 handler calls; fresh void refresh 1140 ms / 11 handler calls, revision `:29` -> `:32`. These counts exclude two surrounding snapshots. |
| D Measurement | PARTIAL | Tuning span 480 mil / total GND copper 800; arc 142.274333882 vs native 142.274334; pair 436/488, spread/skew 52, tolerance 10 FAIL; real branch total 260 but endpoint path unresolved. Via inventory counts 1 per pair net; barrel/delay unresolved. Whole duration/calls N/R. |
| E Profile | FAIL: Host capability | physical_stackup=null, inventory=[], state UNKNOWN, revision `mttja5z8-k5gvc6hfltq:183`; 20 ms / 18 calls. No real VERIFIED or mutation-to-STALE claim. Automated state transition tests pass. |
| F Tuning | PASS after bounded helper fix | Initial native collinear merge caused uncertain ID readback and was reconciled, never retried. Fixed selected 280 mil span +200 =480; 8 traces + one delete, 9/9 complete, readback_verified; 75 ms, 63 calls, retry 0; revision `mtthj4uf-fvbnl24h3xf:263` -> `:265`. Capacity overflow rejected. |
| G Pair | PASS for finite helper | Two explicit nets, 6 traces + 2 vias; 8/8 complete, 101 ms, 60 calls, retry 0; revision `mtthj4uf-fvbnl24h3xf:282` -> `:284`. Gap 20, width 6, via diameter26/hole13, entry16/exit1. Readback and lengths match plan; mismatch52 is reported, not repaired. |
| H DRC | PASS comparison, not board DRC PASS | Baseline two GND connection findings; one intentional crossing produced new3/persistent2; deleting that exact line produced cleared3/new0/persistent2. Stable anchors survived globalIndex changes. Native revision suffixes322/346/370. Whole duration/calls N/R. |
| I Manufacturing | PARTIAL | Eight copper Gerbers + other requested outputs, PTH drill, BOM 1 row/2 components, PnP2. UTF-16LE tab-separated native tables parsed, actual SHA256 recorded. Export 298–332 ms / 18 handler calls (snapshot calls excluded). No NPTH file; complete package not certified. |

Raw runtime evidence is intentionally ignored under `.easyeda/closure/`. Selected
real geometry used by permanent tests is tracked as source testdata, not as a runtime
cache. No disposable routing JS, no disposable checker Python, no giant plane JS.

## Regression

- Connector 1.4.9: 305/305 tests; TypeScript typecheck and production eext build pass.
- Go fastpath/daemon/protocol/workflow and added app tests pass; go vet ./... passes.
- Complete go test ./... has four Windows failures reproduced on the unchanged HEAD:
  TestStripArtifactNesting; TestResolveEnrichScriptPriority;
  TestResolveEnrichScriptNotFoundListsProbedPaths; TestUpdateCLIReplacesBinaryAndVerifiesChecksum.
  All packages pass when excluding exactly these four baseline cases.
- MCP: 18 pass, 1 opt-in Host test skipped in default suite. Explicit real Host
  stdio snapshot/report test passes on Connector1.4.9; final-build check recorded separately.
- 8/16 nets x 2/12 segments: 24/104/48/208 primitives, four core requests and four
  simulated WS transactions in every case. No primitive-count-dependent WS fan-out.
  Apply telemetry simulation durations0–2 ms; these are not Host performance numbers.
- Workflow/stale/receipt/idempotency protections retained. No force/bypass, no
  autoroute/autoplace, no hidden topology/layer/via/corridor search introduced.

## Deferred / readiness decision

No feature freeze until physical profile acceptance and manufacturing completeness
are closed. Do not replace missing native physical data with a home-grown subsystem.
Full pair/skew tuning, arbitrary curves, negative-plane decoding without reliable
native data, via barrel timing without a physical mapping, and general SI/CAD kernels
remain outside the proven finite implementation. No continued general MCP expansion.

Build outputs and runtime evidence remain ignored. No commit, tag or push performed.

## Final runtime verification

CLI and daemon `1.4.9-closure.3` with installed Connector `1.4.9` reconnected to
Host3.2.186 on the same fixture. Final real MCP stdio snapshot/report: PASS,
434.8 ms test body (not native-only time). Profile context remains UNKNOWN at
`mttja5z8-k5gvc6hfltq:202`. No final routing mutation was issued.
An intervening daemon process exit had no recorded cause; service was restarted
and the connector reconnected automatically. The temporary failed readback attempt
was a connection refusal, not a PCB transaction and was not counted as a Host PASS.

## Git delivery inventory

19 tracked paths modified; 48 new source/test/document paths; none staged.
Compiled binaries, export files, runtime evidence and isolated baseline copy are
ignored and excluded. The stat below covers tracked changes only; new files are
listed separately by status.

```text
 extension/CHANGELOG.md                 |  43 +++++++++++++
 extension/extension.json               |   2 +-
 extension/package.json                 |   2 +-
 extension/src/actions.ts               |  55 +++++++++++++----
 extension/src/fast-path-native.test.ts |   6 +-
 extension/src/fast-path-native.ts      |  46 +++++++++-----
 extension/src/fast-path.ts             |   6 +-
 internal/app/cmd_pcb.go                |   9 ++-
 internal/app/cmd_pcb_fastpath.go       |  34 +++++++++-
 internal/app/dispatch.go               |   3 +-
 internal/daemon/fastpath.go            |  76 ++++++++++++++++++++++-
 internal/fastpath/fastpath.go          | 110 +++++++++++++++++++++++----------
 internal/fastpath/fastpath_test.go     |   2 +-
 internal/protocol/actions.go           |  17 ++---
 mcp/src/core.mjs                       |   2 +-
 mcp/src/fast-path.mjs                  |   2 +-
 mcp/src/server.mjs                     |   9 ++-
 mcp/test/integration.test.mjs          |   2 +-
 skills/easyeda-agent/SKILL.md          |   1 +
 19 files changed, 338 insertions(+), 89 deletions(-)
```

```text
 M extension/CHANGELOG.md
 M extension/extension.json
 M extension/package.json
 M extension/src/actions.ts
 M extension/src/fast-path-native.test.ts
 M extension/src/fast-path-native.ts
 M extension/src/fast-path.ts
 M internal/app/cmd_pcb.go
 M internal/app/cmd_pcb_fastpath.go
 M internal/app/dispatch.go
 M internal/daemon/fastpath.go
 M internal/fastpath/fastpath.go
 M internal/fastpath/fastpath_test.go
 M internal/protocol/actions.go
 M mcp/src/core.mjs
 M mcp/src/fast-path.mjs
 M mcp/src/server.mjs
 M mcp/test/integration.test.mjs
 M skills/easyeda-agent/SKILL.md
?? docs/revb-agent-contract.md
?? docs/revb-closure-acceptance.md
?? docs/revb-closure-contract.md
?? extension/src/compact-polygon.test.ts
?? extension/src/compact-polygon.ts
?? extension/src/lifecycle.test.ts
?? extension/src/lifecycle.ts
?? extension/src/manufacturing.test.ts
?? extension/src/manufacturing.ts
?? extension/src/plane-lifecycle.test.ts
?? extension/src/plane-lifecycle.ts
?? extension/src/pour-readback.test.ts
?? extension/src/pour-readback.ts
?? extension/src/poured-projection.test.ts
?? extension/src/poured-projection.ts
?? extension/src/region-projection.test.ts
?? extension/src/region-projection.ts
?? extension/src/testdata/host-poured-3.2.186.json
?? internal/app/observed_content.go
?? internal/app/observed_content_test.go
?? internal/app/pcb_drc_compare.go
?? internal/app/pcb_drc_compare_test.go
?? internal/app/pcb_manufacturing.go
?? internal/app/pcb_manufacturing_test.go
?? internal/app/pcb_measurement.go
?? internal/app/pcb_measurement_test.go
?? internal/app/pcb_plane_refresh.go
?? internal/app/pcb_plane_refresh_test.go
?? internal/daemon/routing_profile.go
?? internal/daemon/routing_profile_test.go
?? internal/fastpath/helper_operations.go
?? internal/fastpath/host_geometry_test.go
?? internal/fastpath/pair.go
?? internal/fastpath/pair_test.go
?? internal/fastpath/polygon.go
?? internal/fastpath/polygon_test.go
?? internal/fastpath/profile.go
?? internal/fastpath/profile_test.go
?? internal/fastpath/testdata/host-3.2.186-regions-pour.json
?? internal/fastpath/tuning.go
?? internal/fastpath/tuning_test.go
?? internal/protocol/actions_closure.go
?? internal/protocol/actions_closure_test.go
?? mcp/src/authoring-result.mjs
?? mcp/test/authoring-result.test.mjs
?? mcp/test/closure.test.mjs
?? mcp/test/host-readback.test.mjs
?? skills/easyeda-agent/references/revb-agent-contract.md
```
