# Schematic source identity / replace acceptance (1.4.14)

Host: EasyEDA 3.2.186. No STM32 restart, no commit/push. Test CLI remains under `.easyeda/tmp-builds/`; the formal `bin/easyeda.exe` is not replaced by this acceptance build.

## Identity result

Library search returned a generic device; C-number lookup returned a distinct manufacturer device sharing its footprint. A C-number/footprint therefore cannot substitute for the original device UUID. Exact native component name, complete candidates, native footprint origin and Device.get associations now reconcile legacy generic parts. Known different names are negative evidence; missing/ambiguous evidence remains unresolved.

New placements store a small source receipt using official `sys_Storage.setExtensionUserConfig`, keyed by project/page/primitive. Each use verifies instance component/symbol/footprint/subpart references and current library associations. This is extension-user persistence, not embedded project portability: clearing extension settings/moving machines may lose receipts. No UUID is inferred from a 16-character instance ID. EDA 3.2 custom attribute attempts were read back empty and rejected; they are not used as source authority.

Connector identity reads mark their resolver. CLI does not add legacy debug queries to these results. Two existing document-reload close operations still use their existing debug bridge; lifecycle was not modified.

## Host results

Dedicated existing project `f3e517dd8aed4782b6721e81456e5f63`, page `b0293a61b6584c87`:

- Exact C-number resistor R903, generic connector J901, IC U901 and capacitor C901: place → save → reload → source identity → replace → save → reload all returned the exact original/new library identity.
- Same replacement transaction: duplicate result, no second native create.
- Invalid target: rejected before mutation; existing R903 retained and readable after reload.
- Post-delete recovery is covered by injected offline tests, **not** claimed as a real Host fault-injection pass.
- Diagnostic R901/R902 from the earlier failed persistence attempts remain identified; their partial results were not replayed.

Original STM32 project `78d062716ad740c2987701f55aadba5f`, page `ea75115e80bfbd7e`: all 14 parts retain original primitive IDs. J2 reads the exact search source `c79bcedae99b486dac4b7e80e526d811`; J4/J5 also resolve. No circuit editing or PCB mutation occurred in this project.

## New blocker / stop

Replacement R903 target library `209453f1b0764552b318805e2b7a5c99` contains `Value=10kΩ`. Replace returns `status=complete, verified=true`, but the instance has `name=={Value}` and `otherProperty.Value=""`; save/reload preserves the blank. C901 replacement also has blank Value.

This is a separate replacement attribute/result-contract blocker. Per the requested stop rule it was recorded, not patched or manually backfilled. Integration Run 0 cannot proceed to PCB/manufacturing, and FEATURE FREEZE is not asserted.

Raw runtime evidence is ignored under `.easyeda/runtime/identity-*.json` and `.easyeda/runtime/identity-*.log`.

## Follow-up closure — 1.4.15

The separate Value blocker above is now CLOSED. Real Host Connector 1.4.15 returned complete/verified=true with Value=10kΩ; independent immediate and save/reload readback matched. See schematic-replace-value-acceptance.md for final scope and evidence. The historical failure above is retained as the pre-fix record.
