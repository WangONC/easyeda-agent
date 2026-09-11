# Execution V2 product boundary

User decision, 2026-09-11: `pcb.import_changes` remains UNSUPPORTED because of **EasyEDA Host API capability limitation**. It is no longer a 2.0 release blocker. Official importChanges does not provide unattended settlement, complete identity mapping, pad-net and removal residual evidence. No legacy dialog driver, ambiguous ACK or guessed success is substituted.

Supported scope:
- Initial Schematic→PCB creation: autonomous through explicit stable source/uniqueId/designator/pad-net placement.
- Subsequent PCB design: autonomous through formal V2 actions.
- Schematic ECO synchronization into an existing PCB: not guaranteed V2-native autonomous due to the Host API limitation.
- A human or Computer Use may perform GUI ECO when necessary. This is **operator/UI-assisted**, not pcb.import_changes V2 qualification. Exact UUID/type/session rebind and fresh semantic readback are required before V2 resumes; old revision/freshness assumptions are invalid after external GUI effects.

This defines product scope, not a claim that pending Host qualification/E2E has passed. Source replacement, wire composites and checkpoint remain release gates.
