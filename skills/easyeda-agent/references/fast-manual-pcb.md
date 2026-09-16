# Fast Manual PCB Path V0.1

范围冻结：telemetry、board_revision、board.snapshot_compact、route.preflight/apply_batch、placement.preflight/apply_batch、pcb.add_components_batch。没有路径搜索、自动避障/改线、自动 layer/via/width、自动布局、autorouter、Push&Shove、原生 whole-board DRC 调用或铺铜刷新。

## Agent 调用

| Typed action | CLI | MCP |
|---|---|---|
| `board.snapshot_compact` | `easyeda pcb snapshot-compact --payload '{…}'` | `easyeda_board_snapshot_compact` |
| `route.preflight` | `easyeda pcb route-preflight --payload '{…}'` | `easyeda_route_preflight` |
| `route.apply_batch` | `easyeda pcb route-apply-batch --payload '{…}'` | `easyeda_route_apply_batch` |
| `placement.preflight` | `easyeda pcb placement-preflight --payload '{…}'` | `easyeda_placement_preflight` |
| `placement.apply_batch` | `easyeda pcb placement-apply-batch --payload '{…}'` | `easyeda_placement_apply_batch` |
| `pcb.add_components_batch` | `easyeda action pcb.add_components_batch --input '{…}'` | `easyeda_pcb` |

CLI 使用 `--project <name/uuid> --doc <active PCB uuid>`。Fast Path 的 doc 必须是 **UUID**，不自动开页、不按名称查找、不切换文档；Connector 在执行时核对 project/document/tab。使用现有高层 Fast CLI 或 `easyeda_pcb` MCP domain 工具，CLI 内部创建 V2 请求并绑定精确目标；无需手工组装执行 envelope。专用 CLI 默认预算 60s，可用 `--timeout` 修改。

所有坐标、宽度和 clearance 单位为 **mil**；points 是 `[x,y]`。省略 bbox 表示不按范围过滤；提供时必须恰为四个 number：`[minX,minY,maxX,maxY]`，`[]` 非法。AI 决定完整 geometry、placement pose 和工程约束。工具只能执行或拒绝，不修复路线或位置。

真正 `EffectScope=NONE` 的 Fast read 不打开页面、不切 tab。目标 PCB 未激活时先串行调用正式 `document.open`，确认新 target binding 后再读；不要并发提交 navigation/context action 与 exact-target read。

## Explicit Manual Placement

`placement.preflight` 接收 snapshot 的 `base_revision` 和 1..256 个完整 `{primitiveId,x,y,rotation,layer,locked?}` pose，检查 ID/锁、板框、已知 component keepout、既有与候选间 bbox overlap；它不写 Host，也不调整任何值。只有 `ok:true` 时，才把完全相同的 placements 与 `plan_hash` 交给 `placement.apply_batch`。public CLI/MCP 内部绑定 transaction identity；Agent 不构造 V2 envelope。

apply 在一个 Connector action 中按给定顺序写入，fresh readback 对每个 x/y/rotation/layer/lock 做 exact verification，并确认未涉及 component identity 不变。stale 在 effect 前拒绝；partial/uncertain 不 replay。

## Exact component materialization batch

`pcb.add_components_batch` 独立于 placement batch。每项必须给出 exact `libraryUuid/uuid`、`designator`、`uniqueId`、可选 exact `channelId`、`nets`（padNumber→net）以及 x/y/layer/rotation。它不调用 `pcb.import_changes`、不猜 Channel ID、不自动布局。重复 designator/uniqueId 在 effect 前拒绝；结果逐项返回 applied/failed/skipped 与 unmatchedPads，并 fresh verify schematic↔PCB identity 和 pad nets。partial/uncertain 不 replay。

一次正常流程：

1. `board.snapshot_compact`：`nets[]`、`bbox`、`layers[]` 和 `include:{components,pads,traces,vias,fills}` 可选。空过滤表示更大范围；未提供 include 返回五组，提供后只返回 true 的组。返回稳定排序的紧凑数组、scope、geometry_hash、board_revision、可识别的 rule_profile 和 telemetry。
2. `route.preflight`：提交下面的显式计划。保存返回的 `plan_hash`；只有 `ok:true` 才授权下一步。
3. `route.apply_batch`：提交相同 base_revision/plan_hash 和下述规范化 operations。public CLI/MCP 内部绑定唯一 transaction identity；一个 Connector action 顺序执行所有 primitive。
4. 需要独立观察时再调用局部 snapshot_compact；apply 自带创建几何/删除 ID 的批量回读验证，不需要逐段回读。

示例 preflight（此例仅展示数据格式，路径由调用方提供）：

```json
{
  "base_revision": "<snapshot token>",
  "routes": [{"net":"N1","layer":1,"width":6,"points":[[0,0],[100,0]]}],
  "vias": [{"net":"N1","x":100,"y":0,"diameter":24,"hole":12,"from_layer":1,"to_layer":2}],
  "delete_ids": [],
  "protected_nets": [],
  "clearance_profile": {"clearance":6,"min_width":5,"min_hole":12,"min_diameter":24,"min_annulus":6}
}
```

对应 apply（加上 base_revision、plan_hash；public path 内部绑定 transaction identity）：

```json
{
  "operations": [
    {"type":"add_trace","net":"N1","layer":1,"width":6,"points":[[0,0],[100,0]]},
    {"type":"add_via","net":"N1","x":100,"y":0,"diameter":24,"hole":12,"from_layer":1,"to_layer":2}
  ]
}
```

**规范化顺序**：先按 delete_ids 顺序产生 `delete_trace/delete_via`（只带 id），再按 routes/points 顺序逐段产生 add_trace，最后按 vias 顺序产生 add_via。apply 必须与此顺序完全一致。每批 1–512 operations。apply_batch 拒绝 `dryRun:true`，预演只用 route.preflight。所有 add_via 坐标必须显式提供，包括 0；首版仅允许 `1→2` 或 `2→1` 贯穿孔，原生 create 不支持表达的盲埋孔会拒绝。

## 检查和数据边界

Go 完成 net/layer/bbox 过滤、紧凑序列化、SHA-256 geometry/plan hash、segment/capsule 与保守焊盘/填充 AABB 距离计算；检测 trace/pad、trace/trace、via/pad、via/trace、via/via、candidate/candidate、层有效性、宽度/孔径/环宽及 protected/locked 删除。返回至多 128 条 conflict，并明确标记截断；任何 conflict 都不能 PASS。candidate_index 指 **规范化 operations 的零基索引**；候选互撞的 obstacle_id 为 `candidate:<index>`。

同网端点接触只提供几何提示，不证明整个 net 已连接、铺铜热焊盘已连接或电气正确。焊盘/填充采用包围盒，可能保守误拒绝。复杂焊盘、arc/polyline、pour/region 等无法证明的铜层障碍会标记 unsupported；对应层的 preflight fail closed。首版不把未知铜几何静默忽略，也不尝试修线。板边、电气/net class/差分等完整 DRC 不在本接口证明范围内。

默认 profile 沿用 pcb_rules.go 的已知 live rule 路径，使用 spacing matrix 最大值、track minimum、默认 via drill/diameter 及其 annulus（保守投影）。不是完整 rule engine，也不推断 net class。路径不完整时必须提供 reviewed clearance_profile；显式 profile 是调用方选择的检查约束，不代表已经证明全部原生规则合规。

Connector 批量读取 Component/Pad/Line/Arc/Via/Fill/Pour/Region/Polyline/Layer/rule。独立焊盘 getAll 不保证包含器件焊盘，因此用元件已返回的 getState_Pads ID 表按 **不同网络**调用 getAllPrimitivesByNet 补齐，核对每个 pad ID。没有 getAllPinsByPrimitiveId/getAllPins 逐元件调用。若宿主 API 不支持完整批量器件焊盘，缺失项成为 unsupported，preflight 拒绝。此 API 行为尚须专用真实工程 smoke 验证。

不读取 full document source，不生成 screenshot/artifact，不把原始规则或 revision 内部形状数据返回 MCP。为了有意义的跨局部范围 revision，Connector 仍需枚举全板的上述几何；Go 的过滤降低客户端上下文体积，**不宣称局部原生查询复杂度**。原生读取成本还包括按不同 pad net 补齐。

## revision、queue 和恢复

board_revision 是 **Connector activation + document/tab identity + 观察到的几何/规则 + 保守 epoch** 的不透明 token。稳定连续读取不变；观测到 GUI 几何变化、legacy action、reload/session 变化及已开始的 mutation 使其失效。apply 在队首重新观察并检查 base_revision，再开始 mutation。Go 使用现有 workflow.HashJSON/HashLayout 算法和已确认的布局/板框指纹；原有 routing gate 在 daemon 再次执行。预检 receipt 还绑定目标文档、项目、revision、profile、protected nets 和精确 operations。

它能检测所观察状态的变化，不能证明 EasyEDA native 索引已经刷新、GUI 与异步 eda.* 之间原子隔离、超时取消、跨重启 exactly-once 或 ACID。多次 native getAll 不是宿主事务快照。GUI 编辑只在原生读取已暴露变化时可检测；未暴露或在最后检查之后发生的变化仍可能竞态。

Fast Path 使用原有 ActionQueue，不绕过 FIFO；daemon 仍保留 queue block/probe、audit、write health、routing gate、stage invalidation 和 autosave。批量 payload 带由 daemon 设置的绝对开始/继续执行截止时间：排队过期不开始；原生调用晚返回后不继续下一条操作。原生 promise 不被取消；未 settle 的 batch 或 legacy handler 会拒绝新的 Fast Path 观察/执行。即使队列已 abandon，该旧 handler 的占用也持续到 settle。

Fast geometry reads 是 **带 stale advisory 的窄例外**，不清除现有 stale flag，不宣称 plane/DRC 新鲜。原生 DRC/旧读取依然按原有规则要求 reload。异常后不能用反复 preflight 或换 transaction id 盲写。

apply result：

- `complete`：全部操作返回且已观察到创建的 exact geometry、删除 IDs 缺席。仍非电气/持久化/ACID 证明。
- `stale`：开始 mutation 前 revision 不匹配，未写入。
- `partial`：已知边界失败，停止后续操作；可能有已确认的部分效果或完全补偿。
- `uncertain`：原生异常/timeout/late execution/回读不匹配或回执缺失，不能当成功。

结果带 created_ids、deleted_ids、每项 applied/failed/skipped 状态、failed_index、revision_before/after、readback_verified、rollback_attempted/complete、warnings；created_ids 是本批 **曾创建并获知的 IDs**，即使已被补偿删除也保留。回执缺失时空 ID 列表表示未知，绝不表示零效果。无法观察后态时 revision_after 为 null。

失败后尽力删除本批已创建图元；**不恢复已删除的旧图元**。未知 create 效果或删除已发生时不声称完整 rollback。deadline/identity 已不可靠时不再继续补偿写入。uncertain 不触发成功 autosave；已知部分效果/complete 复用现有 debounced autosave。保存不是本接口的原子提交。

client_transaction_id 由正式 public executor 生成并与 operation identity 绑定，Agent 不手填。同一 Connector session 内相同 ID+相同请求不重执行；进行中返回 uncertain，已完成返回缓存结果（标记 duplicate，缓存回执不是新的回读）。相同 ID 不同请求拒绝。Connector ledger 与 daemon receipt 各有 2048 条上限，不静默淘汰防重证据；达到上限拒绝新请求。daemon 重启丢失 receipt 会拒绝旧计划；Connector reload 改变 session revision。没有持久化 exactly-once。

## telemetry 与构建

result.telemetry 统一包含 operation_id/name、duration_ms、board_revision_before/after、request_bytes、response_bytes、native_api_call_count、affected_nets_count、retry_count、error_code，并随现有 audit result 落盘。

- duration_ms：daemon operation 到生成结果，包含 Connector 排队/执行，不含 MCP 启动/CLI health 探测。
- request_bytes：绑定项目/文档后的紧凑 payload JSON；response_bytes：包含 telemetry 自身的紧凑 result JSON，不含 HTTP/WS framing。
- native_api_call_count：Connector 计数的 native 方法调用（同步 state getter 投影不计）；没收到计数时为 null，不能当 0。
- retry_count：新 Fast Path 不自动重发，恒为 0；duplicate 回执标记独立存在。

CLI/daemon/Connector/Skill 正式版本保持 2.0.0，运行 build identity 另行核对；Fast Path 必需 capability 为 `pcb.fast_manual.v0.1`。CLI/daemon/Connector 应来自同次构建，MCP 只为实际 CLI catalog 中存在的 Fast actions 注册专用工具。

离线验证：

```text
go test ./internal/fastpath ./internal/daemon
go test ./internal/app -run Fast
npm --prefix extension ci --ignore-scripts
npm --prefix extension run typecheck
npm --prefix extension test
EASYEDA_BIN=<built CLI> npm --prefix mcp test
go test ./internal/daemon -run TestFastPathFixture -v
go test ./internal/daemon -run '^$' -bench BenchmarkFastPathPreflight -benchmem
```

`npm --prefix extension run build` 使用现有 esbuild/zip 打包并保持正式 extension version 2.0.0。此命令不安装。本轮离线修复不得扩大为整板 E2E。
