# Round 3 wire geometry qualification batch

Status: implementation and offline batch qualification complete; Host retest blocked by retained manufacturing ownership. This is not a Host PASS claim. No Connector install is required for each individual fix. The installation artifact is produced only after the batch's regression boundary.

## Evidence and scope

The two isolated Host attempts in [Host evidence](ROUND3_HOST_EVIDENCE.md) exposed reversed endpoints and unordered native segment arrays. Those are representational changes, not different electrical geometry. The pre-existing group-move and schematic-check helpers already documented segment arrays, but the V2 create verifier did not reuse that fact.

| Consumer | Batch disposition |
|---|---|
| schematic.wire.create | Native-returned identity remains mandatory. Accept exact same-style merge into returned old or new identity only when complete requested-plus-before coverage is read back. Preserve unrelated identities. Restore baseline `line` output. |
| schematic.power.connect_pin | Same scoped addition proof, including a returned existing merged wire; allow requested net assignment only inside merged scope. Calibration/flag/native writes remain owned effects with pre-registered verifier. No second create on timeout. |
| schematic.group.move | Decode native segments before recreating; drop zero-length filler; compare full style/net coverage across owned returned IDs, allowing collinear collapse and segment reorder. Keep original/unrelated identity checks. |
| schematic.component.replace | Unchanged-wire verifier compares canonical geometry instead of byte-order of native line arrays. Net and primitive identity still checked. |
| schematic.pin.disconnect | Decode actual segment scope when selecting markers/other affected pins; stop inventing diagonals. All native vertices considered for pin-coordinate lookup. Fresh verification also checks surviving unrelated wire geometry, not IDs alone. |
| schematic.component.delete cascade | Supply native segments explicitly to the retained pure cascade planner. Preserve its caller polyline input form. Phantom diagonal markers/survivors no longer alter deletion scope. |
| schematic.check / schematic.bridgeCheck / schematic.read / components.list includeWires | Shared collectWireSegments uses the native decoder; malformed geometry is not silently an empty segment list. Existing electrical/check-rule tolerances remain business rules. |
| schematic.page.clear / primitives.delete | These consume primitive identity/absence rather than requested wire geometry. No line-order success inference. |
| library.symbol.build outline | `getState_Line` is a symbol outline, not an electrical wire. Its shape contract is not changed by this batch. |
| retained legacy handlers / test-only a583 oracle | Not wired into V2 dispatch; not reactivated. Oracle source remains immutable. |

## Geometry contract

- Caller flat/nested point inputs remain polylines.
- Native flat even-vertex paths of at least four vertices use the established Host segment-pair convention; explicit nested point notation remains a polyline. Native nested segment rows are also accepted.
- Direction/order do not matter. Collinear interval union is compared, including gaps; a bounding box is not proof.
- Zero-length filler contributes no copper/wire extent. A wholly degenerate requested wire is rejected before effect.
- Coordinate normalization is bounded to 1e-6 mil, the existing group-move zero-length threshold. This is numerical representation tolerance, not pin-discovery tolerance or a design clearance. Cell boundaries can conservatively reject nearly equal coordinates. Displacements beyond that resolution are not accepted as equality.
- Net/style and identity are separate from geometry. Equal geometry does not authorize arbitrary retargeting, new foreign IDs, or deletion of unrelated objects.
- No readback/reconcile callback invokes a mutation. The Outcome finalizer is unchanged.

## Intentional behavior corrections

`line` output restoration preserves baseline API. Unordered/merged Host geometry acceptance restores intended existing business capabilities. Excluding phantom diagonals deliberately corrects baseline disconnect/cascade scope errors; it does not remove a supported locator parameter. Malformed native geometry now fails closed instead of being silently skipped. No legacy result adapter was added.

## Offline evidence

- 2048 deterministic native reorder/reverse/split/zero-filler cases, each also checks missing coverage and an extra diagonal.
- Bounded tolerance and malformed/undefined/degenerate shape cases.
- Create merge into old/new ID, verified no-op, unrelated loss, extra/missing coverage, foreign ID; duplicate/reconcile writes stay at one.
- connect_pin merged ID plus timeout/late settle/no replay.
- group move collinear collapse, zero filler and fixed-effect counts.
- disconnect/cascade actual Host segment fixture ensures phantom diagonal flag survives and real shared-wire survivor prevents cascade.
- Full Connector regression at geometry checkpoint: 709 PASS, 0 FAIL, 0 skipped. Final whole-round regression is still required after subsequent changes.

## Additional convergence evidence

- Added 1024 exact-grid diagonal reversal/split cases. Line identity now uses integer-grid direction/intercept, avoiding floating slope roundoff. The existing 1e-6 coordinate resolution is unchanged.
- Saved actual request/evidence/UNKNOWN receipt fixtures under extension/src/fixtures/round3-wire-host. The tests compare observed geometry; they do not rewrite the historical receipts into success.
- Group move also verifies merges into an eligible touching stationary wire using the actual returned identity and complete before/after coverage; mutable native handles cannot change the frozen expected geometry.
- PCB outline has a separate straight closed-path verifier: winding/start-point changes and collinear subdivisions are accepted; open paths, curves outside the declared straight-outline contract, missing extent, extra extent and unrelated primitive changes do not satisfy it. Six controlled cases include target drift and late settlement without replay. Actual Host polygon-source qualification is still required.
- One geometry batch package was produced, SHA256 5B537304778DBB8ACD77930BB08AAE5D53BFC675032EF8CD0672F6B56817B5B3. It has NOT been installed. Subsequent read-shape convergence changes are not in that package; no further package or installation request has been issued.
- Current manufacturing owner ffa19787-8523-4362-ac06-89c570c523be remains UNKNOWN after fresh reconcile with native_settled=true and reconciled=true. Neither Connector nor daemon has been reloaded to clear it.

## Final offline batch boundary

The complete native symbol-build boundary has ten cases (including native-argument/default/business-output equivalence against immutable a583bf7). This does not add an installation request. Actual manufacturing files are preserved under internal/manufacture/testdata/round3-host, with hashes and the unmodified UNKNOWN receipt.

The current operation was queried again after the fixture tests: native_settled=true, reconciled=true, UNKNOWN. Installation remains on hold because no daemon-authorized ownership release has occurred.

Final unified package SHA256: 3892EBCB47EDEB0DDCE73E26DA763731AEFEFAF8D6FF75F494F04A2DD368EEE3. It supersedes the earlier uninstalled build and includes geometry/read-shape/pour fixes. Full Connector suite: 815 PASS, 0 FAIL, 0 skipped. No installation/reload has occurred.
