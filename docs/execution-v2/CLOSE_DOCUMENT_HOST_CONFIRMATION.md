# EasyEDA 3.2.186 closeDocument minimal Host confirmation

## Conclusion

SOURCE FACT: closing the activated exact tab using `closeDocument(tabId)` worked in two controlled executions. This evidence does **not** support `HOST_API_LIMITATION / closeDocument false-success` for this tested calling sequence. Do not replace automatic reload with operator-assisted reload on the basis of the prior failed sequence.

Working sequence: save target; keep another exact-UUID editor alive; officially activate the target tab; fresh-check target UUID/tab; call `closeDocument(fullTabId)` once; perform read-only observations; only after old-tab absence, reopen the same document UUID. No UI hack, Computer Use, legacy path or close retry was used. The second close was the requested continuation through the existing checkpoint command, not a blind replay of the first operation.

INFERENCE LIMIT: this experiment changed both the argument from document UUID to full tab ID and ensured the target was active. It does not isolate which condition caused the previous inactive-document UUID call to retain the tab. It proves the tested sequence, not every Host/version/tab combination. No additional alternative-form experiment was needed.

## Exact target and native call

- Host: 3.2.186; installed Connector package SHA256 `5280D37C90D4FDF1D11E2ED2A62F1688C189DC597302229841DE80A66D3CF6C5`.
- project UUID: `e7c288be345149da97a48a8b908c2049`.
- document UUID/type: `6c1d9afdceb80680` / schematic.
- tab ID and actual close argument: `6c1d9afdceb80680@e7c288be345149da97a48a8b908c2049`.
- split ID: `editor-window-main`.
- session: `8839c7c3-60f7-4a28-94b8-d0146e05e165`.
- activation: `easyeda-agent-b12ac5cb-5f35-4949-9521-7bf47b89e7fa`.
- Operation: `c6717ef5-dfd7-40cf-8b4b-2a0f829ff968`.
- Native started at `2026-09-11T10:30:36.483Z`; native returned JSON boolean `true`; measured native call duration **1 ms** (Date.now wall-clock resolution).
- pre-close current was the exact schematic. Its tab had `isAbleDelete=true`. Raw project info, both document inventories, complete tab tree and split tab list are in the evidence file.

## Read-only observations after native settlement

| Requested timer | Actual read batch completion | Original tab | Schematic in project document list | document.current |
|---|---:|---|---|---|
| 200 ms | 1199 ms | absent | present | `2f56e102faa9634a` (PCB) |
| 1000 ms | 1205 ms | absent | present | `2f56e102faa9634a` (PCB) |
| 2000 ms | 2157 ms | absent | present | `2f56e102faa9634a` (PCB) |
| 5000 ms | 5158 ms | absent | present | `2f56e102faa9634a` (PCB) |

Both split-tab inventory and full tab tree exclude the original tab. This is actual tab closure, not merely a current-document switch. The document UUID remains in the project list because close does not delete the document.

Timing limitation: the Host event loop/API delayed the timer/read batches. In the first run the requested 200 ms observation began around 1.16 s and completed at 1.199 s; the requested 1 s sample completed at 1.205 s. There is **no claim of an exact 200 ms observation**. Actual timestamps, requested offsets and completion offsets are preserved. The 2 s and 5 s observations also confirmed absence. No write occurred between close and completion of the four read batches.

## Checkpoint continuation, kept separate

Second operation `aaac2a988cdde9e2a8e633cc7992a519` also closed and reopened the exact tab: daemon Outcome SUCCEEDED, native close ACK `true`, native duration 0 ms. All four subsequent tab observations again showed absence before reopen. No third close was attempted.

The CLI then renewed session/activation, rejected the old session, exact-rebound and read fresh semantic state, but stopped with `V2_CHECKPOINT_SEMANTIC_MISMATCH`. **Checkpoint/persistence/resume is not PASS.** This is distinct from closeDocument availability; its semantic difference was not investigated or repaired in this narrowly scoped task. No subsequent mutation/resume was performed. Final health had no effect owner.

## Evidence and limited validation

- [First raw daemon/Connector evidence](evidence/close-document-20260911/close-probe-official-tab-evidence.json).
- [Second raw close/checkpoint evidence](evidence/close-document-20260911/close-probe-checkpoint-evidence.json).
- [Checkpoint CLI result](evidence/close-document-20260911/close-probe-checkpoint-result.txt).
- API contract: installed `@jlceda/pro-api-types/index.d.ts` specifies `closeDocument(tabId: string): Promise<boolean>` and explicitly permits page/PCB/panel UUID alternatives. Its documented example passes the tab ID returned by openDocument.
- Targeted checkpoint tests: 9 PASS; extra timing/raw-ACK assertions: 2 PASS; typecheck and production bundle PASS. No whole-repository audit or other blocker work.

The first dispatch was rejected before effect due to stale routing heartbeat. A subsequent proposed dispatch was blocked by automatic approval review because it did not explicitly compare the target-file tab ID. Full session/activation/project/document/type/tab equality plus fresh document.current were checked before the successful dispatch. Neither rejection invoked native close.
