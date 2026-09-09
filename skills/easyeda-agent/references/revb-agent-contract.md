# RevB Agent contract

This contract governs engineering intent and call cadence. It does not grant new
Host capabilities, override workflow gates, or declare the closure pass accepted.

## Engineering responsibility

The Agent explicitly chooses topology, placement intent, route path/corridor,
layers, via locations, matching groups, targets, tuning corridor and trade-offs.
Helpers may measure or expand these parameters deterministically. They must reject
unsupported input rather than change the path, layer, topology or corridor.
No autorouting, autoplace, force, hidden planner or gate bypass is permitted.

## Routing and verification cadence

Plan 8–16 related logical nets by default. Use a fresh compact snapshot, one
preflight, one batch apply and authoritative compact readback. These are four
core round trips; measurement, plane refresh and DRC are additional operations
and must be counted separately. Small residual batches need an explicit reason.
Never make per-net whole-board DRC the default.

Normal batch: preflight → apply → authoritative readback.
Stage boundary or explicit risk: native DRC → baseline comparison. Count actual
native DRC executions, including those hidden inside composites; a compact delta
does not imply an incremental native solve. Unknown comparison is not a clean bill.

After any geometry or plane refresh, discard the old preflight receipt. On a
timeout, partial or uncertain result, stop dependent writes and reconcile IDs and
geometry. A timeout is not cancellation. Never blindly resubmit a create or issue
a fresh transaction ID to conceal an uncertain prior transaction.

## High-speed sequence and freeze

Reviewed stackup/profile freeze → reference/path topology → coarse routing →
measurement → timing/engineering decision → necessary tuning.
Unequal lengths alone do not justify adding serpentine geometry. A copper length
sum is not an endpoint signal path. Branch/stub ambiguity requires explicit path
selection or remains unresolved. An unverified estimate is not manufacturer data.

Freeze completed groups such as DDR_DATA, DDR_CA, FIFO_DATA, USB_SS, DIN and
CONTROL. Record the verified revision and reason for any reopening. A policy
freeze supplements native workflow state; it cannot manufacture confirmation.

## Compact state capsule

Maintain one small capsule using existing artifacts or session state:

- Project UUID, document UUID/type and current authoritative board revision.
- Current stage and formally observed workflow confirmations.
- Profile IDs, physical-stackup/rule hashes and verification states.
- Logical plane handles; resolve current native IDs through the tool.
- Frozen nets/groups and explicit reopening reasons.
- Pending batch, plan hash, base revision and client transaction ID.
- Last trusted verification, last DRC ID and known exceptions.
- CLI, daemon, Connector, MCP and Host/API versions.

After compaction, restart, reload or reconnection, verify identity and freshness
before using the capsule. It is an index into evidence, never authoritative PCB
state. Do not cache full-board source in the capsule or silently use an old read
when authoritative readback fails.

## Documentation and efficiency

Cache a verified API signature for the session and Host/API version. Re-query on
version change, signature error or explicit ambiguity. Reuse reviewed profile
inputs instead of repeatedly entering the same stackup into a browser calculator.

Record operation duration, response bytes, native calls, retry count and core vs
additional round trips where supported. Missing telemetry stays unavailable, not
zero. Disposable manual routing JS and disposable checker Python must remain zero.
Use formal tooling for deterministic geometry and comparison; report a missing
capability rather than building an ad-hoc replacement during RevB.

## Feature freeze

Only the closure acceptance matrix can release RevB. All required lifecycle,
geometry, profile, measurement, tuning, pair, plane, DRC and export Host fixtures
must pass, with unknown geometry still fail closed and Fast Path guards intact.
After release, accept correctness blockers; defer unrelated feature expansion.
