# Round 3 qualification boundaries and product impact

## Seven unsupported actions

The seven dispositions remain unchanged. `V2_NATIVE` is not a qualification certificate; a candidate replacement below is not called QUALIFIED without evidence.

| Action | Required for main product? | Formal alternative | Product disposition |
|---|---|---|---|
| debug.exec_js | No; unconstrained scripts are not a required typed EDA workflow | Existing bounded typed actions; no arbitrary-code equivalent is intended | Keep unsupported. Scope, spawned async effects and postcondition cannot be bounded. |
| pcb.beautify | No; aesthetic postprocessing is optional | Explicit layout/route operations; not an exact beautification equivalent and not fully Host-qualified | Keep unsupported. No independent blocker for building a new board. |
| pcb.import_autoroute | No; external-router import is optional | route.preflight/apply_batch and primitive routing are formal native paths; full Host routing qualification is incomplete | Keep unsupported. Do not claim an already-qualified SES importer. |
| pcb.clear_routing | Destructive all/selection clear is not required for a new board | pcb.route.delete/rip_up provide explicit scoped deletion, offline verified; Host qualification incomplete | Keep unsupported. Implicit connection selection and outline collateral scope remain unsafe. |
| pcb.import_changes | **Yes for the promised schematic→PCB/ECO synchronization workflow** | board.new_pcb creates/binds an empty PCB, not component/net synchronization. add_component permits exact-source placement but is not a complete ECO/mapping replacement | **Product blocker.** No formally qualified whole schematic/ECO mapping and native late-materialization completion path exists. Counts or dialog ACK do not resolve it. |
| schematic.rebind.symbol | Needed when the workflow requires rebinding an existing system/shared-library source | component.replace + owned library/device creation are candidate explicit-source workflows, not an already-qualified equivalent to every rebind branch | Keep unsupported. Existing-source rebinding capability remains a declared gap; no claim that source identity alone changes an association. |
| schematic.rebind.footprint | Needed for changing existing footprint association in that workflow | Explicit source/device + component.replace can express a subset; save/reload association qualification is missing | Keep unsupported. Association-change workflow remains a declared gap until qualified; no name-based clone/dialog fallback. |

The current PCB smoke used an empty schematic and explicit PCB placement. It **does not establish** Project→Schematic→PCB/ECO E2E. No unsupported action was bypassed with debug, UI repair or native scripting.

## Manufacturing and current ownership blocker

Operation `ffa19787-8523-4362-ac06-89c570c523be` delivered three real files, and native calls settled. The Gerber archive has five recognizable layer files and no drill programs. No independent exhaustive hole inventory accompanies the export. BOM/PnP structure passed; manufacturing content did not.

Same-operation fresh reconcile reports `UNKNOWN`, `native_settled=true`, `reconciled=true`. The daemon only releases non-UNKNOWN resolved operations; this receipt cannot resolve with the installed verifier/available content evidence. The original owner remains held. No Connector/daemon reload, second export, receipt rewrite, synthetic drill file or manual release was used to proceed. Current parser correction changes missing hole counters from zero to null, but does not manufacture evidence or weaken the finalizer.

This is a real block on further Host effects and on installing the batch to continue qualification. Offline work is independent. Producing a package is not permission to discard ownership. A lost or unverifiable receipt requires explicit trustworthy recovery under the frozen architecture; the current implementation has not qualified such a recovery for this operation.

## Receipt / restart

- During one daemon lifetime: retained same ID/digest waits/returns the same record; conflict refuses; no eviction or replay. Capacity is 2,048 and exhaustion fails closed.
- Connector FIFO/slots remain owned across transport reconnect. Lost release can be resent only by the daemon for a resolved receipt.
- New daemon instances now default to an effect startup fence. Read-only diagnostic access remains possible. An old request ID is not silently made safe by starting a new process.
- `--v2-host-startup-confirmed` is an explicit per-start operator assertion, not automatic reconstruction of old receipts or checkpoint proof. No WAL/power-loss exactly-once guarantee is introduced.
- Full Host restart plus fresh binding is a documented operator-assisted recovery boundary, not proof an old mutation succeeded. The current manufacturing owner was **not** cleared with that route.
- Automated checkpoint save→reload→rebind→key readback→resume is not implemented/qualified end to end. Legacy reload routes call closed legacy dispatch; they cannot be used as a V2 shortcut. This remains a final qualification blocker.

## Stage / efficiency convergence

`internal/app/v2_read.go` now serves core stage/check/layout/rules consumers with one exact target binding per CLI command and native V2 reads. It accepts only the unchanged daemon SUCCEEDED receipt, rejects effects, never retries or navigates, and distinguishes PCB document names from schematic page names. Duplicate names and drift fail closed. Non-current documents must first be explicitly opened through V2. No test fixture adapter is linked into production.

This fixes the live Fast preflight/apply stage preparation gap offline. The old optional stage snapshot/artifact helper and other legacy CLI commands are not silently claimed migrated. The actual Fast apply remains NOT_RUN because admission refused before effect.

Track lock now reads selected IDs instead of full-board readback per item: two full scans plus selected reads, covered by the 64-item regression. Wire union normalization and scoped immutable snapshots avoid redundant result interpretation. Compact receipts and retained evidence are unchanged. No new performance architecture or polling loop was introduced.

## Semantic differential evidence limits

All 151 catalog names, baseline handler direct keys, current input keys and formal output declarations are recorded mechanically. No direct baseline key is omitted. Optional helper→required-schema flags were examined: pour net is already required by the real baseline handler despite stale optional documentation; view.side rejects absence in baseline behavior. Frozen V2 identity/strict invalid-input/operation-envelope changes remain deliberate.

53 fake-Host differential scenarios execute immutable a583bf7 handler source: 52 in v2-baseline-equivalence plus the new symbol-build native-arguments/defaults/business-output comparison. This is independent business evidence, not a complete dynamic proof for every branch of 151 actions. The matrix's bounded PRESERVED assessment means no outstanding detected business regression in that inspected scope. It must **not** be read as exhaustive semantic qualification or proof that accidental regressions cannot remain.

Known corrected regressions: wire `line` output, native reversal/segment pairs/merged collinear coverage, phantom-diagonal disconnect/cascade scope, immutable group-move expectations, board getter fallback/undefined create compensation, missing-native read shape accepted as empty, report incomplete sections, and pour creation inferred from a matching name instead of returned identity. Strict malformed-input/readback refusal and corrected phantom-diagonal behavior are intentional fail-closed changes, not lost supported aliases.
