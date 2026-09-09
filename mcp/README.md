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
