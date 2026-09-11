# Stage A / Execution V2 release-line merge

Both accepted histories are preserved by a real two-parent merge; no rebase, cherry-pick or rewritten commit.

- Stage A parent: 594f78b3204ab0ff1110ff6aa7219ab6c0bef726
- Execution V2/release parent: 75616af88ef768b645aa23d6a894aa6344f8af2d
- Common ancestor: a583bf731d946d2d39f1223e078d711bd41710d5

## Semantic conflict resolution

The incoming Stage A changes implement the legacy ActionContract/reducer/evidence adapter and its consumers, generated projections and tests. These have been superseded by the accepted Execution V2 implementation. Restoring them would reactivate legacy dispatch/repeated interpretation and contradict the accepted no-compatibility runtime.

The released V2 source, action catalog, business handlers, FIFO, effect ownership, recovery, projections, tests and plugin packaging are therefore retained byte-for-byte from the V2 parent. Stage A implementation and tests remain fully accessible at the Stage A parent commit; they are not linked or compiled into the current runtime. No independent business action change was found in the Stage A handler/catalog diff: handler changes are legacy preview evidence and contract validation; catalog changes attach ActionContract only.

All nine Stage A design/results documents are retained at their original paths as historical records, not current runtime specifications. This merge preserves history rather than reintroducing two execution architectures.

## Host smoke

User confirmed the installed release menus/Toast behavior. After the final full restart, daemon health showed one 2.0.0 Connector activation (EasyEDA 3.2.186), replacing the earlier three registrations. No design operation was executed. The existing menu-only startup fence is intentional.

## Validation

Run post-resolution typecheck, Connector tests, MCP tests, Go protocol/app/daemon/selfupdate tests and release package validation. Confirm production files have no diff against the V2 parent and both parents are ancestors before publishing.

Post-merge checks passed: extension typecheck; Connector 863/863; Go protocol/app/daemon/selfupdate; CLI build; MCP 21 PASS / 1 explicit Host opt-in SKIP with the freshly built CLI; generated V2 catalog; release-check v2.0.0 including the existing eext. Initial MCP invocation used an unavailable default catalog binary; explicit freshly built CLI passed without source changes. Historical Markdown contains three intentional two-space line breaks reported by diff --check; historical documents are retained byte-for-byte.
