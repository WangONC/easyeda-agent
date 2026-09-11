# Bounded release repair evidence

This is a continuation from 3d3638f73c449ee1eb38012f8bd119946293cbde, not a new audit round. Product scope is defined in PRODUCT_BOUNDARY.md. Final E2E has not run; no completion claim.

## Actual Host evidence

- group.move 56edff15-2a5c-4c93-8f37-1c57188a6dc3: SUCCEEDED. First fresh inventory omitted the returned ID; bounded read-only refresh proved exact requested geometry. The older PARTIAL receipt remains unchanged.
- connect_pin 82fe853b-6107-4fb2-9d07-a866b69d5ddb: SUCCEEDED. Fresh schematic.read 1fa121ca-af25-440c-8015-4bc141d8b106 confirms R1.2=QUAL_VCC.
- replacement cb8896f6-8ed5-4e7a-86a7-31ab9089dbaa and 4bbb753c-6ce6-4f1c-bcac-3e3dba15ca80: independent fixtures, NOT_APPLIED with verified compensation. The second captures two new zero-length empty-net wire rows during staging. No uncertain mutation was replayed.
- checkpoint 1584f5ba80452b560924baa15c61836a: UNKNOWN after last-editor close/model exception. Operator reopened the exact page; read-only recovery d2089e65-9dbf-4579-bb5d-15ec8f788d5f released ownership. Outcome remains UNKNOWN.
- checkpoint 3f23e502dd74a5e6d115980c668c3f43: UNKNOWN after companion activation; old-tab absence was not proved. Operator returned to the exact page; read-only recovery 6fe28373-920c-4035-9df9-34adc5ae8217 released ownership. No checkpoint PASS.

Evidence JSON is under evidence/checkpoint-batch-20260911/.

## Current correction boundary

Replacement accepts only empty-net zero-coverage added placeholders during the staged phase, preserving every original wire. Final success and compensation still require the complete original wire inventory; persistent/new nonzero residuals are not success. Malformed rows remain unavailable. Tests cover temporary placeholders, persistent placeholders, foreign nonzero wire, malformed observations and no replay through reconcile.

Reload uses the official document UUID input to closeDocument, after exact document/tab validation and a native save ACK. It registers its verifier before effects, observes old-tab absence through bounded reads, opens the same UUID once, and only daemon-authorized release renews session/activation. CLI checkpoint then rejects old session, exact rebinds and compares semantic state. Native ACK alone is not persistence proof. Latest Host rerun pending.

## Validation so far

Go full: 2,866 tests/subtests PASS; build PASS. Connector full before the final placeholder/close correction: 843 PASS. Latest targeted wire/group/replacement/checkpoint: 36 PASS; typecheck/bundle PASS. MCP: 28 PASS + 1 explicit Host opt-in SKIP. Catalog consistency PASS. Full action/property audits were not repeated.

Latest cumulative package SHA256: 4C18ACBA6C11DB574EDC716108F7BDC450F2C91648F84CE5A215715FF8F5559C. Prior package and operation evidence remain distinguishable. No pending ownership was cleared by reload/restart.

## Latest package Host checkpoint: FAIL

Installed SHA256 4C18ACBA6C11DB574EDC716108F7BDC450F2C91648F84CE5A215715FF8F5559C. Operation d9b059db033f02f6b8721f92fbd9afb8 returned UNKNOWN, native_settled=true. closeDocument(exactDocumentUUID) returned true, but five tab-inventory reads over the bounded refresh interval all still contained the original exact tab. The runtime correctly did not reopen or claim persistence. No contract evidence proves that a document reload occurred. This remains a release blocker; further parameter guessing or ACK-only qualification is not justified.

Latest Connector full regression: 846 PASS, 0 FAIL/SKIP. This is offline correctness evidence, not Host checkpoint qualification. Final E2E remains NOT_RUN because the required automatic checkpoint prerequisite failed.

## Final bounded outcome: RELEASE_BLOCKED

Actual source replacement 8f06a0ff-8fdc-4f81-bc99-f542b2e76605 SUCCEEDED on installed package 4C18ACBA...5559C. Source C17513/R0805 became C25804/R0603; designator RQUAL3 and pose (800,400) were retained. Original primitive c354824f13877f14 was absent, new primitive ed2be78e1e576a89 had exact source receipt; final wire inventory matched the original, so temporary zero-length placeholders did not survive. This qualifies this actual source-association replacement case, not all symbol/pin-map branches or persistence after reload.

Checkpoint d9b059db033f02f6b8721f92fbd9afb8 ownership was released via exact read-only recovery 3d314291-040e-489c-bfb3-4616852552a5. Its UNKNOWN Outcome is unchanged. Final save bb67f5fa-a516-4cc0-8887-ff0f442eaf9a SUCCEEDED; final health has no effect owner. No restart cleared state, and no original effect was replayed.

Remaining release blocker: automatic Save→Close/Reload→New Session→Exact Rebind→Semantic Readback→Resume is not Host-qualified. closeDocument ACK=true contradicts continued original tab presence; available evidence cannot prove a real reload. Consequently replacement persistence and the final complete E2E remain NOT_RUN. Do not count manual page switching or session rotation as reload persistence. Existing-board ECO is explicitly outside the autonomous product boundary and is not included as a blocker.

No R4, 151-action re-audit, legacy dispatch, new Outcome, merge, push or tag was introduced. Work remains on codex/execution-v2.
