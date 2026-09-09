> Historical acceptance record: temporary executable names below are evidence only,
> not runnable defaults. Current CLI/MCP/daemon entry is `bin/easyeda.exe` (1.4.11);
> future temporary builds belong in `.easyeda/tmp-builds/` and are removed after acceptance.

# Essential MCP Parity (MCP 0.18.5)

This pass exposes existing Go operations. It does not implement a workflow state
machine in Node, routing, placement or Project management.

## Capability map

A = existing CLI + typed action + MCP; B = CLI-only before this pass;
C = typed action missing MCP; D = SDK only, no repository high-level entry;
E = no repository capability. SDK availability is not verified Host support.

| Step | Before | Existing authority / MCP path | After |
|---|---|---|---|
| Current project | A | project info / project.current / easyeda_project | A |
| Create/list/open Project | D | SDK Project APIs only; no registered project.create/list/open or CLI implementation | NOT IMPLEMENTED / FUTURE GAP |
| Create first schematic container in a blank project | D | SDK createSchematic; no high-level repository action | FUTURE GAP |
| Add schematic page | A | schematic.page.create, requires existing schematicUuid / easyeda_schematic | A |
| Place/wire/read schematic | A | schematic.component.place, schematic.wire.create, schematic.read | A; existing Host reliability limits unchanged |
| Create linked PCB | A | pcb new-board / board.new_pcb / easyeda_board; creates shell + PCB with rollback | A |
| Board links and inventory | A | board.list/current/create / easyeda_board | A |
| Populate/sync PCB | A | pcb import-changes / pcb.import_changes / easyeda_pcb | A; read components/nets afterwards |
| Add individual schematic-derived part | A | pcb add-component / pcb.add_component / easyeda_pcb | A; explicit nets/identity required |
| Open/switch document | A | project open / doc switch use document.open / easyeda_document | A; project open does NOT open Projects |
| Set/read outline | A | pcb.outline.set/get / easyeda_pcb | A |
| Assembly process | B | pcb stage set-assembly | easyeda_workflow operation=set_assembly |
| Placement tier review | B | pcb stage confirm-tier | easyeda_workflow operation=confirm_tier |
| Layout/outline sign-off | A (CLI workflow, not WS action) | workflow confirm layout/outline / easyeda_workflow | Better guidance; same Go implementation |
| Pre-route gate | Already MCP, poorly documented | workflow advance -> runPcbLayoutLint -> evalLayoutGate -> recordLayoutGatePass | Documented; compact Go state returned |
| Save/close/reopen recovery | B | doc reload | easyeda_document_reload; verified identity/readback recovery below |
| Routing | A | dedicated Fast Path MCP tools; daemon stage gate | unchanged |

No C-class whitelist omission was found on this lifecycle: the existing domain
tools already derive their action enums from the CLI catalog. Do not create
another implementation of board.new_pcb/import_changes.

## MCP workflow contract

Use explicit `project` and `doc` for acceptance operations. All state, thresholds,
fingerprints, invalidation and audit remain in Go. Neither new operation is a
new WebSocket typed action: they are typed MCP arguments mapped to existing CLI.

- `easyeda_workflow {operation:"set_assembly", project, doc, profile}` accepts
  hand-solder or reflow. Hand-solder retains Go defaults: 40 mil general gap,
  60 mil iron access. Changing assembly invalidates placement and later stages.
- `confirm_tier` accepts tier 1..4, parts[] or empty:true, optional note.
  Review actual placement first. Tier 1 mechanical, 2 edge connectors,
  3 main IC/RF, 4 remaining satellites. Earlier tiers must be confirmed;
  tier 4 may omit parts to claim the remainder. No automatic placement.
- `advance` reconciles live document facts and fingerprints. With components
  and assembly it runs the existing layout-lint gate when needed. Defaults:
  minimum score 60, maximum crossings 8. Shorts, overlap, off-board components,
  tight pairs and blocked solder access also reject. The nine-dimension
  layout-quality score recorded by confirm-layout is a separate advisory score.
- Successful mechanical acceptance records pre_route_passed. This alone does
  not authorize routing: outline_confirmed must also exist. Assembly is a
  prerequisite of producing the mechanical acceptance, not a new route-gate bit.
- `confirm layout` requires all four reviewed tiers, all components claimed,
  assembly, and a valid assembly/layout gate. It records live placement hash.
- Create the real outline, then `confirm outline` requires placement confirmation,
  verifies fingerprints and requires nonempty native outline geometry.
  Outline writes invalidate outline/pre-route acceptance: advance again after
  the final change. An initial advance before layout confirmation is normal.
- `status` returns Go fields directly, including assembly, tiers, layoutGate,
  confirmed, missing, next and routeAllowed. `reconcile:true` verifies live state.
- Other operations return `{operation,command_ok,state,diagnostics,output}`.
  The state is a fresh CLI status projection even on command failure. Diagnostics
  and text output cap at 6000 characters, with explicit truncation flags.
  command_ok is CLI execution success, NOT routing authorization. Only the
  authority's routeAllowed is the routing verdict. A failed command/readback
  remains MCP isError. Reconcile after GUI changes.
- Force/forceUnsafe/skip-version-check are not accepted workflow arguments.
  Numeric thresholds are explicit existing CLI settings, not implicit overrides;
  do not lower them just to unlock a failed fixture.

`easyeda_document_reload {project,doc}` invokes Go `doc reload <doc> --json`.
It saves, closes and reopens; it does not pour or route. No caller JavaScript
is accepted. The existing CLI internally uses its fixed debug.exec_js close-tab
snippet; this pass neither exposes that action nor adds another close/reload
engine. This dependency remains a lifecycle limitation.

EASYEDA_BIN selects the exact executable, including paths with spaces. No PATH
fallback occurs after an explicitly selected binary fails. Existing CLI version
gates remain enabled; old binaries lacking commands return errors. This pass's
validated CLI/daemon build is 1.4.5-fastpath.3
(bin/easyeda-fastpath-reload.exe); Connector 1.4.5 is sufficient. Explicitly
select the current executable with EASYEDA_BIN. Local binaries and MCP client
configuration are not committed.

## Host recovery and acceptance: FASTPATH_SMOKE_01, 2026-09-09

Project 5b64534ff102440684a9f558494c5abc, PCB 29f9e2cced590eba.

The initial parity acceptance stopped before routing: after pcb.outline.set,
pcb.documents.list was incorrectly classified as a stale PCB engine read.
discoverDocs then swallowed that error and reported the active PCB as absent.
The earlier 19.685 mil component-box observation was not a completed gate
finding and must not be treated as the final assembly verdict.

The recovery fix keeps document inventory available without clearing stale
geometry protection. Discovery propagates enumeration failures. Reload verifies
project/document/type identity and a real engine readback before reporting
reloadCompleted=true and fresh=true. Identity and PCB enumeration remained
consistent on the real Host; genuinely stale geometry still fails closed.
This is verified reload freshness, not a database revision or strict transaction
guarantee across GUI changes, timeout and late execution.

The existing workflow.advance then ran successfully: score 88 >= 60, crossings
3 <= 8, short/overlap/off-board/tight = 0. Hand-solder remained at 40 mil gap
and 60 mil iron access. All placement tiers, layout and outline were formally
confirmed; pre_route_passed=true and routeAllowed=true before the batch.
No placement, outline or threshold changes were made during closure/write.

The original explicit FP_IN1-4 / FP_OUT1-4 plan was revalidated against a fresh
snapshot, not an old revision or receipt. The first real batch completed:

- Preflight PASS, zero conflicts; revision mtsvzyg5-hsunjr3lx9v:293.
- One batch, 19 traces + 2 vias, 21/21 operations applied, no deletions.
- Apply revision changed to mtsvzyg5-hsunjr3lx9v:295; 204 ms, 95 native API
  calls, retry_count=0, warnings=[].
- Independent compact readback matched all 21 IDs and explicit geometry;
  existing compact primitives were unchanged, unexpected changes=0.
- Formal save/reload completed with fresh=true; one native DRC returned
  passed=true, violations=[]. No connectivity/DRC delta was supplied by the
  existing contract; this is not a claim of an independently computed delta.
- Four core Fast Path MCP round trips: snapshot, preflight, apply, snapshot.
  Workflow confirmation, reload and DRC are additional calls. No disposable
  manual routing JS or checker files were generated.

No bypass, forced acceptance, further routing, plane rebuild or repair loop was
used. Runtime evidence under .easyeda/first-batch and compiled binaries under
bin remain ignored. The captured Pad identity fixture under internal/fastpath/
testdata is retained because the Go and Connector regression tests consume it.

Backlog intentionally unchanged: Project lifecycle, first schematic container,
import_changes limitations for API-added parts (existing add-component alternative),
intermittent schematic modify/wire errors, and the fixed-script close-tab dependency.
No new routing algorithm, automatic placement, DRC engine or next-phase capability
is introduced by this convergence pass.
