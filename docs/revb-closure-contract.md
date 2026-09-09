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
| `route.tuning_plan` | `pcb tuning-plan --payload` | selected straight span, fixed axis-aligned corridor, added length, pitch, spacing, amplitude and side; returns plan and operations |
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
