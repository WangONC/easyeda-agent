# easyeda-agent MCP

Local stdio MCP adapter over the existing `easyeda` CLI/daemon. It exposes 15
tools: connection health, action discovery, one tool for each of the seven safe
action domains, circuit blocks, three Fast Path tools, document reload, and the guarded workflow state machine. The
arbitrary-JavaScript debug domain is deliberately not exposed.

```bash
npm ci --ignore-scripts
EASYEDA_BIN=/absolute/path/to/easyeda npm test
EASYEDA_BIN=/absolute/path/to/easyeda npm start
```

Codex registration:

```bash
codex mcp add easyeda-agent \
  --env EASYEDA_BIN=/absolute/path/to/easyeda \
  -- node /absolute/path/to/mcp/src/server.mjs
```

The MCP process does not access EasyEDA directly. Mutations still pass through
the Go daemon, connector, workflow gates, audit log, and official `eda.*` API.
Mutating typed actions require both `project` and `doc`; use `easyeda_actions`
before calling a domain tool to inspect its typed payload. Workflow operations
use structured MCP fields instead of accepting arbitrary CLI options.

After registration, restart the MCP client so it discovers the new server. Run
`easyeda_health` first, then use `easyeda_actions` to select the exact typed
action. The Skill's inspect-before-mutate, save, reload, DRC, and workflow-gate
rules continue to apply to MCP calls.

## Essential PCB workflow parity

See [the capability matrix and workflow contract](../docs/essential-mcp-parity.md).
`easyeda_workflow` now supports `set_assembly` and `confirm_tier`, mapped to the
existing Go CLI. `advance` returns compact command results plus authoritative
workflow status; check `routeAllowed`, not just command success. Acceptance
operations require project and doc. No force option is exposed.

`easyeda_document_reload` exposes the existing save/close/reopen recovery command.
Its CLI internals, verified Host recovery and first batch acceptance are documented
in the linked report. Project creation and first schematic-container creation
are not implemented; an existing project/schematic remains the starting point.

## DeepSeek Harness (DSH) 集成

DSH 原生支持 skill 与 MCP client 两种形态，本仓库两者都已具备，接入是配置级
工作：详见 [`docs/dsh-integration.md`](../docs/dsh-integration.md)。要点：skill
软链到 `~/.dsh/skills/` 即被发现；MCP 在 profile 的 `cordis.patch.yml` 加一个
`@deepseek-ai/dsh-mcp-client` 实例（`serverName: easyeda`，指向本目录
`src/server.mjs`）即可，工具以 `mcp__easyeda__easyeda_*` 命名。注意 in-box
插件无需 pnpm 安装（fallback 从 dsh 安装目录解析），profile 里误装旧版会遮蔽
fallback。

## Disable selected actions

Set the MCP server environment, for example:

```json
"env": {
  "EASYEDA_DISABLED_ACTIONS": "pcb.import_autoroute"
}
```

Restart MCP after changing this value. Names are comma-separated, trimmed, exact
full action names; empty entries are ignored and duplicates removed. Unset or
empty means no actions are disabled. No wildcards or regex are supported.
Disabled actions are omitted from CLI/MCP discovery and domain action enums;
direct CLI calls return `CAPABILITY_DISABLED` with `action` and
`source=EASYEDA_DISABLED_ACTIONS`. To restrict shell CLI calls, ensure that the
corresponding `easyeda` process inherits the same variable. This process setting
is not a security boundary for processes that do not inherit it.

### Optional routing telemetry

Use the existing `easyeda_pcb` action `pcb.report` with payload
`{"telemetry":true,"project_uuid":"PROJECT_UUID","document_uuid":"PCB_UUID"}`;
add `"nets":["NET1","NET2"]` for net scope. CLI equivalent:
`easyeda --project PROJECT_UUID --doc PCB_UUID pcb report --payload '{"telemetry":true}'`.
Without `telemetry:true`, the existing report is unchanged. The telemetry response
contains only `result.routingTelemetry`: board scope returns `summary` and
`netLengthDistribution`, never all net rows; explicit nets return `nets[]` only.
An explicit empty nets array returns no rows. Duplicate names are deduplicated;
missing names fail with `UNKNOWN_NET`. Other report measurement options cannot be
combined with telemetry in this first version (explicit error, never ignored).

Lengths are mil: totalCopperLength and net length are the PCB in-plane trace + arc
centerline length, excluding via barrel vertical length, package/internal length,
pad/pour area and unverified propagation delay. `lineCount` counts straight primitives; `traceCount` remains its compatibility alias.
`lineLength` sums their centerline lengths; `arcCount` and `arcLength` count arcs
and sum the existing verified arc lengths. `totalCopperLength = lineLength + arcLength`;
`viaCount` counts via primitives. Each polyline leg is one length-distribution
sample, each arc contributes its existing verified arc length as one sample.
Zero-length legs remain in the distribution but not the orientation histogram.
Distributions include `count,min,median,p90,max`: sorted nearest-rank
`ceil(p*N)` (1-based), with null extrema/percentiles for empty data. Board net
length distribution includes only nets with routed length > 0. Board netCount,
routedNetCount and unroutedNetCount expose all known nets, including zero-length
nets. With no routed nets the distribution count is zero and all percentiles are
null. Unassigned copper contributes to board totals but has no named-net sample.

Orientation is atan2 modulo 180 degrees, with twelve circular bins centered at
0,15,...,165 degrees. Each bin covers [centerDeg-7.5,centerDeg+7.5) modulo 180
and reports centerDeg, count and length. The zero bin combines [172.5,180) and
[0,7.5). Its length totals cover lineLength only. Arcs and zero-length segments are excluded.
`layerUsage` reports native copper layer IDs only; its `traceLength` and
`traceCount` include both straight and arc primitives. Unknown trace geometry or
missing copper-layer metadata prevents a fabricated complete measurement.

The Go implementation uses one bulk `pcb.nets.list` and one
`board.snapshot_compact` (traces/vias only), plus existing document guards.
It does not invoke the native report's per-net length queries. All aggregation
is local; no score, angle rule, route judgement, DRC or PCB mutation is performed.

Area inventory counts are not emitted: this telemetry snapshot requests fills:false.
Its current data contains no fill/polygon/pour inventory; projected pour fragments
are not assumed to be one native primitive each. No extra area read is added.
