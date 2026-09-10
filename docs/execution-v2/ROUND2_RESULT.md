# EXECUTION V2 ROUND 2 RESULT

Round 1 起点：`f96960c0487ca0aff8c5095220f496a22e5d1398`（建立 Execution V2 基础并迁移首批动作）。本轮在原 `codex/execution-v2` worktree 连续施工；未操作 Host、main、archive、tag 或远端。

## 最终动作分区

151 个正式 ActionSpec：**144 V2_NATIVE / 0 RETIRED / 7 UNSUPPORTED / 0 NOT_MIGRATED / 0 LEGACY_RUNTIME**。Round 1 的 81 个 native 保留，本轮新增 63 个 native，另外 7 个完成终态技术处置。

| Level | Total | V2_NATIVE | UNSUPPORTED | RETIRED | NOT_MIGRATED |
|---|---:|---:|---:|---:|---:|
| 1 | 33 | 33 | 0 | 0 | 0 |
| 2 | 46 | 46 | 0 | 0 | 0 |
| 3 | 47 | 45 | 2 | 0 | 0 |
| 4 | 21 | 18 | 3 | 0 | 0 |
| 5 | 4 | 2 | 2 | 0 | 0 |

权威机械产物：[151-action inventory](migration-inventory.json)、[可读目录](ACTION_MIGRATION.md)、[70-action baseline business audit](round2-business-audit.json)。审计数据不是第二份运行时注册表。

## 本轮原生迁移动作（63）

- `board.new_pcb`（Level 4）
- `board.rebind`（Level 4）
- `board.snapshot_compact`（Level 3）
- `library.footprint.build`（Level 4）
- `library.symbol.build`（Level 4）
- `pcb.add_component`（Level 4）
- `pcb.align`（Level 3）
- `pcb.component.attrs_backfill`（Level 3）
- `pcb.component.delete`（Level 3）
- `pcb.component.lock`（Level 3）
- `pcb.components.arrange`（Level 3）
- `pcb.components.move`（Level 3）
- `pcb.distribute`（Level 3）
- `pcb.drc.compare`（Level 4）
- `pcb.equal_length_group.add_nets`（Level 3）
- `pcb.export.dsn`（Level 3）
- `pcb.fill.delete`（Level 3）
- `pcb.grid_snap`（Level 3）
- `pcb.manufacturing.export`（Level 4）
- `pcb.outline.clear`（Level 3）
- `pcb.outline.set`（Level 4）
- `pcb.page.clear`（Level 4）
- `pcb.plane.refresh`（Level 4）
- `pcb.pour.delete`（Level 3）
- `pcb.pour.rebuild`（Level 3）
- `pcb.region.delete`（Level 3）
- `pcb.route.delete`（Level 3）
- `pcb.route.rip_up`（Level 3）
- `pcb.route.via_hop`（Level 4）
- `pcb.routing_profile`（Level 3）
- `pcb.silk.align`（Level 3）
- `pcb.silk.label_pads`（Level 3）
- `pcb.silk.netnames`（Level 3）
- `pcb.silk.set`（Level 3）
- `pcb.snapshot`（Level 3）
- `pcb.stackup.set`（Level 3）
- `pcb.track.lock`（Level 3）
- `project.create`（Level 4）
- `project.open`（Level 4）
- `route.apply_batch`（Level 5）
- `route.pair_plan`（Level 3）
- `route.preflight`（Level 3）
- `route.tuning_plan`（Level 3）
- `schematic.bridgeCheck`（Level 3）
- `schematic.check`（Level 3）
- `schematic.component.delete`（Level 3）
- `schematic.component.modify`（Level 3）
- `schematic.component.place`（Level 3）
- `schematic.component.replace`（Level 5）
- `schematic.component.resolve_lcsc`（Level 3）
- `schematic.components.list`（Level 3）
- `schematic.create`（Level 4）
- `schematic.drc.check`（Level 3）
- `schematic.export.bom`（Level 3）
- `schematic.export.image`（Level 3）
- `schematic.export.netlist`（Level 3）
- `schematic.group.move`（Level 4）
- `schematic.page.clear`（Level 4）
- `schematic.pin.disconnect`（Level 4）
- `schematic.pin.set_no_connect`（Level 3）
- `schematic.power.connect_pin`（Level 4）
- `schematic.primitives.delete`（Level 3）
- `schematic.read`（Level 3）

## 明确 UNSUPPORTED（7）

- `debug.exec_js`：Arbitrary AsyncFunction receives the full eda object; effect scope, spawned asynchronous work, target ownership and semantic postconditions cannot be bounded by the typed execution contract.
- `pcb.beautify`：Experimental engine rewrites routing with internal DRC retries, rollback and pour rebuild; its native effects and compensation residuals are not bounded by a verifiable public operation contract. Dry-run and mutation share this formal action; it is not advertised as a partially migrated success surface.
- `pcb.clear_routing`：Native alpha clearRouting(net|connection) consumes implicit UI selection without an API that enumerates the exact destructive connection scope; the all branch also includes non-routing outline geometry. No complete target/residual contract for the full published action. Use native pcb.route.rip_up or pcb.route.delete.
- `pcb.import_autoroute`：Opaque SES/JSON import returns only boolean; no complete imported primitive identity/mapping or bounded residual report. Native ratline refresh is a separate effect. A trustworthy parser plus exact requested-versus-native mapping is required before qualification.
- `pcb.import_changes`：The documented Host import promise may settle when its confirmation dialog opens, before delayed component materialization. The dialog has no operation-bound identity and no native settlement/complete schematic-to-PCB mapping receipt. Count stabilization cannot prove completion or release ownership; full import requires Host qualification of a trustworthy lifecycle and mapping contract.
- `schematic.rebind.footprint`：System-library clone path depends on a DOM conflict-dialog observer that cannot bind its clicks or reused name-only clones to an operation and asset identity. Shared-library mutation plus destructive instance recreation cannot be qualified with the published full fallback contract without Host qualification. No partial in-place-only migration.
- `schematic.rebind.symbol`：System-library clone path depends on a DOM conflict-dialog observer that cannot bind its clicks or reused name-only clones to an operation and asset identity. Shared-library mutation plus destructive instance recreation cannot be qualified with the published full fallback contract without Host qualification. No partial in-place-only migration.

这些动作的正式 ActionSpec 保留，catalog 返回终态和原因；MCP 在 dispatch 前明确拒绝。不存在“仅实现安全子分支，却将整个 action 标 native”的处置。

## Foundation / runtime

- 保留 Round 1 Request、稳定 Target、operation ID+digest authority、Host-wide barrier、FIFO、四 Outcome finalizer 和直接 projection。没有新建 compatibility reducer、transaction DAG、WAL 或 legacy bridge。
- Handler registry 的类型收紧为 `Record<string, NativeAction>`，7 个终态动作移除旧 handler 注册；生成目录只含 native 元数据。旧 `/action`、旧 `runAction` 仍拒绝。
- 复合动作是同一 operation 内的固定顺序 native 工作，不经 typed legacy child。`parent_operation_id` 的未支持用法仍显式拒绝；没有伪 child receipt。
- 每个 effect 前必须已有 `prepare()`。`effect()` 等待真实 native promise；超时不会冒充取消。late-settle 后只能验证，后续 mutation admission 拒绝。Connector 不发公开 Outcome，不自行解锁；daemon resolved release 丢失时，status/reconcile 路径可重发原 release，绝不重放 mutation。
- project navigation 仅能在 effect 前声明同 session/activation 的固定目标 project。内容写入不能使用该能力重新绑定目标。
- Finalizer 的 PARTIAL 修正：请求项 0/N 达成，但 native 已 settled、明确发生变化且完整 residual scope 已查清，也可以 PARTIAL。未查清或 pending 仍 UNKNOWN；未引入第五 Outcome。
- Fast 重用 geometry/preflight/revision/`matchesOperation`；不调用旧 Fast `apply` 或读取旧 receipt 来授权成功。daemon 保留 plan receipt 绑定、routing-profile 校验和紧凑业务 telemetry。
- DRC comparison 与制造文件结构解析从 CLI 移到共享纯业务包 `internal/drc`、`internal/manufacture`；CLI 旧业务测试仍使用同一解析器，V2 daemon 在唯一 finalizer 前完成业务处理。没有 Go/TS 第二套 outcome reducer。
- Artifact bytes 由 daemon 校验 operation/digest/target/settlement 后持久化；重复交付校验已有 bytes，不覆盖冲突内容。文件路径不信任 Connector 的输入。制造检查只能从成功持久化路径进入；文件存在不证明制造内容合格。

## Baseline capability audit / regression 修正

以 `a583bf7` ActionSpec 和真实 handler 为业务基线。机械审计覆盖本轮全部 70 个待处理动作，记录旧 handler 名、行号、直接参数、V2 参数、正式 Inputs/Outputs；native 动作直接参数遗漏为 0。它不声称证明嵌套参数、所有分支或全部 Host 行为等价。

`v2-baseline-equivalence.test.ts` 直接编译运行 Git 中不可变 baseline；37 个场景比较两侧业务输出，包括 search/read、layout selection/default/sort、丝印 content/side/default/bbox、PCB placement device 顶层与嵌套 alias、attribute overwrite、board current/name resolution。另有 retained business fixture 直接读取同一 baseline；这类测试验证旧业务参考，不替代 V2 execution 测试。

本轮修正的实现问题：

- 丝印排版沿用原 bbox 避让、参数默认和输出，不用估算 bbox 替代实际 create 后 bbox。set/align 的业务 `ok` 根据 fresh 字段读取投影，不能把计划中的成功标记返回给 Agent。
- PCB add_component 恢复 `padExtent` 几何计算；既有 via 消失也纳入 residual 检查。仅用 native parent identity 认定嵌入 via ownership，不以邻近几何认领其它 via。
- schematic placement 验证显式 subPartName；source receipt 验证 instance binding 与当前真实 library association。
- component.replace 在删除原件前固定最终 designator/uniqueId/属性 postcondition。最终 patch readback 不匹配触发已知范围补偿；超时后的临时 staged identity 不能成功。补偿恢复必须检查位置、镜像/旋转、属性和 source。
- board.rebind 保留已知无新 board 时恢复旧 binding 的补偿；正常 no-op 无 native 写入。board.new_pcb force 路径验证 donor PCB 没被改写。
- via-hop 补偿删除前再次读取 created identity 与实际 geometry，避免对已漂移对象删除。
- plane rebuild 验证返回 region 的 source pour ownership、fill shape，以及非目标 region、component/pad/trace/via/rules 未变化。
- DRC comparison 对 parser 所需 leaf 信息缺失 fail closed，不把无法解析的违规丢成零条 PASS。
- catalog 恢复正式业务 Description / Inputs / Outputs 信息；MCP discovery 不因新 envelope 丢失业务说明。
- 修正 esbuild 发现的 DSN 文件名 `||` / `??` 表达式歧义。

## 有意 breaking changes

1. 延续 Round 1：仅显式 V2 envelope、稳定 target 和 operation identity；旧 payload/result、raw success、旧 Fast 专用入口不恢复。Fast typed actions 通过现有 pcb multiplex 暴露。
2. 7 个 UNSUPPORTED 是完整 action 的显式终态。特别是 import_changes 不再把 dialog ACK 或 count 稳定当作 effect settlement / mapping proof。
3. create 无可信返回 ID、未识别残留、source association 漂移、未证明嵌入 via owner 时 UNKNOWN；不能通过重放 create 修复。该收紧来自冻结 execution safety，而非新索要业务参数。
4. client_transaction_id 与 operation_id 必须一致；同 ID 不同 digest 拒绝。复合动作不保留内部 blind retry。一次 native 未能得到 postcondition 时保留 PARTIAL/UNKNOWN，不模拟旧 raw success。
5. Save ACK 只证明 save command；制造输出区分 artifact delivery、结构检查和 `NOT_CERTIFIED` 内容资格；DRC query execution success 与 design_pass 分离。
6. 返回值可能附加 verification/rollback/source/evidence 诊断。旧 `ok/verified/partial/status` 若仍作为业务字段存在，不能授权 Outcome；公开完成语义只取 daemon receipt。
7. 未拿到可靠 getter 的 optional diagnostic 保留 unknown/null，不能伪造 empty/PASS。名称、alias 和默认解析仍在 effect 前解析成稳定对象，未改成要求调用者自行提交更多业务标识。

## Legacy runtime audit

| 检查 | 结果 |
|---|---|
| V2 自动 fallback legacy | 否 |
| V2 调用 legacy reducer/evidence adapter | 否 |
| V2 parent 调用 legacy typed child | 否；typed parent 用法仍拒绝，复合工作直接受控顺序执行 |
| CLI/MCP 重新判断业务成功 | 否；只投影 daemon Outcome |
| 本轮 Host effect 绕过 coordinator/controlled executor | 未发现；所有新增 native writes/UI/save/recompute 经 effect，reconciler 不含写入 |
| Connector 自行发布公开 Outcome / 解锁 | 否 |
| reconciliation 增加原 mutation 调用次数 | 定向 controllable-promise 测试未发生 |

保留源文件中的旧业务参考函数及离线 fixtures 不代表 legacy runtime 可达；registry、transport、编译类型和隔离测试共同关闭入口。legacy test helper 不导入 production dispatch。

## Tests / regression classification

最终命令和结果见下方验收记录。全离线；显式 `EASYEDA_HOST_READBACK=0`。

- A：旧 MCP integration 断言旧 envelope/workflow surface，改为真实 stdio MCP→V2 CLI catalog/终态拒绝测试。旧 isolation 断言 route.apply_batch / replace 未迁移，更新为本轮终态集合。
- B：生产打包语法歧义、replacement 最终 patch 补偿触发、partial 0/N、残留/ownership 与 output projection 问题已修正并补测，未以“旧测试”忽略。
- 环境：MCP 初次全套缺 SDK 依赖；用现有主 checkout 的 node_modules junction 复用依赖，未修改依赖版本。一次 TS 测试从错误 cwd 启动失败后改为 extension cwd 正常通过。
- Host readback 是显式 opt-in 测试，验收跳过；它不计为 offline PASS。

## Round 3 / final Host qualification

Round 2 没有未迁移动作留给 Round 3。以下是实际 Host/API 资格验证，不能用 fake EDA 的 PASS 冒充真实制板认证：

| Actions | 必须验证的 Host 条件 |
|---|---|
| project.create/open; schematic.create; board.new_pcb/rebind; document/window 生命周期 | 实际 tab/session/activation 更新、同名/关闭/retired 防误绑定、Board donor 行为、返回 UUID、补偿后上下文 |
| library.footprint.build; library.symbol.build | openInEditor 返回 tab 与 asset/document UUID 对应关系；实际几何 getters、native save ACK；中途失败残留 |
| schematic.component.place/replace/resolve_lcsc; pcb.component.attrs_backfill | source identity 跨 reload、supplier/custom-property Host 丢字段 workaround；补偿和 pin diff |
| schematic.power.connect_pin; schematic.group.move; schematic.pin.disconnect | 旋转校准、segment-array wire merge/新 ID、删除 cascade/survivors、延迟 promise 的真实行为 |
| route.apply_batch; pcb.route.via_hop; pcb.route.delete/rip_up; pcb.track.lock | Fast geometry/ownership/revision、Host 锁和 embedded primitive、实际返回 ID 与 late-settle |
| pcb.add_component | embedded via 是否暴露可信 native parent getter；若缺失必须保持 UNKNOWN，不能回到邻近关系猜测 |
| pcb.outline.set/clear; pcb.page.clear; schematic.page.clear | full requested absence、outline exact source、其它 primitive 不受影响 |
| pcb.pour.rebuild; pcb.plane.refresh | returned Poured→Pour identity、真实 fill source 完整性、非目标 scope、solver settlement |
| pcb.drc.check/compare | 实际 verbose leaf 形态、stable anchors、设计失败与 query 成功分离 |
| pcb.manufacturing.export; schematic.export.*; pcb.export.dsn; pcb.snapshot | native 文件 shape/格式、真实 gerber/drill/CSV 清单、界面 capture/selection 恢复；CAM/DFM 不在本轮证明范围 |
| pcb.silk.set/align/netnames/label_pads | 实际 bbox、mirror/layer settled rejection fallback、字体/位置 readback |
| 全部 save/reload/checkpoint 场景 | ACK 与 reload persistence proof 分开；daemon/Connector 重启后 fail-safe + operator-assisted rebind，不宣称持久化 exactly-once |

7 个 UNSUPPORTED 如后续希望恢复，必须先取得其缺失的明确 native scope/settlement/ownership 依据；不是通过临时 legacy bridge 补齐。本轮不开始 Round 3、不操作真实 Host。

## Final validation

| Command | Result |
|---|---|
| `go test ./...` | PASS：全部 Go 包，包括 daemon/coordinator、CLI、shared DRC/manufacturing parsers |
| `go build -o $env:TEMP/easyeda-v2-round2.exe ./cmd/easyeda` | PASS |
| `node extension/node_modules/typescript/bin/tsc --noEmit --incremental false -p extension/tsconfig.json` | PASS |
| extension cwd: `node --require ts-node/register --test --test-concurrency=1 src/*.test.ts` | PASS：663/663；无 skipped |
| extension cwd: `node --require ts-node/register config/esbuild.prod.ts` | PASS：Connector production bundle |
| `node --test mcp/test/*.test.mjs mcp/src/v2-projection.test.mjs` | PASS：27；1 个 opt-in Host 测试 SKIP；0 FAIL |
| `node scripts/generate-v2-catalog.mjs --check` | PASS |
| `node scripts/audit-v2-migration.mjs --check` | PASS：151=144+7，NOT_MIGRATED/LEGACY_RUNTIME=0 |
| `node scripts/audit-v2-business.mjs --write` | PASS：70 个 Round 2 action，native 直接参数遗漏 0 |
| `git diff --check` | PASS |

测试工具链：本地 Go、Node、现有 TypeScript/SDK 依赖；未下载或升级依赖。没有忽略仍应成立的 regression。正常 save ACK 与 viewport command completion 的 Round 1 测试包含在完整 Connector 回归中。

**ROUND2_READY_FOR_REVIEW**：这是实现与离线审查就绪，不是 Host qualification 或 manufacturing certification。
