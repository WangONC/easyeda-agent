# Fast Manual PCB V0.1 contract

Implementation and Agent-facing contract: [Fast Manual PCB](../skills/easyeda-agent/references/fast-manual-pcb.md).

Frozen source baseline: `ed91d03782dc9d732592d919b9a11fc998695a86`.

The offline fixture lives in `internal/daemon/fastpath_test.go`; actual HTTP/WS gate integration in `fastpath_transport_test.go`; the Connector executor/adapter are independently exercised against native mocks in `extension/src/fast-path*.test.ts`. Fixture timing is CPU/mock timing, not a prediction of real EasyEDA wall-clock speed.

No user project or installed Connector is used by these tests. Actual native batch pad availability and stale-index behavior still require a dedicated smoke project after installing the built Connector.
## Offline verification recorded 2026-09-08

- Go 1.26.3 / Windows amd64. Full `go test ./...` found four baseline test failures. The same four were reproduced from an isolated archive of frozen `ed91d03782dc9d732592d919b9a11fc998695a86`: `TestStripArtifactNesting`, `TestResolveEnrichScriptPriority`, `TestResolveEnrichScriptNotFoundListsProbedPaths`, `TestUpdateCLIReplacesBinaryAndVerifiesChecksum`. They concern Windows path/home/executable-bit assumptions and were not changed.
- Full suite with only those four top-level tests excluded: PASS. Fast Path Go tests and daemon/protocol suites: PASS. `go vet` on app/daemon/protocol/fastpath: PASS.
- Connector: 281 tests PASS; TypeScript typecheck/build PASS.
- MCP: 8 tests PASS, including actual stdio discovery with the new CLI, catalog-derived Fast tool availability, argument mapping, and structured compact failures.
- The local `.eext` was inspected as a zip: version 1.4.4; bundled code contains both native Fast actions and `pcb.fast_manual.v0.1`; no src/node_modules included. No installation or real project operations were performed.

Fixture (mock/native-count model; not real EasyEDA throughput):

| Nets | Trace segments/net | Total traces+vias | Outer operations | WS actions | Verification result bytes | Apply modeled native calls |
|---:|---:|---:|---:|---:|---:|---:|
| 8 | 2 | 24 | 4 | 4 | 2,604 | 100 |
| 8 | 12 | 104 | 4 | 4 | 9,736 | 340 |
| 16 | 2 | 48 | 4 | 4 | 4,756 | 172 |
| 16 | 12 | 208 | 4 | 4 | 19,341 | 652 |

Every fixture operation emits the telemetry contract in test output. Native method counts grow with explicit writes and document guards; WS action counts remain 4. Disposable manual JS = 0, disposable checker Python = 0. The separate native adapter mock covers 32 components with 2 distinct net reads and **zero per-component pin reads**.

CPU benchmark, 16 nets / 192 segments / 16 vias, Ryzen 7 9700X: approximately **1.476 ms/op**, 221,719 B/op, 436 allocs/op (single recorded run; no native/transport latency). The actual HTTP→daemon→mock WS test separately verifies workflow refusal before writes, four successful flow actions, and preservation of the legacy stale DRC gate.

## Modified-file inventory

Existing files modified:

- `extension/extension.json`, `extension/package.json`, `extension/package-lock.json`: Connector version 1.4.4.
- `extension/src/actions.ts`, `extension/src/protocol.ts`: minimal handler registration, legacy in-flight revision fencing, capability advertisement.
- `internal/app/cmd_pcb.go`, `internal/app/dispatch.go`: CLI registration and execution-boundary UUID guard mapping.
- `internal/daemon/audit.go`, `internal/daemon/daemon.go`, `internal/daemon/dispatch.go`, `internal/daemon/stalereads.go`: telemetry fallback, receipt state, dispatch/queue/gate/autosave integration, advisory-only Fast geometry reads.
- `internal/protocol/actions.go`: three catalog actions.
- `mcp/package.json`, `mcp/package-lock.json`, `mcp/src/core.mjs`, `mcp/src/server.mjs`, `mcp/test/integration.test.mjs`: version 0.18.4, direct tools, CLI mapping, compact structured results.
- `skills/easyeda-agent/SKILL.md`: version alignment and scoped reference entry.

New files:

- `internal/fastpath/fastpath.go`, `internal/fastpath/decode.go`, `internal/fastpath/rules.go`, `internal/fastpath/fastpath_test.go`.
- `internal/app/cmd_pcb_fastpath.go`, `internal/app/cmd_pcb_fastpath_test.go`.
- `internal/daemon/fastpath.go`, `internal/daemon/fastpath_test.go`, `internal/daemon/fastpath_transport_test.go`.
- `extension/src/fast-path.ts`, `extension/src/fast-path-native.ts`, `extension/src/fast-path.test.ts`, `extension/src/fast-path-native.test.ts`.
- `mcp/src/fast-path.mjs`, `mcp/test/fast-path.test.mjs`.
- `skills/easyeda-agent/references/fast-manual-pcb.md`, `docs/fast-manual-pcb.md`.

Build outputs are ignored by Git: `bin/easyeda-fastpath.exe` and `extension/build/dist/easyeda-agent-connector_v1.4.4.eext`. No commits or staging were performed.
