# Public V2 execution and logical window identity

Public callers use `easyeda action ACTION --input JSON`, existing supported high-level CLI commands, or MCP domain tools. Optional window/project/document selectors are discovery inputs. The CLI constructs and pins the V2 request, stable target, schema and operation identity internally. Agent workflows do not construct an internal envelope.

## Connection identity

- The Connector caches a logical host-window identity and its runtime on the physical root window. Menu activation reuses that runtime.
- Activation identifies the executor lifetime. Transport identifies one WebSocket connection.
- Reconnecting the same activation replaces its transport; a late close cannot remove the successor. Competing activations cannot replace a live executor of the same logical window. Two actual Home windows stay distinct.
- Incomplete registrations are rejected before appearing in health. Old transport identities cannot authorize new requests.
- An already admitted operation retains its original identity. Same-activation transport replacement sends reconciliation only, never a second mutation.

## Retained historical files

The user requested preservation of historical source files, not deletion. Thus zero active legacy execution paths does not mean zero historical strings in the repository.

| Retained material | Execution disposition |
|---|---|
| Old daemon `/action` and `/writeverify` | Explicit rejection; historical handler is not registered |
| Old `call`, debug CLI and stale-read override | Removed from public workflow or refused before transport |
| `sch.py`, `lint.sh`, bulk-place/bulk-connect scripts | Explicit unavailable entrypoints; original implementation retained |
| official autolayout, frame/zone drawing, write via-bond, drc-rules-set | No V2-native equivalent; unavailable, no fallback |
| Group annotations, zone text/frame movement, sheet tidy apply | Refused before placement; supported geometry/planning retained |
| Legacy business test fixtures | Test-only V2 transport adapter; not an Outcome oracle or production adapter |
| 22 obsolete legacy integration tests | Explicit ARCHIVED skips, not counted as passing; current V2 boundary suites remain active |

`postAction` uses V2 only. The daemon remains the sole Outcome authority. CLI reports preserve daemon receipts; MCP projects V2 directly. Reconciliation, UNKNOWN ownership and no-replay rules are unchanged.

## Verification evidence

Logs: `artifacts/public-v2-contract/` (local artifacts, not release inputs).

- Connector: 866 passing tests; typecheck passes.
- Go: full package run plus final app rerun: 13 packages pass, 2895 test/subtest pass events, 22 explicit archived skips, zero unresolved failures.
- MCP: 21 offline passes, one opt-in Host test excluded by default. The Host test separately passed on the deployed formal binary through MCP/CLI/daemon/Connector; the exposed receipt exactly equals stored operation status. Evidence: `formal-host-mcp-readback.json`.
- Catalog: 151 actions, 144 V2_NATIVE, 7 UNSUPPORTED; generated catalog check passes.
- Manual reconnect after daemon restart: one Home logical ID `host-8e38c7b8-256a-434a-8410-d27ff31707bd`, same activation, new transport. Automatic background reconnect was not established by this observation.
- No Host design mutation was performed for this qualification.

Final deployed daemon: `C:\User\Code\easyeda-agent\bin\easyeda.exe`, SHA256 `1E68BE1D61B9DC0F873861175EC4696555B950A9FA1F877C3E666E8F3AC94212`. Final reconnect retained the same logical window and activation, transport `:7`; startup fence false. Existing receipts were handed off before replacement; no owner was discarded. Installed Codex Skills and configured MCP now use this public contract.
