# Round 3 Host evidence log

This is a running evidence log, not the final qualification verdict. Host: EasyEDA 3.2.186. Runtime: V2 only. Isolated projects; no edits to the existing benchmark project. No debug execution, legacy `/action`, direct native mutations, or diagram repair through UI.

## First smoke: ExecutionV2_Round3_Smoke_20260911

Project `7707b8e8d86c44fb8fc8dde47587140f`, page `e23cb29c7fdf8eb5`.

- Project create/open and document open: PASS.
- LCSC lookup, R1/R2 placement and source identity reconstruction in the same session: PASS.
- Wire create `c1535651-f51b-4cf3-9445-47b961d55274`: initial verifier incorrectly treated reversed endpoints as different geometry. Native settled; original receipt remained UNKNOWN. No mutation replay.
- Subsequent effects were not attempted. User explicitly discarded isolated unsaved edits during a full Host restart.

## Second smoke: ExecutionV2_Round3_Smoke_Rerun_20260911

Project `1aa8e96e54d048379459288de3242ef6`, page `b80f1539eab2bf63`.

| Action | Operation | Observed result |
|---|---|---|
| project.create | 7dfcb57b-a414-4b4f-8606-8e7fd0d62a8c | SUCCEEDED; native UUID + fresh project record |
| project.open | 998e52da-4b86-4189-b79c-e36b90f32011 | SUCCEEDED; fresh project identity + initial schematic |
| document.open | 24c6b531-a9ac-4335-a181-c13e6a281db4 | SUCCEEDED; stable page UUID and tab |
| schematic.library.get_by_lcsc | 8e723fbc-7b9c-4eee-96d5-f92472d8fa4f | SUCCEEDED; C25804 |
| schematic.component.place R1 | 18786439-6a4d-4cfb-8cd9-1575635826d2 | SUCCEEDED; primitive 25d132f4a12ab811 |
| schematic.component.place R2 | afefa77e-a1c8-4714-86f1-4e855ffac0f5 | SUCCEEDED; primitive 4c8ce3faf60eb314 |
| schematic.components.list | 87f2b93e-4595-4a05-9a43-9bb0abd9273b | SUCCEEDED; pin coordinates and original device source reconstructed |
| schematic.wire.create signal | f999f965-b58d-4bf6-9945-5cb98f773724 | Initial UNKNOWN; same-operation fresh reconcile then SUCCEEDED; no replay |
| schematic.wire.create GND | b2c17b88-2333-4be2-86df-7a6f9cf7f798 | UNKNOWN; native settled; verifier treated native segment array as polyline |

Observed GND geometry: `[80,50,80,100,320,50,80,50,320,100,320,50]`. Requested polyline: `[80,100,80,50,320,50,320,100]`. The Host returns three independent, unordered endpoint pairs. Existing baseline group-move already documents this workaround. Round 3 geometry comparison now applies it to the native readback only; caller inputs remain polylines. Negative fixtures still reject missing sections and extra geometry. No mutation was replayed to work around this verifier failure.

Additional baseline differential finding: wire create's published output is `{primitiveId, net, line}`. Restored `line` instead of V2's accidental `points` substitution; flat and nested caller inputs are compared against the actual a583bf7 handler in tests.

## Not yet run / not proven

Save ACK, reload persistence, rebind/resume, source identity after reload, PCB placement/routing/plane, DRC, manufacturing and complete E2E remain NOT_RUN in these smoke attempts. Same-session source identity success is not persistence proof. Isolated project creation is not complete E2E success.

Raw request/result/status/evidence JSON is retained under the session artifact directory with `round3-host-*` and `round3-rerun-*` prefixes. The harness refuses to overwrite a request stem and does not retry mutations.

## Third isolated fixture: ExecutionV2_Round3_PCB_20260911

Project e7c288be345149da97a48a8b908c2049, PCB a61d7f82ce7bb900, session e4f28583-9091-42fb-89b3-e1bf73c32a61. User had fully restarted the Host after the old wire smoke. Old wire UNKNOWN evidence and the fresh HOME read were exported before the explicitly recorded operator-assisted daemon epoch change. The current daemon has not subsequently been restarted.

| Action | Operation | Actual observation |
|---|---|---|
| project.create/open | 8db9f9c5-80e5-4b15-8760-60939417ee69 / 4eaf2c26-df24-4124-9db2-83c3d187867f | SUCCEEDED, native project UUID / fresh identity |
| board.new_pcb | 387c6c84-975c-411a-861e-1b8d0d7fecdd | SUCCEEDED, new Board1_1 and PCB UUID |
| document.open | 54dd8e23-a538-4e9f-bb41-f8953c68b4dd | SUCCEEDED, exact PCB tab |
| pcb.save | 83d82c0d-3a2a-41f6-88df-9491e5e18d8c / 1cf404a0-7c6e-43c9-8b2d-58d5b9006af0 | SUCCEEDED, native ACK; checkpoint_proven=false |
| pcb.add_component R1/R2 | f046042b-8394-4c6e-bf72-a8f5086d0f80 / f5bc1106-f894-4ab6-853c-a62d7fd127a2 | SUCCEEDED; native component identities, 2 assigned pads each |
| pcb.drc.check clear fixture | 6b9503d1-6f22-40ce-b46b-7607f9e89575 | SUCCEEDED, design_pass=true |
| pcb.drc.check intentional overlapping different-net pads | 52dad90d-50eb-4e27-979b-3812d3038ab7 | SUCCEEDED, design_pass=false, 2 clearance + 4 connection violations |
| pcb.component.modify move R2 | 6411b9bf-77b7-4066-965f-ffcffc9a6db6 | SUCCEEDED; fresh x/y patch |
| same patch, new operation | 0c7941c7-a9ab-46f4-b580-185ff9ccb8e1 | SUCCEEDED; effect_started=false, state_changed=false |
| pcb.outline.set | de769b05-92e2-4694-b507-65afc5859470 | PARTIAL; exact-source-order verifier did not accept native winding change; never replayed |
| pcb.outline.get | fe5cd316-bd20-4565-bedf-7292da55ecab | SUCCEEDED; points [[0,0],[0,400],[600,400],[600,0]], rendered bbox includes 5mil half-width |
| board.snapshot_compact | 0450c884-f415-4f17-a28d-0cecadaa718b | SUCCEEDED; exact component-owned pad IDs, revision and 4 supported pads |
| route.preflight | e3c1444c-0b4c-4ad9-a6ee-68439537b06e | SUCCEEDED; no conflicts for explicit trace |
| route.apply_batch | request retained | ADMISSION REJECTED: missing outline_confirmed / pre_route_passed. No native route write. Stage CLI still calls closed legacy reads; product execution path remains incomplete. |
| pcb.manufacturing.export | ffa19787-8523-4362-ac06-89c570c523be | UNKNOWN, all native file generation settled, artifact delivery complete, content verification unavailable. Reconcile reads only and remains UNKNOWN. |

Gerber zip: five real Gerber layers, 3371 bytes, SHA256 84c67d1b72bdb1e6d68596190e67f6204e5d419bf218111cfeee7dcf3da2ed3f. No drill programs in this fixture. This is not evidence that all native hole categories were exhaustively observed absent. BOM: UTF-16LE tab, 388 bytes, one data row / 2 components. PNP: UTF-16LE tab, 1036 bytes / 2 placements. Their structure passed inspection; manufacturing content is NOT_CERTIFIED. The parser now reports unavailable counts as null instead of inventing zero from missing files (offline fix not loaded in current daemon).

The current UNKNOWN ownership is preserved. There is no native replay, manual stage patch or reload-based unlock. The fixture was saved before manufacturing export, but reload/rebind/resume has NOT been proven. The schematic in this PCB fixture is empty: this is selected PCB qualification, NOT the required complete Schematic-to-PCB E2E.

Actual V2 stdio MCP HOME read also passed once after the user restart; text, structuredContent and stored daemon receipt matched. Default offline Host test skip remains a skip, separate from that recorded live PASS.
