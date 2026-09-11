# Round 3 read-shape convergence

Status: offline convergence in progress, not final qualification.

A generic undefined-native probe found list/report helpers converting unavailable observations into empty success. Ten list actions now reject undefined/null/non-array and malformed records while retaining valid empty arrays. pcb.drc.rules rejects undefined per the SDK's explicit failure contract. pcb.report preserves its partial data/error fields and uses explicit section-completeness facts; unavailable sections cannot authorize satisfied verification. Per-net unavailable length remains null, preserving the baseline best-effort measurement semantics.

The ten list actions are schematic.text.list, schematic.library.search, schematic.library.get_by_lcsc, pcb.documents.list, pcb.silk.list, pcb.line.list, pcb.via.list, pcb.pour.list, pcb.region.list, pcb.fill.list. Aliases, defaults, sorting and valid output fields are unchanged. Historical malformed-as-empty behavior is intentionally removed under the frozen fail-closed read requirement.

board.current and pcb.board.info are not classified from that blanket probe: SDK getCurrentBoardInfo explicitly permits no associated board. Their linked:false representation must not be confused with an unavailable primitive list. Their complete Host lifecycle qualification is still required.

Targeted suite: 130 PASS, comprising 78 read-shape/drift cases and 52 immutable a583bf7 business-equivalence cases (including ten additional valid-empty lists). Full regression is run after convergence. This is not a claim that 151 actions have full behavioral equivalence proof.
