# RevB Closure implementation contract

Implementation and Host acceptance are separate. This document does not declare
RevB ready. The original four-call manual routing path and strict uncertain
outcome semantics remain authoritative.

## Existing domain entry points

All coordinates/widths in plans and measurements are mil. The existing
`easyeda_pcb` domain calls Go CLI commands; there is no Node workflow engine.

| Action | CLI | Contract |
|---|---|---|
| `pcb.routing_profile` | `pcb routing-profile --payload` | `operation=context/put/get`, exact project/document; immutable reviewed record, live stackup/rules validity |
| `route.tuning_plan` | `pcb tuning-plan --payload` | selected straight span, fixed corridor, final target length, EasyEDA corner / single-bilateral / W / H; returns plan and operations |
| `route.pair_plan` | `pcb pair-plan --payload` | explicit P/N names, centerline, layer, width/gap; optional explicit endpoint via separation/geometry/layer transition |
| `pcb.plane.refresh` | `pcb plane-refresh --payload` | base revision, exact identity, logical handles; native rebuild and fresh snapshot, per-item outcomes |
| `pcb.drc.compare` | `pcb drc-compare --payload` | explicit `run_native:true`, optional baseline ID; compact comparison and detailed persisted report |
| `pcb.report` | `pcb report --payload` | nets/pairs/groups filters; `geometry:true` enables scoped per-layer/via/explicit ordered path report, reference net and tolerance |
| `pcb.manufacturing.export` | `pcb manufacturing-export --payload` | reviewed export profile with explicit layers and mm units; native Gerber/drill/BOM/PnP and inspected file manifest |

`route.preflight` accepts optional `profile_id`; selected profile must be MANUFACTURER_VERIFIED (or separately accepted HOST_VERIFIED)
and every explicit route must match its layer/width. The dedicated MCP preflight
schema includes this field. Helpers accept an optional reviewed `profile_id`: tuning checks single-ended layer/width, and pair generation checks differential layer/width/gap. They only produce geometry. They do not bypass
preflight, receipt validation, routing gate, or batch execution.

## Geometry and revision coverage

Native linear polygons, bounded circular arcs and nonzero-winding polygon holes
are projected conservatively with an explicit chord error. Native poured geometry
uses the observed Host 3.2.186 internal-unit adapter; unknown Host versions fail
closed. Requested pour boundary is never substituted for actual poured copper.
Negative plane geometry without trustworthy readback remains unsupported.
Documented pour-only region rules are distinct from routing keepouts; unknown or
named FOLLOW_REGION_RULE semantics fail closed. Unknown geometry is not air.

A physical through via covers all copper for obstacle checks. Its caller-selected
signal entry/exit pair may use active inner layers; this is not a blind/buried via.

`board_revision` retains its conservative epoch contract. `observation_hash`
identifies the complete captured content before compact filtering, excluding the
revision epoch and call counter. It helps distinguish a legacy read fence from a
content change. Neither token proves isolation against transient GUI edits or late
native operations. Profile validity uses reviewed manufacturing hashes and observable layer/rule hashes separately.

## Profiles and measurement

Profiles contain manufacturer, stackup identity/hash, board/layer/copper/dielectric
geometry, material, source, units, SE/differential target, reviewed width/gap,
tolerance and optional unit delay. `evidence_basis:manufacturer`,
`source_kind:manufacturer`, nonempty `evidence` and `reviewed:true` establish
MANUFACTURER_VERIFIED when the reviewed inputs match observed rules and copper
inventory. This is a reviewed manufacturer-source record, not a fabricated
impedance calculation or a certificate of the actual board. Unknown material
information remains UNKNOWN; do not invent geometry to complete a review.

Call context first, bind its `rules_hash` and `observed_layers_hash`, then put
reviewed fields. `stackup_hash` is computed deterministically from manufacturer,
stackup identity, units, layer order and manufacturing dimensions/material; a
supplied mismatch is rejected. `profile_hash` additionally binds the whole record,
including signal/reference assignment, width/gap, targets, source and evidence.
IDs remain immutable. Rule/layer changes return STALE with `stale_reason`; old
profiles are refused by preflight/helpers, and report explicitly returns
`profile_usable:false` with no derived delay. Re-review/rebind requires a new ID
and current context; old references never silently acquire a new review.

On EDA 3.2, `host_physical_stackup:UNAVAILABLE` and
`host_limitation:HOST_PHYSICAL_STATE_UNVERIFIABLE` are capability limitations,
not infrastructure failures or reasons to downgrade manufacturer evidence.
API-unreadable GUI physical changes cannot be detected. Physical getters are
documented since EDA 4.2; even a future returned object is OBSERVED_UNACCEPTED
until separate real Host cross-check acceptance. HOST_VERIFIED is reserved.
UNVERIFIED/UNKNOWN/STALE remain unusable for routing-profile validation.

Native copper sums are not endpoint signal paths. Explicit ordered primitive IDs
and endpoints can identify a contiguous single-layer path; unsupported via barrel
or signal-span mapping stays unresolved. No topology is guessed. Delay is an
estimate only when a matching reviewed profile supplies unit delay. Group and pair
copper spread/tolerance are labeled as copper metrics.

## Honest composite outcomes

Plane refresh can enlarge actual native solver scope and cannot establish
connectivity. Handle ambiguity and individual failures remain visible. Recreated
native IDs are resolved anew; old preflight receipts cannot survive revision change.

DRC comparison matches stable rule/type/net/layer/location anchors, never volatile
primitive IDs/globalIndex alone. Unlocated findings or incompatible context return
`comparable:false`. The native DRC still runs whole-board; policy controls cadence.

Manufacturing manifests inspect actual file content and SHA256, recognizing native
UTF-16LE tabular exports as well as UTF-8 CSV. A returned File alone is unverified.
Missing drill files, malformed rows, unknown counts or unstable readback are reported.
Basic structure verification is not a DFM certification or order authorization.

## Lifecycle and authoring

Project create/list/open and schematic container creation use native APIs and UUID
readback. Activation-scoped transaction receipts prevent blind replay; pending or
unconfirmed native completion stays uncertain. A nonexistent target board is
rejected before schematic creation. Native automatic first-sheet creation can be
reused through existing enumeration/open actions. Authoring partial/unverified
results are projected as MCP errors, retaining native evidence.

## Agent policy

The distributable [RevB Agent contract](../skills/easyeda-agent/references/revb-agent-contract.md)
sets batching, stage freeze, measurement-before-tuning, verification cadence,
state capsules and API signature caching. These are policy, not new CAD actions.

## Manufacturing final completeness

The existing export manifest inspects actual ZIP members and CSV files. Drill
members have individual SHA256/category/status and actual round-hit counts.
Only the accepted metric explicit-coordinate Excellon dialect is counted;
routed slots/repeats/ambiguous coordinates stay unresolved. PTH aggregate and
PTH-via subset files are deduplicated by coordinate/diameter within the plating
category. NPTH must contain real hits for this acceptance; empty files alone
cannot establish completeness. This is bounded file validation, not a CAM engine.

## Personal project bootstrap scope

For Personal / Root, `project.create` omits `team_uuid` and `folder_uuid`.
The `teamUuid` returned by `project.current` can be a personal owner UUID; it
must not be inferred as a real team creation destination. Explicit real Team /
Folder arguments retain their native semantics and are never silently rewritten.
On EDA 3.2, unscoped `project.list` can return an empty list despite existing
Personal projects. This is native inventory behavior, not a reason to switch the
create scope. Creation must verify its returned UUID; uncertain outcomes retain
the existing session/transaction no-replay contract.

Personal scope regression (Host 3.2.186, 2026-09-09): create without team/folder
returned verified UUID `1703f663efba4f6f8ce06a10d334adaf`; open/current matched.
First page `678fc21108e769cb` opened, saved and reloaded with the same project/page
identity and `fresh=true`. Initial home-page enumeration was empty; a subsequent
schematic.create returned UUID `f09be4ac64ad38f9` but its immediate detail read
threw a native Symbol error. No create was replayed. Inventory reconciled that
UUID and the Host initial schematic, leaving two containers in this diagnostic
project. This is scope-blocker acceptance with explicit readback recovery, not a
claim that all Host bootstrap timing behavior is fixed. No STM32 circuit was built.

## Bounded first schematic initialization

CLI/MCP `project.create` accepts `{name}` for Personal/Root. Go reads current
project and a fresh session token, generates a transaction ID, and dispatches once;
no owner/team is inferred. Explicit guards/session/transaction and Team/Folder
remain supported. The returned transaction ID and audit identify the write.
`project.open` polls scoped schematic inventory for projects created in this
Connector activation (at most 41 reads, 250 ms apart), reporting
`initial_schematic_state: verified|unknown`; ordinary existing project navigation
remains unchanged (`not_requested`), including projects with multiple schematics. `schematic.create` without
board_name is a first-container ensure: reuse a verified single existing container;
never create while a newly created project's initialization remains unresolved.
For other empty projects creation additionally requires a native empty project tree.
Ambiguous/missing evidence remains uncertain. A returned create UUID whose detail
read fails is reconciled against inventory by exact UUID/project, never recreated.
This is bounded readiness, not cancellation or a guarantee against concurrent GUI
edits. Pending per-project creates are excluded; session/transaction guards remain.

## EasyEDA equal-length tuning (1.4.11)

The formal `route.tuning_plan` payload is:

```json
{"base_revision":"current", "net":"N", "span_id":"selected-trace",
 "corridor":[0,-3,400,83], "target_mode":"specified_length",
 "target_length":600, "corner":"arc_90", "side":"single",
 "spacing_w":40, "min_amplitude_h":20}
```

All dimensions/lengths are mil. `target_length` is final **total planar net
trace+arc centerline length**, not endpoint path length, via barrel, package or
delay. The tool measures the current snapshot, solves the required increase, and
returns `current_length`, `target_length`, `achieved_length`, `added_length`,
`residual`, `length_tolerance`, `turns`, `capacity_added_length`, `actual_amplitude`,
and an explicit plan. It never writes; use preflight → apply → reload/readback →
report to verify the actual result. A nonpositive increase rejects.

GUI mappings follow the installed EasyEDA 3.2 PCB equal-length implementation
and [official settings documentation](https://prodocs.lceda.cn/cn/pcb/route-equal-length-tuning/):

- `corner`: `line_45`, `line_90`, `arc_90` (real quarter-circle Arc primitives).
- `side`: `single` or `bilateral`. A single-sided fixed corridor must admit H on
  exactly one side of the selected span; ambiguity rejects. Bilateral alternates,
  beginning on the left-normal side of the directed span. Reversing span direction
  reverses that initial gesture. This is an explicit convention, not side search.
- `spacing_w`: centerline separation W, not copper-edge clearance. Live clearance
  still constrains independent neighboring legs. `min_amplitude_h`: minimum
  excursion H; actual excursion is solved inside the caller's fixed corridor.
- Native line45 chamfers use trace-width/sqrt(2) offsets. Native arc90 uses
  radius=min(actual excursion,W)/2 internally; radius is not a product parameter.
  Single has full entry/exit caps; bilateral shares straight return legs.
- `target_mode:follow_rule` is reserved but **fails closed with
  RULE_TARGET_UNRESOLVED**: current rule projection does not prove a unique final
  target from range/group rules. It does not pick a minimum, maximum or peer net.
  Use a reviewed `specified_length` until authoritative resolution is supported.

Coverage: axis-aligned replaceable spans, one fixed corridor, no interior branch,
positive finite W/H, at most 512 operations. Small amplitudes below independent
spacing/corner coverage reject. No path/corridor/layer search or push/shove.

EDA 3.2 official Arc.get/getAll rounds endpoints to 0.1mil. The arc90 template
requires baseline endpoints on 0.1mil and W on 0.2mil, quantizes solved excursion
to 0.2mil, and returns its exact residual (declared bound 0.2mil × lobe count).
Straight styles declare 0.001mil × lobe count tolerance (including native four-decimal line persistence). Strict apply matching is unchanged.
The target is never falsely reported as achieved with zero residual.

Old `target_added_length` with `style:rectangular|rounded`, pitch/amplitude and
radius remains a CLI/internal compatibility path. These fields are absent from
formal MCP tuning schema; mixing old/new fields rejects. The old rectangular
geometry corresponds to single-sided line90; the old rounded fillet template is
**not** advertised as native arc90. Existing historical acceptance below records
that compatibility implementation. Arc readback and exact length remain shared.


First-schematic acceptance on Connector 1.4.11 / Host 3.2.186 (2026-09-09):
name-only Personal project `f3e517dd8aed4782b6721e81456e5f63` opened with
`initial_schematic_state:verified`; first-container ensure returned `reused:true`.
Inventory before and after save/reload contained exactly one schematic
`63726f693b304d6f` and one page `b0293a61b6584c87`, with unchanged project identity.
The empty-home Go preparation recognizes only the exact native no-current-project
error corroborated by a home document; other failures remain fail closed.

In that fixture rectangular tuning replaced a 400mil span with 600mil copper,
9/9 operations, 108ms, readback verified. The first pre-lattice rounded attempt
executed 16/16 but correctly returned uncertain because SDK-rounded arc endpoints
differed from its explicit plan. It was not replayed or retroactively marked
complete. Its persisted report measured 599.9998457253859mil; this exposed the
SDK precision constraint above, not permission to loosen verification.


Final same-fixture acceptance after the planning fix: the original uncertain
rounded IDs were reconciled (all 15 present), deleted by exact IDs, and verified
absent; no blind replay occurred. A fresh straight span and current receipt were
used for the revised plan. Rounded: 16/16 operations, 137ms, 84 native calls,
retry=0, complete/readback_verified=true. After save/reload, all 15 created IDs
were present (8 lines + 7 arcs), total copper 599.9734457253857mil, added length
199.97344572538566mil, residual 0.026554274614341mil < 0.1mil declared tolerance.
Rectangular remained 600mil (added 200mil, 8 lines). Final observed revision:
`mtu6n99x-j4wkuea0dyh:217`. Both are isolated geometry-measurement spans; this is
not proof of end-to-end circuit connectivity or whole-board routing completion.
Workflow used its normal hand-solder 40/60mil gate (score100, crossings0), tier /
layout / outline confirmation. No force, stale bypass, debug JS, temporary routing
JS or geometry checker Python was used. Only the dedicated fixture was edited.


GUI line45 Host acceptance also exposed exact JSON equality in trace readback:
`94.97056274847712` became `94.97056274847711` through native unit arithmetic.
Trace matching now accepts only 8×machine-epsilon scale, capped at 1e-9mil;
1e-8mil and larger geometric drift still rejects. Arc readback is unchanged.
The original uncertain result is retained; its 16 IDs were independently read,
then removed by exact ID before a fresh baseline/receipt is used for retesting.
