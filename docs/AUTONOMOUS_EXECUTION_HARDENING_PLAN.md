# AUTONOMOUS_EXECUTION_HARDENING_PLAN

## 文档状态与实施基线

| 项目 | 约定 |
|---|---|
| 仓库 | `WangONC/easyeda-agent` |
| 固定审计基线 | `a583bf731d946d2d39f1223e078d711bd41710d5` |
| 基线提交 | `完成无人值守生命周期与原理图编辑收口` |
| 基线版本 | CLI/daemon 正式 Makefile 构建、Connector、Skill：`1.4.15`；MCP：`0.18.5`。版本号不等于实际激活构建身份。 |
| 文档日期 | 2026-09-10 |
| 性质 | 基于既有审计的架构收敛与实施 handoff；不是第二轮全仓审计，不是修复实现，不是 Host 验收报告。 |
| 当前资格 | 沿用既有审计 `NOT_READY`；本文不授予任何新增 Host 或 autonomous qualification。 |
| 实施起点 | **只从 Stage A 开始。** 后续阶段在前一阶段完成、测试、独立审查并接受 commit 后才可开始。 |
| 工程保护 | **不得打开、保存、重载、导入变更或修改当前 G474 benchmark 工程。** Host 测试只针对独立测试 fixture。 |

**证据边界。** 既有审计核对了 151 项 action 并集、关键实现、能力矩阵及 Q01–Q13，但没有当前提交的完整本地测试执行记录，也没有全部 typed CLI 叶子命令、Skill 引用和代码分支的零遗漏证明。本文继承这一边界，不把未核验单元当成通过。本次仅为明确复用边界补充定点读取了同一固定提交的 `writehealth.go`、`write_verify.go`、`envelope.go`、`stalereads.go`；没有扩大 finding 集合或重新判断当前 `main`。下文“已有”是源码观察，“目标/应当”是设计要求，“资格”是必须另外取得的执行证据。[S01][S03][S22][S23][S24][S35][S36][S37][S38]

原始输入是本对话已交付的 `FULL_AUTONOMOUS_EDA_STATIC_AUDIT.md`、`capability_matrix.{md,json,html}`、`HOST_QUALIFICATION_SUITE.md`。本文保留 B01–B05、H01–H21 原义，不以分类调整抵销严重度；没有新增审计 ID。

---

## 1. 工程决策：统一执行契约，不另建运行时

### 1.1 要解决的不是“每个 action 再加一个检查”

当前仓库已同时存在：catalog 驱动的派发与门控、Fast Path 事务和读回、写效果健康度、CLI 迟到读回上报、陈旧读取门、自动保存、FIFO 与超时机制、来源身份解析。缺口在于这些机制对同一次操作的**目标、效果、证据、持久化和后续许可**没有共享足够严格的契约。[S01][S03][S06][S11][S15][S17][S27][S30][S35][S38]

推荐方案是对现有链路作五项一致性提升：

1. 在 **现有 ActionSpec / protocol** 中定义执行位置、真实副作用、验证要求和结果语义。
2. 在 **现有 Connector handler / FIFO 边界**执行目标守卫、记录原生写尝试、语义读回及有限恢复。
3. 在 **现有 daemon 派发、审计和门控链**中汇总结果，阻断未决写、维护文档归属并接收迟到证据。
4. 在 **现有 autosave / doc reload / artifact 导出链**上建立显式保存与交付屏障。
5. 由 **同一个 catalog 加外部资格证据**派生 autonomous surface；MCP/CLI 只作一致入口和结果投影。

这五项构成 **Autonomous EDA Execution Layer**。它是既有系统的契约与执行边界，不是新增服务、第二个调度器、第二套 PCB 状态数据库或通用事务框架。

### 1.2 资格目标必须写出作用域

第一批可交付目标是：在一个已固定的 build/Host/配置组合上，使用明确获准的 action 和参数子集，从 Home 完成 Personal 项目、平面多页原理图、PCB、显式布局/布线、Plane、DRC、制造导出以及可证明的保存/重开/恢复。

**安全停止不是任务完成，但比假成功正确。** 不支持的动作、几何、界面语言或恢复情形应在任务准入或第一笔相关写入前明确阻断。不能把“这些地方会停住”重新命名为“全能力无人值守已 READY”。

默认允许先缩小 autonomous surface，而不删除普通用户能力；但不得裁掉核心链路再宣称完整主链已合格。`pcb.import_changes`、目标定位、保存/重开、DRC、制造交付若没有合格路径，核心主链仍不合格。

### 1.3 最小性约束

允许新增的工程内容限于：协议类型/字段、已有流程的受保护封装、现有审计的恢复记录、共享验证适配器、资格资料与测试。禁止新增 CAD 原语、几何求解器、自动选路、自动修线或平行状态服务。

不要求本轮让全部 151 项能力都获得 autonomous qualification。要求每项能力都有明确处置，并且**凡进入 autonomous surface 的能力，其依赖、参数子集和失败恢复也必须闭合**。

---

## 2. 当前问题的架构归因

### 2.1 四类处置属性

| 标记 | 含义 | 对应处置 |
|---|---|---|
| **D — confirmed implementation defect** | 固定源码存在可指出的错误分支或不充分谓词；不必先在 Host 撞到才能承认。 | 修正共通机制并迁移该路径，或在机制落地前彻底禁止该路径执行。 |
| **A — architecture gap** | 局部能力存在，但跨入口、执行边界、恢复或耐久契约未闭合。 | 扩展已有机制并明确单一责任归属；不能以一个局部 patch 宣布关闭。 |
| **Q — qualification gap** | 源码存在不等于当前 build/Host 下可用；现有证据不能定案。 | 限定作用域、准备 fixture、取得可归属证据；不可为了“闭单”猜测补丁。 |
| **N — deferred / non-autonomous capability** | 经明确决策保留在普通能力面，但不纳入当前 autonomous scope。 | catalog、执行层、MCP/CLI/Skill 同步声明并强制排除；不是把 finding 改成已修复。 |

一个 finding 可以同时包含 D/A/Q。N 是**处置结果**，不能用来否认已确认缺陷。细分例如 H21：探针清理失败仅日志是 D；普通器件旋转的 `cmdKey`/command-context 是否仍失败是 Q。

### 2.2 五个根因

| 根因 | 架构问题 | 主要 finding | 统一修复方向 |
|---|---|---|---|
| **R1 结果和证据语义分裂** | 调用成功、对象存在、请求回显、语义完整、有效空集和通过被混用；结果在上层丢失。 | B01、B03、B04、H04、H08、H15、H16、H21 | Action Contract、MutationOutcome、证据完整性、统一结果投影。 |
| **R2 执行目标与来源缺乏持续绑定** | 预检查与实际写分离；几何/C 号/名称代替对象所有权；来源 UUID 被当作内容版本。 | B05、H01、H02、H03、H05、H07、H20 | 执行时 identity guard、所有权证明、来源与消耗属性指纹、跨域映射验证。 |
| **R3 不确定执行没有统一生命周期** | timeout/abandon 不取消原生写，局部重试可重复 mutation；partial、补偿和跨 activation 恢复不一致。 | B02、B03、H02、H03、H05、H10、H18、H21 | no-blind-replay、保留 operation 身份、有限恢复、未决隔离、复用 Fast Path 事务语义。 |
| **R4 效果、保存与交付之间缺屏障** | 活跃页保存不代表原目标落盘；文件存在/hash 不代表正确版本交付；有效零库存被固定 fixture 条件排除。 | H06、H13、H14、H17、H18 | 文档绑定 dirty/checkpoint、save/reopen barrier、制造源指纹和期望库存、可靠 artifact 交付。 |
| **R5 能力声明、入口和资格未分层** | catalog 名称不代表所有入口都可执行；门控可遗漏；禁用只是部分进程过滤；版本号和源码声明被过度解释。 | H09、H10、H11、H12、H19、H20、H21 | 执行位置声明、能力依赖闭包、强制策略、实际 build attestation、证据驱动 qualification。 |

这些归并来自原审计，不将所有问题强行解释成一种错误。例如 H18 的有界账本拒绝本身是正确保护，不是应当删除的“容量 bug”；缺口是容量计划、检查点和未决结果恢复。H13 是有效设计被误拒绝，不是假成功。H11 的 library 能力是 MCP 面缺失，不是 CLI/Host 完全没有该能力。[S06][S08][S13][S18][S30]

---

## 3. 已有机制：必须复用什么、不能误认为已经具备什么

### 3.1 复用清单

| 已有机制与位置 | 已存在的能力 | 本计划如何提升 | 禁止重造或过度推定 |
|---|---|---|---|
| `internal/protocol/actions.go`：`ActionSpec`、`AllActions`；`actions_closure.go`：`closureActions` | `Domain/Mutates/NeedsWindow/NeedsConfirm/RequiresGate/InvalidatesStage/VerifyWith`；公开能力目录。 | 在同一记录上补 executor、effects、支持边界、guard/replay/verification 约定；生成各入口投影。 | 不建另一份手工 `autonomous_actions.json` 作为独立动作真值；`VerifyWith` 目前只是验证指引，不自动代表执行过验证。 |
| `extension/src/fast-path.ts`：`FastPath.observe/snapshot/apply`、`matchesOperation`；`fast-path-native.ts`：`nativePort` | session/epoch/revision；重复事务签名比较；deadline；逐写 context 检查；实际几何/删除读回；有限补偿。 | 保留算法和事务核心，给原有结果增加共通 envelope 映射；补外部证据归属与能力限制。 | 不重写 preflight、hash、批处理、几何引擎；不再建一套 daemon route 事务执行器。 |
| `internal/daemon/fastpath.go`：`isFastAction/forwardFast` | Go preflight/plan receipt、capability 检查、Connector 转发、Fast 错误和 telemetry。 | 仍由这里负责 Fast Path 接入和结果保真；复用通用副作用处理，去掉靠伪造 `OK` 才触发失效的特殊做法。 | 不能让 MCP 再做一套 preflight 或 plan 状态机。 |
| `internal/daemon/writehealth.go`：`writeHealthTracker`、`effectFromResponse`、`annotateDegraded` | 窗口/逐 action 的有界健康样本；假成功/假失败区分；从 `partial/notApplied/survived/deleted` 等提取负证据；迟到读回可修正样本。 | 让同一效果 reducer 消费结构化 outcome；保留统计和诊断，不把健康度变成授权或持久结果。 | 不能说当前系统“只看 resp.OK，完全没有效果判定”；也不能以 failureRate 低或 `effectLanded` 自动解封未决事务。 |
| 同文件 `WriteVerification/handleWriteVerify`；`internal/app/write_verify.go`：`writeVerifyBody/reportWriteVerified` | `/writeverify` 侧带上报；可按 requestID 关联，也可按 action 回填批量统计；CLI 当前是 best-effort 遥测。 | 在同一通道增加严格归属的 evidence amendment；需要改变执行许可的上报必须获得确认，并进入现有审计链。 | 不新增第二个 write-verification 服务；无 requestID 的计数、静默失败的遥测不能作为恢复授权。 |
| `internal/daemon/stagegate.go`：`checkStageGate/maybeInvalidateStage`；`internal/workflow`：`LoadAny/CheckRouteGate/InvalidateAll/Save` | catalog 驱动的阶段检查与失效，持久化 workflow 状态。 | 对 COMPLETE/PARTIAL/UNCERTAIN 的可能副作用统一失效；按确切项目/文档归属应用；运行许可叠加未决阻断。 | 不再建“第二套 routeAllowed”；保存成功或恢复完成不能自动重签布局、板框、DRC。 |
| `internal/daemon/stalereads.go`：`staleGuard.observe/blockedBy`、`pcbStaleMarks/pcbStaleClears` | PCB stale-read 拒绝；受限观测路径保留；当前按 window 存状态，reload/pour rebuild 有清除约定。 | 复用这一 guard，绑定实际文档与具体 freshness 证据；明确几何可观察与原生 connectivity 新鲜度不是同一属性。 | 不用一个新的“fresh”缓存取代它；不能将重连、字符串匹配或一次普通 `OK` 自动提升为全部索引新鲜。 |
| `internal/daemon/autosave.go`：`autosaver.schedule/deferAutosave/dispatchSave/stop` | 防抖、忙时延后、最大延后预算；已有 `schematic.save/pcb.save` 与 CLI reload。 | 保留调度方式，改为原目标 dirty/checkpoint 归属；显式保存屏障复用 save/reload 链。 | 不建第二个自动保存定时器；autosave 仍是兜底，不等于 durable completion。 |
| `extension/src/action-queue.ts`：`ActionQueue.submit/runHead`；`deadlines.ts`；daemon `queueblock.go`、`forwardWithAdaptiveRetry` | FIFO、队列上限、worker 支撑 deadline、abandoned 证据、堵塞探针；daemon 重试限定在导航类。 | 在既有队列与派发准入中增加执行归属/未决栅栏；绝对截止期限覆盖排队和执行；保留安全读取通道。 | 不新增通用任务队列；不因“队列继续流动”就允许后续写追上尚未结束的旧写。 |
| `component-source.ts`：`sourceAsset/sourceReceipt/resolveSource/sourceStorageKey`；`actions.ts`：`persistComponentSource/resolvePlacedDeviceIdentity` | 来源 asset 与实例 binding 区分、来源 receipt、插件配置持久化、精确来源解析；替换已有 create-before-delete。 | 复用解析和持久化，补本次消耗属性的不可变快照、目标/来源验证及恢复证据。 | 不按 C 号建立另一套器件身份；插件配置持久化不能冒充工程文件携带 provenance 或跨机器自动可恢复。 |

上述存在性与边界分别由 catalog、Fast Path、派发、自动保存、身份模块及本次定点读取支持。[S01][S02][S03][S06][S07][S11][S15][S17][S27][S28][S30][S35][S36][S38]

### 3.2 `effectFromResponse` 不能直接改名为 MutationOutcome

现有 `effectUnknown/effectLanded/effectNotLanded` 是**效果健康度**分类。其中 `effectNotLanded` 可以表示部分目标未完成，并不证明完全没有写入；`effectLanded` 也不天然包含持久化、完整属性和当前文档身份。`effectFromResponse` 的默认是 Unknown，它没有把缺少负证据当成正面读回证明，这一点应保留。[S35]

升级规则：

- 新 `execution` 证据优先由共通 reducer 校验，然后投影到现有健康样本。
- 旧 `partial/notApplied/survived*` 解析继续作为兼容负证据，不能凭字段缺失推导 COMPLETE。
- 旧 `WriteVerification` 的 `landed/notLanded` 继续服务统计；只有**精确 operation、目标、activation、验证器版本和读回引用**齐全的 amendment 才能参与恢复裁决。
- 同一 evidence ID 在响应内和 `/writeverify` 到达两次，只能产生一次效果更新；不再制造两份健康样本。
- 遥测上报失败仍可 best-effort；**要求解封或完成检查点的证据提交失败必须保持阻断**。两者复用端点和模型，但承诺不同。
- 严格 amendment 不能只信调用者填入的 `landed/verified`。daemon 必须关联已记录的 observation/Connector response、原目标、操作和验证器所需实际值；只带计数、无法归属的 JSON 或不可核实引用只进入遥测，不解封。验证器不能用本次请求 payload 充当实际读回。

### 3.3 状态只有一份权威归属

| 状态 | 权威 owner | 其它层允许保存什么 |
|---|---|---|
| 动作定义、参数支持和依赖 | `ActionSpec` | 生成/校验过的 Connector、CLI、MCP 投影，不手工维护第二份规则。 |
| 正在执行的原生调用、实际步骤结果 | Connector 既有 handler/queue；Fast 操作仍是 `FastPath` | daemon 记录引用和保真 receipt，不独立重跑或改写 native outcome。 |
| 请求意图、派发事实、receipt/amendment 历史 | daemon 既有审计持久层 | workflow、health、autosave 只维护可重建的索引/视图。不能另建独立事务数据库。 |
| 写效果统计 | 现有 `writeHealthTracker` | UI/MCP 显示统计；统计不授予执行资格。 |
| 阶段确认 | 现有 `workflow.State` | `routeAllowed` 仍由现有门控计算，不写第二个可自行批准的布尔值。 |
| 未决阻断 | 现有派发/工作流准入中的 operation 引用集合，来自审计与 receipt | 内存索引可重建；不能把阻断只放入会过期的健康环形窗。 |
| dirty/save/checkpoint | 现有 autosave/save/reload 链，引用同一执行证据 | 不另设并行保存线程或“成功计数即 clean”。 |
| 资格 | 经审查的外部测试证据及其作用域 | runtime 读取匹配结果；源码只声明候选资格，不自证合格。 |

这里需要增强现有审计持久层，但**既有 `s.audit.Append/fromResponse` 是否具备崩溃一致 append、flush、完整性检查及历史保留保障，前次审计没有证明**。Stage A/B 必须先确认实际实现；不足时改造同一层。不得把普通日志追加当成现成 WAL，也不得为了方便另建一个不一致的执行账本。[S03][S35]

---

## 4. 推荐目标架构

### 4.1 各层职责

| 层 | 必须负责 | 不应负责 |
|---|---|---|
| **protocol** | Action Contract、请求身份与 operation 归属、MutationOutcome、证据和持久化摘要、兼容映射规则。 | Host 观察、调度、文件系统保存、资格自认证。 |
| **daemon** | 目标路由与唯一执行归属、策略准入、已发出请求的不确定性、审计持久化、stage/stale/dirty 消费、未决阻断、证据归并。 | 猜 Host 已取消、从请求坐标推断成功、重实现 Fast Path 几何/回滚。 |
| **Connector** | 入队后与每笔原生写前的 context guard、目标所有权检查、原生调用结果、实际读回、有限补偿、晚完成通知。 | 将超时当取消、以 UI/名称相似度批准破坏性目标、代替 daemon 保存本地交付文件。 |
| **CLI** | 参数解析、名称到确定 UUID 的解析、已有复合流程、捕获初始 operation、完整结果与退出码、现有 `/writeverify` 严格证据回传。 | 自建事务状态机、自动换新 ID 重试、吞掉 structured error / partial / uncertain。 |
| **MCP** | 从 catalog 构建一致 surface；转交现有 CLI；保留原始结果与结构化执行状态。 | 自行维护 preflight/事务账本、做 Host 恢复、用进程返回码判定 mutation 完整。 |
| **Skill/文档** | 解释支持边界、恢复纪律、准入所需目标和合法执行入口。 | 承担只能靠模型记忆执行的安全约束；授予源码没有强制的例外。 |

### 4.2 Action Contract：扩展现有 ActionSpec

以下是**目标字段语义**，不是声称当前源码已存在这些字段。Stage A 可以调整命名，但不得删去语义或形成多份手写真值。

| 契约项 | 最小设计 |
|---|---|
| `contract_version / contract_hash` | 跟随实际 schema 与语义变更；用于各层匹配，不以 semver 替代。 |
| `executor` | `CONNECTOR / DAEMON / CLI_COMPOSITE / LOCAL`。声明正式入口和禁止直接转发的情况。 |
| `effects` | 区分设计内容、项目拓扑、库资产、导航/选择、原生重算、保存、artifact 交付。可多个；复合能力覆盖其子步骤副作用。 |
| `target_scope` | `HOME / PROJECT / DOCUMENT / LIBRARY` 等受支持作用域；区分无项目是有效状态还是读取未知。 |
| `dry_run` | 明确 `unsupported` 或已有实现的无写 preview；unsupported 且收到 `dryRun:true` 必须执行前拒绝。不能给未知字段改变副作用类别的权力。 |
| `guard` | 所需 project/document/type、activation、原生对象身份、base revision/观察指纹及排他执行范围。 |
| `verification` | 引用已有 verifier，列 required 字段/对象/覆盖范围、允许的原生量化语义、是否需要电气映射或持久化；不是 `verified:true` 默认值。 |
| `replay_policy` | 只读重试、确定未派发才可重试、已有 receipt 查询、受限定目标的幂等导航。禁止默认重发内容 mutation。 |
| `recovery` | `reconcile_only` 或复用已有 owned compensation；声明可恢复与不可恢复状态及 preimage 范围。 |
| `dependencies / supported_parameters` | 包括内部 debug/UI compatibility、复合 CLI、库读取、save/reload 及参数级限制。依赖不合格，上层不可合格。 |
| `autonomous_eligibility` | 仅表示候选/排除及原因。**不允许表达 HOST_VERIFIED 或 AUTONOMOUS_QUALIFIED。** |

保留 `Mutates/NeedsWindow/NeedsConfirm/RequiresGate/InvalidatesStage/VerifyWith`。新增语义若细化旧字段，必须由同一记录派生旧投影或设置 parity 断言，不能双份手写。例如 `Mutates` 的历史 save/view 用法不得被草率重定义成纯内容写；新 effects 用于精确派生 autosave、stale 与准入。`NeedsConfirm` 继续表示破坏性授权范围；已有用户授权可复用，但不能绕过技术资格。[S01][S02][S11][S38]

**跨语言实现选择：** 不引入策略 DSL。Go/TypeScript 可以各有执行适配器，但 enum、必要字段、默认拒绝规则、转换真值表必须生成或做契约 fixture 对照。MCP schema 从同一 catalog 投影，不能再维护不同 operations enum。

### 4.3 统一结果：调用、mutation、验证、持久化分开

保留 `resp.OK` 的调用层含义。新增结构化执行记录，至少携带：

```text
operation_id / parent_operation_id / request_id
contract_version / contract_hash / payload_hash
expected_target / observed_target_before / observed_target_after
activation / executor_build
mutation_outcome: NO_WRITE | COMPLETE | PARTIAL | UNCERTAIN
write_attempted / item_results / affected_targets
verification: state + scope + required/observed/missing + evidence_refs
recovery: state + owned_targets + evidence_refs
persistence: state + checkpoint_ref
request_satisfied / next_action
```

这些是逻辑字段，不要求全部复制到顶层和 `result` 两处。应选唯一正式位置，旧字段只作兼容投影，原始 Host 结果和错误保留。纯只读、纯保存、纯导出或纯导航不必硬套内容 mutation：`mutation_outcome` 可以不适用，分别用验证、持久化、交付或导航状态表达任务是否完成。**“没有改 CAD”不等于“DRC 执行通过”或“文件保存成功”。**

#### MutationOutcome 真值表

| Outcome | 允许成立的条件 | 禁止推导 |
|---|---|---|
| **NO_WRITE** | 能证明本次操作未产生设计/拓扑/库写：例如在派发前拒绝、队列开跑前过期且未执行任何写步骤、完整验证后确认目标原本已满足而跳过写。 | timeout、disconnect、native false/undefined、没找到新对象、瞬时画面没变化，均不足以自动成立。 |
| **COMPLETE** | 声明范围内所有要求均有新鲜、目标一致、覆盖完整的语义读回；没有未决原生写和未清理辅助对象；最终效果满足目标。 | `resp.OK`、对象存在、请求回显、只验一个字段、缓存 receipt、保存成功，都不能单独导出。 |
| **PARTIAL** | 已知执行的步骤和剩余差异可界定，原生调用已 settle，没有尚可能改变判断的未决效果，但原目标没有完整达到；或发生过写且已确认补偿恢复。 | 不得把仍在执行、未知 ID 或缺关键读回的失败降级成“已知的部分失败”。 |
| **UNCERTAIN** | 请求可能已写，实际作用、目标归属、原生提交完成性、关键读回或晚完成情况不能定案。 | 不能依据等待结束、重连、一次空读取、健康度转绿自动变成 NO_WRITE/COMPLETE。 |

补充约定：

- `NO_WRITE + request_satisfied=true` 可表达已验证的幂等 no-op；`NO_WRITE + request_satisfied=false` 是明确未执行的拒绝。两者不可混用。
- `COMPLETE` 默认仅证明已声明的当前效果；持久化不在该 action 承诺中时，不能推断已落盘。
- **发生过写后补偿恢复，仍不是 NO_WRITE，也不是原请求 COMPLETE。** 返回 PARTIAL，加 `recovery=RESTORED` 和完整恢复证据；业务目标未达到。
- helper probe、临时 replacement、UI apply 也计入步骤；不能只统计主对象。
- 旧错误码不能独自证明 NO_WRITE：只有实际执行轨迹证明原生写尚未开始，`PRECONDITION_REFUSED/MISSING_PAYLOAD_FIELD` 等才可按零写拒绝处理。已经发生过辅助写的路径不得借错误码掩盖影响。
- 任一步存在未决效果，aggregate 必须 UNCERTAIN；只有全部可定案后才区分 PARTIAL/COMPLETE。不能只按“成功项数”聚合。
- `status:stale` 只在已证明本次未写时映射为 NO_WRITE。拒绝一次过期重试，不能回头证明原 operation 没写。
- Fast Path 现有 `complete/partial/stale/uncertain` 保留：新增 outcome 是已有证据的兼容映射，不新建 route 状态机。若 evidence 缺失或冲突，降为 UNCERTAIN 并保留原因。[S06][S30]

#### 共通消费规则

| 结果 | stage / stale / dirty | 下一步 |
|---|---|---|
| NO_WRITE | 不因本次拒绝而制造新 dirty；保留此前未决/stale。 | 原目标已满足则继续；否则修正准入条件，仍关联原 operation。 |
| COMPLETE | 对实际副作用失效有关阶段/索引，记录原目标 dirty；不能仅因完成写就通过设计检查。 | 所需读回、保存或后续阶段；由契约决定。 |
| PARTIAL | 同样失效；阻断依赖这次完整修改的工作；已 settle 的部分状态可以按明确 salvage policy 保存。 | 先对账，再生成有父 operation 的剩余修复或 owned compensation。 |
| UNCERTAIN | 按最大可信影响范围失效并隔离；未知项目/页面时扩大到对应 Host 执行范围。 | 只允许可证明无副作用的诊断/对账；不得正常写入、导出最终交付或自动重发。 |

CLI 的退出码、MCP `isError` 来自 `request_satisfied` 及所要求的 verification/persistence 状态，不只来自 `resp.OK`。一个未合格的读取可以保留观测数据并报告失败；一个 PARTIAL 也应完整保留已应用步骤，不能只输出一句错误。此逻辑收敛现有 `authoringResult/compactFastResult/requestActionOnce`，不再新增逐 action 的客户端名单。[S04][S08][S10][S18]

### 4.4 严格证据归一化：UNKNOWN 不等于 EMPTY

共享 evidence envelope 至少区分：`AVAILABLE / UNAVAILABLE / UNSUPPORTED / INVALID`，并另列 `coverage=COMPLETE/PARTIAL`、scope、实际来源、revision/activation、时间与验证器版本。有效空值由 `AVAILABLE + COMPLETE + 明确空数据` 表达，不用 `null ?? []` 表达。

具体规则：

- **DRC：** 先证明调用完成、返回形状可识别且违规覆盖完整，再计算 PASS/FAIL。未知形状为 UNKNOWN；未知严重度违规保留，不能计为零。non-verbose `false` 为 FAIL、细节/计数未知；非 verbose `true` 只能按其合格 API 契约表达布尔通过，不能凭空声称获得逐项零违规清单。
- **集合：** 成功取得一个合法空数组，可以证明当前已限定 scope 没有元素；`undefined/null/读取抛错/部分分页` 不可以。删除证明要求确定读到了整个相应集合或精确对象的合格不存在结果。
- **约束：** rename 比较名字与原 P/N 身份；group create/add 比较完整期望成员集合，不只验证请求集合是子集。去重规则和额外成员须显式说明。
- **几何：** `allInside=true` 要求 expected 对象全部被检查；unknown bbox 返回未验证，并保留未读到对象列表。不能把缺对象过滤后再做全称判断。
- **制造：** “预期该类孔为 0 且完整库存确认”为有效空集；“缺文件/缺库存/无法解释钻孔格式”为未知或失败。只读 shape validator 不承担制造正确性认证。
- **属性：** missing、空字符串、null、0、false 含义分开。`keepProperties` 明确保留的空值不能被自动替换成库值；读取失败不意味着属性为空。

Host 量化属于具体字段/原生 API 的已测合同，不属于通用宽松相等。复用 `matchesOperation`、现有 property/PCB patch verifier 和规范化函数；按已确认数值语义比较，保留 raw/normalized/差值/容差来源。不能为了通过测试扩大 epsilon、用舍入隐藏真实几何或把弧线 0.1mil 量化假设推广到所有坐标。[S05][S06][S07][S13]

### 4.5 执行时 identity guard：不仅在 CLI 预检查

请求目标必须是已经解析的稳定身份，而不是“此刻前台”或任意同名页。最小 guard tuple 包含：

```text
project_uuid + document_uuid + document_type
connector activation / selected registration generation
适用时的 base_revision 或对象来源/绑定证据
```

Home/project/library 操作使用各自 scope；不能给 Home 硬填不存在的 document UUID，也不能把 current 读取异常当作“明确处于 Home”。Personal owner 与 Team 的区别继续复用生命周期实现，不从 `project.current.teamUuid` 自动构造真实 Team 目标。[S02][S28]

执行次序：**CLI 解析 → daemon 确定唯一执行归属 → Connector 入队后重新核对 → 每笔 native write 前核对 → 原生返回后核对 → fresh readback。** 所有复合 helper 必须共享原请求的 tuple；不能在每一步重新取“当前上下文”当作新的合法目标。

在既有 hub/非重入准入和 Connector FIFO 上维护一个短期排他执行许可：内容 mutation、导航、保存关闭与依赖当前焦点的操作不能由另一个 registration 穿插。它是既有派发的准入状态，不是新增队列。无法证明两个 registration 是否共享同一 Host 编辑上下文时，保守按更宽范围互斥或拒绝，不能选择“最新/第一个”来猜归属。

**必须承认 TOCTOU 的残余边界：** `getCurrentDocumentInfo` 后立即调用当前页 API，依然不等于原生原子文档锁。优先使用已有官方显式文档目标能力；无此能力时，以单一受控编辑会话、导航互斥和当前 Host qualification 限定作用域。外部 UI/插件仍能切页且无法阻断或可靠观察的配置，不得被宣传为任意并发下安全。前后 guard 只能检测漂移；漂移后要 UNCERTAIN、隔离所有可能受影响文档，不得自动撤销另一页内容。

排他许可不得在 HTTP 超时或连接断开时被当成“工作已结束”释放。只有终态证据、明确执行前拒绝，或经过已验证的会话替换与对账才能恢复准入。新 registration 不继承旧未决请求的“已取消”假设。

### 4.6 no-blind-replay：保留业务 operation 身份

`request_id` 是一次传输尝试；`operation_id`/现有 `client_transaction_id` 标识同一个业务 mutation。复用 Fast Path/lifecycle/replace 的去重机制和 signature，不把每次 CLI 启动生成的新请求 ID 当作安全重试。[S06][S28]

最小策略：

| 情形 | 允许行为 |
|---|---|
| 有证据证明没有派发或执行前拒绝 | 在 guard 仍有效时按有界策略重新尝试；同一业务意图仍保留 operation 关联。 |
| 纯观测调用失败 | 允许有界读取重试；读取不得隐含 probe create、recompute 或切页而未声明 effects。 |
| 内容写 timeout/disconnect/undefined | 返回 UNCERTAIN，查询原 operation 和新鲜观测；**不能再次 create，也不能换 ID 重发**。 |
| 相同 ID、相同目标和相同 payload hash | 查既有 receipt/进行中状态，不新执行 native mutation。历史 complete 附原 revision/time；需要当前证明则另外读取。 |
| 相同 ID、不同 payload/目标 | 执行前拒绝 `TRANSACTION_ID_REUSED`，原 operation 记录不被覆盖。 |
| 已知 PARTIAL 且无未决效果 | 对实际状态重新计划剩余工作；新的子 operation 指向旧操作和对账证据，不重放旧完整 payload。 |
| 导航重试 | 保留 `retryableOnFailure` 的狭窄策略，但必须受 execution scope/未决写栅栏约束；不能越过被隔离的写去重开页面。 |
| queue overflow/过期 | 只有明确未进入 native 写阶段才可 NO_WRITE。新的等待预算不能让已过期的排队写在以后突然执行。 |

对 operation 的 payload hash 至少覆盖 action/contract version、目标、业务参数、相关 base revision/plan；deadline、统计字段等传输信息不改变业务意图。为已有 Fast Path 保留其现行签名算法和匹配约束，不能混换 hash 造成原 receipt 不可辨认；新增映射记录两者关系即可。

为了处理“发出后 daemon 崩溃”，发送前必须在**现有审计持久层**写入关联 operation 与目标的 intent；无法确认 intent 可靠记录则不发写。发出边界的崩溃允许保守留下 UNCERTAIN，不能出现“没有日志所以可以重发”。daemon 不接管 Fast Path 的执行去重，只保存原 receipt、未决 intent 和恢复引用。

### 4.7 PARTIAL/UNCERTAIN：恢复或隔离，不是不断重试

在现有派发与 workflow 准入里增加 `blocked_by_operation_ids` 一类派生阻断信息，并持久保留其来源。它与 `writeHealth.degraded` 独立：一次未知破坏性写就能阻断，不必等失败率越阈值；健康样本过期、`forget(windowID)` 或恢复连接都不能清掉该阻断。[S35]

最小恢复序列：

1. 停止受影响执行范围的新 mutation，记录最后确知的步骤、原 ID、preimage、来源以及可能受影响文档。
2. 只做已声明为无副作用的观测；保留原 operation ID。用原 receipt/合格不存在读回定位对象，不能因相似几何就擅自删除“疑似重复”。
3. 若原 native 调用或其提交仍可能晚到，保持 UNCERTAIN。一次快照相同不证明再也不会有副作用；需要已合格的 settle/reopen 协议或可靠终态证据。
4. 只有全部目标和残留可界定时，才允许既有补偿逻辑运行；补偿是有父 operation、明确目标和独立读回的子步骤。
5. 验证恢复所承诺的整个状态，必要时保存、重开再次证明；随后解除**执行隔离**，但失效的布局/连通/DRC 资格仍需重做。
6. 无安全恢复路径则返回确定的恢复限制及阻断原因。不得通过自动升级、清空账本、重启 Host 或放宽 gate 来假装问题消失。

**保留与压缩纪律：** audit/log rotation 不能删除仍被未决 intent、恢复或 checkpoint 引用的证据；最终记录压缩后仍须保留其身份和签名关联。Connector 的在世 activation 不静默淘汰去重记录来继续接单；daemon 保存的历史 receipt 仅用于观察/恢复，不能充当另一套可重放的 native 执行账本。

不要求通用 undo。Fast Path 删除无法补偿的现有边界保留；replacement 的 create-before-delete 保留；Board 重绑是否可以恢复完整工程树必须实机证明，不能仅根据调用过 `createBoard` 声称 rollback。完整 preimage 至少包括本 action 承诺的 source/library/instance 绑定、属性含空值、方向、子单元、位号、BOM/PCB 标记、pin/NC 和受影响连接。超出可读取/可恢复范围的情况应执行前排除。[S05][S06][S15]

### 4.8 target ownership 与 component provenance

**发现候选**与**批准写目标**分成两步。坐标、包围盒、名称、C 号、相似度可帮助发现候选，不能单独批准 destructive mutation 或派生赋网。

可接受的批准证据需要结合：正确项目/文档/activation、原生对象精确身份、相关 parent/component 关系或本次创建 receipt、当前实例绑定，以及需要时的唯一稳定来源解析。`primitiveId` 本身也有命名空间和生命周期，跨 reload 不能脱离它的 scope 复用。

对应边界：

- **B05：** embedded via 仅能在原生所有权或可信本次创建来源可证明时补网。仅靠“落在 pad 矩形内”，甚至仅靠“放置前后出现了新 ID”，在有并发/无 parent 证明时都不充分。证明不了则停止该派生写并报告 unsupported/partial，不能修改 sentinel via。
- **H01/H20：** 复用 `resolvePlacedDeviceIdentity/resolveSource`，从实例已核验的 device/library/association 取得属性；C 号只作为 lookup，不作为来源主键。`deviceIdentityResolver=connector-source-v1` 已有的权威标识应继续使用；旧 debug compatibility 不是自动回退兜底。
- **H02：** source asset identity 与本次使用的 Value/footprint/symbol/子单元等快照分别记录。来源 UUID 不代表库内容永久不变；签名覆盖实际消耗字段，变化需要重新审阅计划，不能静默用新库值恢复旧元件。
- **H07：** `source component → uniqueId → PCB component → footprint/pad/pin/net` 联合对账。preserve/replace 的电气作用单独列出；器件数量相等只是一项库存检查。
- **Plane：** 名称/logical handle 用于发现和重新解析；重名、缺失或跨文档 remap 不选第一个。handle 可解析不证明 poured copper connectivity。

不创建新 BOM、库数据库或新 pin-net 求解器；复用已有 source receipt、原生枚举、canonical connectivity/diff 和原生制造读取能力。[S05][S15][S16][S19][S21][S22]

保留现有 Profile 的证据分级：`MANUFACTURER_VERIFIED` 与 `HOST_VERIFIED` 不是同一结论。已绑定可观察 rules/layers 的制造商证据，不因该 Host 缺 physical getter 就被捏造成 Host 已验证，也不应被无条件降为无效；具体 Profile 仍按既有 hash/失效语义重新检查。本文不要求增加物理层叠 getter、阻抗计算或新的测量算法。[S02][S23][S30]

### 4.9 persistence/save barrier 与 artifact delivery

#### 文档保存屏障

在现有 autosave 和 `doc reload` 流程上实现以下证据层级，而不是只读取一个 `saved` bool：

```text
NOT_REQUESTED → PENDING → SAVE_ACKNOWLEDGED → REOPEN_VERIFIED
                         ↘ FAILED / UNKNOWN
```

`SAVE_ACKNOWLEDGED` 表示按已限定 Host API 契约确认保存调用；不自动等于断电级耐久或所有页面都已保存。只有重新打开同一文档并逐项读回目标状态后，才可宣称 `REOPEN_VERIFIED`；资格不得扩大到未测试的 cloud sync、跨机器或插件配置丢失场景。

屏障流程必须固定 project/document，确认没有未决 mutation，冻结本次需保存的语义状态；保存原文档并验证原生结果；通过既有关闭/重开恢复链重新获得确定目标，回读身份/属性/几何/连接与来源记录。SCH 与 PCB 的检查点分别具名，整体 checkpoint 引用两者，不以“活动页已保存”代替。

Autosave 仍由原 scheduler 去抖，但 dirty 归属改为稳定文档；无法安全定位原页时只保留待保存，不保存“现在的页”后清理原页 dirty。对尚在执行的 UNCERTAIN 禁止无条件自动保存；已知 settle 的 PARTIAL 可保存为 **salvage checkpoint**，不能标为 clean/accepted checkpoint。关闭/项目切换/升级前由同一屏障检查，而不是依赖 payload 的 `saved_current_project:true` 自证。

既有 reload 链和 stale guard 对 close/reopen 的识别也须使用有归属的步骤证据，不能依赖任意 debug 代码里出现某个字符串。若该链还依赖 raw `debug.exec_js` 执行固定 `closeDocument`，将**已有关闭步骤**收口为受保护、参数固定、不可执行任意 JS 的内部生命周期适配；保留现有公开 `doc reload`/MCP 入口。这是已有恢复能力的执行边界硬化，不是新增 CAD 功能。具体迁移文件和当前调用点由实施阶段核对，不在本文虚构一个已经存在的 typed close action。[S11][S22][S34][S38]

#### artifact 与制造屏障

继续复用 `persistArtifacts`、`inspectManufacturingFile/nativeDrillHits`、现有 manifest 和 SHA256。增加明确 `generated / persisted / structure_verified / source_consistent` 维度：本地文件不可写、字节丢失或哈希校验失败不得以 warning-only 交付成功；多文件 package 只有全部必要项验证后才发布最终 manifest。写失败保留可诊断的 receipt，禁止返回伪造 path。

制造 source fingerprint 覆盖本次需要的组件身份、Value/制造商/供应商、BOM 标记、位号、坐标/旋转/层、封装/pad/net、层清单和孔库存。它是**制造快照的用途指纹**，不是新 board revision 引擎，不改变 Fast Path revision 定义。导出前后比较相同范围，检测多文件间属性-only 变化；无法冻结/证明同一源状态则 package 未合格。

孔库存校验基于完整 expected inventory：允许某类为 0，不允许把缺失误认成 0；不支持的 slot/钻孔方言在导出资格边界明示。BOM/PnP 核对的是其实际承诺库存；结构/hash 通过仍不代表 DFM、时序、阻抗或最终 DRC 合格。[S03][S07][S13][S14]

### 4.10 capability surface、autonomous surface、qualification evidence

三个集合必须分开：

```text
公开 capability：代码及正式入口承诺“可以做什么”
autonomous candidate：契约声明“哪些参数/依赖适合进入无人值守候选”
当前 qualified scope：匹配本次实际 build / Host / fixture / 测试证据的子集
```

运行准入采用交集：catalog 支持、实际 executor 支持、运行策略允许、依赖闭合、所需资格记录匹配、target guard 通过、无未决阻断、stage/stale 条件满足。源码中的 `enabled`、`reviewed` 或 `verified` 不能自行生成资格证据。

**入口决策：** 不将 CLI 复合能力全部搬进 daemon。保留 `pcb.plane.refresh/drc.compare` 等既有 Go composite，catalog 明示 `CLI_COMPOSITE`。typed CLI、generic call 和 MCP 共用同一 CLI 路由映射；原始 daemon `/action` 收到不可直接执行的复合能力时，明确返回“此入口不承接”且零写，不再盲转 Connector。`pcb.report/manufacturing.export` 的 native-only 结果标明更弱范围，不能伪装为复合交付结果。这样闭合入口契约，不重写复合流程。[S02][S08][S30][S34]

**MCP/library：** 不为了抹平列表而一次开放所有 library 写入。先使身份主链必需的现有 `library.device.get` 及其读取依赖有清楚、可执行的 MCP/CLI 入口；永久库创建/build/删除等可保留普通能力并标 non-autonomous。工具面可用与当前 Host 合格仍分开。[S08][S09]

**禁用策略：** 扩展现有 `ActionDisabled/AvailableActions` 和派发校验，确保 canonical action、别名、复合入口及内部依赖均遵守同一策略。daemon 是受支持执行边界的最终准入点；Connector 对当前 activation 安装的策略/合同做防漂移校验，未同步则不得执行 autonomous mutation。不能只隐藏 MCP enum，也不能用替代 action/debug 实现同一已禁止作用。这里不把配置机制夸大为抵御被攻陷 Host/任意本机代码的安全沙箱。[S29][S03][S05]

**任务策略不可自行降级：** autonomous run 的有效策略绑定受控执行会话，而不是信任请求里的 `autonomous:true`。调用者省略该字段、改用 generic/HTTP 或切到所谓 interactive mode，不得绕过正在运行会话的禁止规则。结束该 run、变更策略或更换执行者必须有明确的控制面授权和审计；存在未决 mutation 时不能顺带清除隔离。

**实际构建：** 当前进程/Connector 上报 build identity、contract hash、activation；比对构建清单中的 CLI/daemon/Connector bundle/Skill 摘要。仅 `extension.json` 版本一致不够。运行任务期间固定这些身份；不在未决写或未保存状态自动升级。普通交互模式可保留既有版本告警政策，无人值守准入不能以 dev/patch 豁免跳过所需构建证据。[S12][S25][S26]

---
## 5. Finding → Architecture Mechanism 映射

机制简称：**M1** Action Contract/执行位置；**M2** Outcome/统一传播；**M3** 严格证据归一化；**M4** execution identity/互斥；**M5** no-blind-replay/operation；**M6** 恢复/隔离；**M7** ownership/provenance/跨域对账；**M8** 保存/制造/交付屏障；**M9** autonomous surface/策略/资格。它们对应第 4 节，不是九个新服务。

下表的“代码”是实施需求，不表示本次已经修改；“Host”指关闭相应资格边界所需测试。允许 defer 的项必须保留 finding、理由、被排除的 action/参数/依赖及阻断测试，不能记为 FIXED。

### 5.1 BLOCKER

| ID：原义与证据定位 | 类型 / 根因 | 推荐处置与机制 | 代码 | Real Host | 是否允许 defer | 阶段 |
|---|---|---|---|---|---|---|
| **B01**：`normalizeDrc/schematicDrcCheck/flattenDrcNodes` 可将未知返回转为零违规；非 verbose false 的全零统计不充分。不得扩大为 PCB DRC 同样分支。[S05] | D；R1 | 共享形状/覆盖验证后才能判 PASS；保留 unknown 和原始返回。M1/M3/M2。 | 是 | 是：真实有效零/非零；异常形状以 offline 注入证明。 | **否**；主链检查结果必须可信。 | A→C→E |
| **B02**：`schematicPowerConnectPin` 的首个 wire create 超时后直接再次 create；queue abandon 不取消原调用。[S05][S27] | D+A；R3 | 接入原 operation 和 native-write 边界；超时进入 UNCERTAIN；停止盲重发。M4/M5/M6。 | 是 | 是：可控延迟返回、原写晚完成；证明是否产生重复。 | **否**；可在修复前禁止该路径，不能留在自动主链。 | A→B→C→E |
| **B03**：普通多步 mutation 失败/派发错误后可能已写，却未统一失效 stage、stale、dirty 或提供恢复证据；Fast Path 有专项处理。[S03][S17] | A+D；R1/R3 | 所有副作用消费者基于 outcome/可能影响范围，不再基于外层 OK 或 Fast 特例。M2/M4/M6/M8。 | 是 | 是：代表性复合操作的部分失败、断连和 late completion。 | **否**；这是共通基础设施。 | A→B→D→E |
| **B04**：`requestMutates/isDryRunRequest` 接受任意 `dryRun:true`，但旧 line/via handler 仍真实写入。[S11][S05] | D；R1/R5 | 从 contract 验证 dry-run 支持；不支持则拒绝且零写；测试所有入口不能压掉 mutation 跟踪。M1/M2/M9。 | 是 | 是：小 fixture 零写 sentinel；主要逻辑用 offline。 | **否**。 | A→C→E |
| **B05**：`pcbAddComponent` 用全板 netless via 的位置包含推断 embedded ownership 并补网。[S05] | D；R2 | 限定原生 ownership/可信创建 provenance；不充分则不做派生写；不得破坏既有 sentinel。M7/M2/M6。 | 是 | 是：放置前已有的无关 via 不变。 | **否**；无法证明的子功能可禁用，不得继续启发式写。 | B→C→E |

### 5.2 HIGH：效果、目标、恢复

| ID：原义与证据定位 | 类型 / 根因 | 推荐处置与机制 | 代码 | Real Host | 是否允许 defer | 阶段 |
|---|---|---|---|---|---|---|
| **H01**：`pcbComponentAttrsBackfill` 按 C 号折叠来源、读失败按空处理，modify 未抛错即 updated。[S05][S15] | D；R1/R2 | 复用已验证 device 来源和属性 verifier；禁止从未知属性补写。M3/M7/M2。 | 是 | 是：同 C 多来源、Value、reload。 | 可将**整个自动回填能力**移出 surface；主链需要补值时必须有合格路径，不能绕回 C 号。 | B→C→E |
| **H02**：replace 已有 stage-before-delete，但 `rollbackComplete` 跳过 `otherProperty`；完整恢复及 rebind/多单元相关范围未资格闭合。[S05][S15] | D+A+Q；R2/R3 | 比较承诺的完整 preimage；电气完成单独验证；未知恢复不得宣称 restored。M2/M6/M7。 | 是；具体 rebind 变化取决于其实际路径，不按 replace 代码类推。 | 是：keepProperties、空值、方向、NC、失败恢复。 | 不可延后恢复结果真实性；不支持的替换/rebind 变体可执行前排除。 | B→C→E |
| **H03**：`boardRebind/pcbNewBoard` 有回滚失败吞掉、绑定查询失败仍创建等路径；rename/delete 结果不足以证明状态。[S05] | D+A；R2/R3 | 缺前置库存即拒绝；现有 Board 恢复使用确切 binding 读回；不得先破坏再发现无法恢复。M3/M6/M7。 | 是 | 是：工程树、绑定迁移、失败后保留范围。 | legacy `board.rebind/copy` 可 N；核心 new-board 不可用未知绑定继续创建。 | B→C→E |
| **H04**：`authoringResult` 五项名单及普通 CLI/MCP 返回码判定，不能统一传播 replace/titleblock/rename/save/pour 等不完整结果。[S04][S08][S10] | A+D；R1 | M2 共通投影，保留错误及所有 evidence；read、mutation、保存各按承诺判定。 | 是 | 是：少量真实结果做端到端；大部分组合用 offline 真值表。 | **否**；非迁移动作不可自动默认为成功。 | A→C→D→E |
| **H05**：CLI 独立预检查与旧 handler 写之间存在文档漂移窗口；事后 context 不能证明每笔目标。[S04][S05][S06] | A+Q；R2/R3 | 固定 tuple、入队后/逐写 guard、导航互斥、漂移隔离；承认 Host 原子锁边界。M4/M6。 | 是 | **必须**：双文档/双 registration 与切页。 | **否**；无法保护的 Host 配置移出 autonomous scope。 | B→D→E |
| **H06**：autosave 以窗口而非原文档调度，失败不可见、退出不 flush，不构成保存屏障。[S11] | A+D；R4 | 原文档 dirty、可观察保存结果、显式 save/reopen checkpoint；复用原 scheduler。M8/M4。 | 是 | **必须**：两页保存、失败、重开。 | **否**；不能宣传可恢复主链而缺保存证明。 | B→D→E |
| **H07**：`pcbImportChanges/clickImportConfirm` 已有自动确认，但依赖中文 DOM、等待可再点击，以 imported/count 替代映射证明。[S05] | D+A+Q；R2/R5 | 单次副作用与只读等待分离；固定 build/locale 兼容范围；验证完整 SCH→PCB diff。M1/M4/M5/M7/M9。 | 是 | **必须**：添加/删改替换/改网，含总数量不变。 | 其它 UI/Host 组合可 N；**不能延后核心同步资格后仍声称全主链可用**。 | B→C→E |
| **H08**：约束未知读转空；net 前置读取失败跳过；rename/group 对比不完整。[S05] | D；R1/R2 | M3 严格库存与完整集合验证，M2 保真传播。 | 是 | 是：约束创建/删除/成员/重载；unknown shapes offline。 | 不可延后结果真实性；可不资格化非必需约束变体。 | A→C→E |

### 5.3 HIGH：surface、耐久性与资格

| ID：原义与证据定位 | 类型 / 根因 | 推荐处置与机制 | 代码 | Real Host | 是否允许 defer | 阶段 |
|---|---|---|---|---|---|---|
| **H09**：`pcb.route.via_hop` 真实生成铜但未声明 routing gate。[S01][S17][S05] | D；R5 | 从 action effects/依赖覆盖路由 gate；原始/复合入口相同准入；禁止逐入口独立名单。M1/M9。 | 是 | 零写拒绝做一个端到端 sentinel；主要 offline。 | 不可延后绕门防护；via_hop 整体可 N。 | A→C→D→E |
| **H10**：Fast Path 支持 add_arc，无正常 delete_arc；delete_trace 不接受 kind=arc；catalog enum 落后。[S01][S06][S07][S18] | A+D+Q；R3/R5 | 默认先将**arc 写入/arc90 自动调谐**排除；规划/预检/执行一致阻断，已有 arc 观察保留。M1/M9。 | 是：契约/边界收口；默认不扩展几何能力。 | 排除边界验证；若以后闭合正常 arc 生命周期则必须重做实机增删/重复调谐/量化资格。 | **允许**；必须声明有界 line/via scope，不称全角型合格。 | A→D→E |
| **H11**：plane.refresh/drc.compare 为 CLI composite，generic/daemon 不等价；report/manufacturing 证明强度不同；MCP 缺 library 域。[S02][S08][S09][S30] | A；R5 | 明示 executor、共用 CLI 路由、daemon 明确拒绝不承接入口；补现有身份读取入口。M1/M9/M2。 | 是 | 入口 parity 主要 offline；主链实机只需代表路径。 | 广泛 library 写入可 N；核心能力入口不等价不能隐藏。 | A→D→E |
| **H12**：patch/dev 版本门不证明同构建；同 semver 旧激活、上游升级来源与当前 fork 的关系未闭合。[S12][S22][S25][S26] | A+Q；R5/R4 | 任务固定实际构建/合同/activation，显式发布源，升级前屏障；不删除正常交互版兼容政策。M9/M4/M8。 | 是 | **必须**：同版不同 bundle、重新激活、双 registration。 | **否**；具体未支持平台可排除并注明。 | A→D→E |
| **H13**：制造结构成功条件要求 PTH/NPTH 均有实际孔，误拒合法 zero/单类库存。[S13] | D；R4/R1 | 用完整期望库存区分零与缺失；复用现有钻孔解析与 manifest。M3/M8。 | 是 | 是：zero/PTH-only/NPTH-only/mixed。 | 核心格式下**不允许**；不支持 slot 方言可以 N。 | C→D→E |
| **H14**：几何快照新鲜度不包含完整 BOM/PnP 属性，不能证明多文件完整源版本一致。[S07][S13][S14] | A；R4 | 制造用途语义 fingerprint、导出范围冻结/前后对账、文件库存验证。M7/M8。 | 是 | **必须**：属性-only 变更与缓存/重载。 | **否**；否则只能交付“文件结构已检查”，不能资格化制造终点。 | D→E |
| **H15**：`pcbOutlineSet` bbox 读取失败被忽略，outside 为空仍能 allInside。[S05] | D；R1 | expected/checked/unavailable 覆盖证据，未知不通过。M3/M2。 | 是 | 是：已知越界对象；读失败主要 offline。 | **否**。 | C→E |
| **H16**：批量 move/arrange 与原始 line/via 回显计划/计数，缺独立真实读回；不代表单件 modify 的已有 verifier 也缺失。[S05] | D+A；R1 | 复用单件/原生几何 verifier，统一 declared effects 与 required 字段；未覆盖批量 helper N。M1/M2/M3。 | 是 | 是：层/锁/坐标与量化。 | bulk arrange 等可 N；选定主链写入不得无验证。 | C→D→E |
| **H17**：`persistArtifacts` 落盘失败只 warning，Host 已生成不等于本地已交付。[S03] | D；R4/R1 | artifact delivery 状态、必要文件完整发布、错误保真；复用原 artifact 持久层。M2/M8。 | 是 | 文件系统失败可纯 offline；实机验证真实 File → 本地字节链即可。 | **否**；不得返回缺文件的交付成功。 | D→E |
| **H18**：activation 内有界 ledger/缓存 receipt 不能证明跨重载未决恢复；2048 上限不是内存泄漏证据。[S06][S28][S05] | A+Q；R3/R4 | 原 audit intent/receipt、容量预算、checkpoint/resume、未决不能随 session 清除；保留有界拒绝。M5/M6/M8/M9。 | 是 | **必须**：有限 soak、已保存与未决窗口恢复；边界计数 offline。 | 不可延后当前受支持任务的恢复/容量边界；更大规模可限定。 | B→D→E |
| **H19**：disabled-action 为各进程配置/发现过滤，不是所有执行边界一致强制；不是已证实的远程入侵。[S29][S03][S05] | A；R5 | canonical policy 在 daemon/Connector 受支持边界一致，别名/复合依赖不能逃逸；run policy 不能由调用者自行降级。M1/M9。 | 是 | 一个真实 sentinel 覆盖拒绝；完整多入口逻辑 offline。 | **否**；隔离非 autonomous 能力依赖它成立。 | A→D→E |
| **H20**：typed 身份兼容可能调用只读 `debug.exec_js`，与 Skill 的显式调试许可边界不同。[S16][S22] | A+Q；R2/R5 | 当前 typed resolver 优先；缺能力则明确拒绝/升级，旧 compat 限于非 autonomous；不增加任意 JS 白名单兜底。M1/M7/M9。 | 是 | 是：debug 禁用时身份主链可工作，来源恢复跨 reload。 | **允许保留 legacy compat**，但不可隐藏为 autonomous 依赖。 | B→D→E |
| **H21**：方向 probe 删除失败仅日志、检测失败回默认值；普通 rotate/cmdKey 的当前 Host 行为未定案。[S05] | D+Q；R1/R3/R5 | probe 纳入 outcome/ownership/恢复；未知方向不缓存为已知。普通旋转仅据当前 Host 资格决定支持。M2/M3/M6/M9。 | probe：是；cmdKey：**不先猜补丁**。 | **必须**：四象限/mirror/多单元/reload；探针残留注入。 | probe 安全处理不可 defer；未合格旋转变体可 N，任务准入提前拒绝。 | C→E |

### 5.4 默认 deferred / non-autonomous 范围

默认排除 raw `debug.exec_js`、autoroute/SES 导入、自动布线/自动改几何 helper、未资格化的永久库写入、未闭合恢复的 Board rebind/copy、任意 bus/hierarchy 扩展、未支持的 negative-plane/custom geometry、arc 写入/arc90 自动调谐和未测 Host/locale 分支。仅存在额外读取限制的 region name、fillMode、via barrel/delay 等，保留明确未知/不可验证字段，不把字段缺证据升级为 CAD 改造任务。[S01][S07][S21][S23]

**H10 的最小方案裁决：** 本计划默认不新增公开 `delete_arc`，也不重写 Fast Path。创建后无法从合格路径正常返修的 arc 写入不进入本次 autonomous scope。若实施范围以后明确要求 arc，必须单独接受“利用已有 `nativePort.remove('arc')` 闭合现有 arc 生命周期”的增量范围，并通过 Q08/Q09；那是已有能力生命周期收口，不是新增 router。未接受前不得擅自扩项。

所有 defer 都必须有可自动验证的“进入前拒绝”结果；不能让 Agent 执行到一半才从文档里发现不支持。任务明确需要 excluded capability 时，返回该任务不符合当前 autonomous profile，而不是偷偷换 legacy 路径。

---

## 6. 分阶段实施计划

### 6.1 顺序、提交与验收纪律

```text
Stage A  Execution Contract
    ↓  已接受 commit
Stage B  Target Identity + Recovery
    ↓  已接受 commit
Stage C  P0 Correctness
    ↓  已接受 commit
Stage D  Persistence + Autonomous Surface
    ↓  已接受 commit
Stage E  Qualification
```

每阶段可形成一个候选提交，必要时做同阶段返修。阶段锚点为**已接受 commit hash**，不使用 Git tag。提交信息使用中文，不加 `feat:` 等前缀。候选提交存在不等于已验收；未接受不得进入下一阶段。

本计划不要求重置可能已经前移的工作区。实施前确认实际 HEAD 与审计基线的关系；只对阶段相关模块做差异确认，不重开全仓审计，也不静默跨过未知提交。若用户另有已接受基线，以其明确提供的 commit 为准并更新阶段记录。

Stage A–D 的通过只表示相应工程边界成立；不能开通生产 autonomous run。隔离 fixture 的资格执行通道不等于放宽正式准入：限定 fixture UUID、构建与允许步骤，不能访问 G474，不能绕过身份、禁止重放、已有设计门控等保护。

### Stage A — Execution Contract

**目标：** 建立一套所有层都能解释的执行合同；先消除“旧响应默认成功”的接口基础，不急于修复所有 handler。

| 项目 | 内容 |
|---|---|
| **Scope** | 扩展 ActionSpec/Request/Response 的契约；区分 effects/executor/dry-run/verification；实现统一 outcome 解释与 CLI/MCP 投影；让现有 writeHealth/`effectFromResponse` 消费同一语义；未迁移能力默认不具备 autonomous eligibility。 |
| **Likely files/modules** | `internal/protocol/actions.go/actions_closure.go/envelope.go/disabled_actions.go`；`extension/src/protocol.ts`；`internal/daemon/dispatch.go/writehealth.go`；`internal/app/dispatch.go/write_verify.go`；`mcp/src/core.mjs/authoring-result.mjs/fast-path.mjs/server.mjs`。复用对应已有测试，必要时在这些模块增加 contract tests。 |
| **Invariants** | resp.OK 与 mutation outcome 分离；UNKNOWN/字段缺失不变 COMPLETE；partial/uncertain 原证据不丢；不支持 dryRun 执行前拒绝；executor 不存在或合同不匹配时拒绝；相同结果各入口解释相同；不把健康计数升格为资格。 |
| **Offline tests** | outcome 真值表覆盖 `OK` 真/假、native false/undefined、verified 缺失/false、partial/notApplied、stale、save false、artifact 缺失；Go↔TS enum/schema parity；MCP/CLI result parity；Fast Path 历史结果兼容；不支持 dryRun 零 native 调用；catalog/executor/依赖声明一致性。 |
| **Host tests** | 阶段本身不要求 CAD mutation；可读取 health/build/当前信息检验 wire compatibility。无真实 Host 时明确 `OFFLINE_ONLY`，不得扩大资格。 |
| **Exit criteria** | 有且只有一套正式合同与结果映射；原有 Fast Path 状态/响应证据未被压缩丢失；现有健康统计通道仍工作且不重复计数；legacy 行为有清楚兼容处理；autonomous 发布开关仍未启用；提交范围与测试记录可审查。 |

**Stage A 特别禁止：** 同时改库解析、Board 重绑算法、导入 DOM、所有几何 handler、保存系统。可以定义它们将消费的合同，但不要提前跨阶段修复。不得将“全部 action 填上 `verified=true`”当作迁移。

### Stage B — Target Identity + Recovery

**目标：** 同一个业务写在正确执行对象上最多进入原生写一次；失去结论后有可追踪、安全阻断的恢复路径。

| 项目 | 内容 |
|---|---|
| **Scope** | 入队后/逐写 identity guard；复用 hub、非重入准入、FIFO 实现排他归属与导航栅栏；复用 Fast/lifecycle/replace operation/receipt；原 audit 写前 intent 与晚完成记录；现有 `/writeverify` 严格证据 amendment；PARTIAL/UNCERTAIN 隔离与 owned compensation 边界。 |
| **Likely files/modules** | `internal/daemon/dispatch.go/fastpath.go/queueblock.go/writehealth.go/stagegate.go`；现有 hub/connection 与审计存储实现；`internal/workflow` 的执行准入引用；`extension/src/actions.ts/action-queue.ts/deadlines.ts/lifecycle.ts/component-source.ts`；`fast-path.ts` 只作合同适配，不重写核心；`internal/app/dispatch.go/write_verify.go/queue_blocked_retry.go`。 |
| **Invariants** | mutation 使用原 target 而非新 current；导航不能穿插受保护写；过期 queued write 不得晚执行；timeout/disconnect 不等于 NO_WRITE；same ID 异 payload 拒绝；receipt 查询不重放；隔离不会因环形样本淘汰或重连消失；没有所有权证明不做 destructive recovery。 |
| **Offline tests** | 双 registration/文档 ABA 漂移；queue 等待超预算；第一笔 write 返回前断连/抛错；首/中/末步骤失败；原生调用晚完成；receipt 重入及签名冲突；跨 daemon restart 的 unresolved intent；审计 append/flush 失败不派发；`writeverify` 缺身份/旧 activation/重复 evidence 不能解封；健康恢复不清 quarantine。 |
| **Host tests** | F0/F1 的双页 sentinel、固定窗口写、受控切页；小规模延迟传输/断连后只一次 mutation；验证 owned cleanup 与恢复 identity。只在隔离 fixture；异常形状注入仍归 offline，不冒充原生行为。 |
| **Exit criteria** | 已迁移代表性原始/复合 mutation 证明目标与 operation 归属；失败能明确 NO_WRITE/PARTIAL/UNCERTAIN；未知调用未被重发；隔离状态可恢复读取且不能自动清除；Fast 原去重/guard/补偿回归未退化。尚未实现的 save/reopen 屏障不被声明已经具备。 |

**阶段边界：** B 必須保证“崩溃后保留未决并拒绝新写”，不能把这一点推迟到 D；D 才完成基于保存检查点的自动恢复闭环与容量管理。B 不承诺所有旧 handler 都已迁移，未迁移者保持非 autonomous。

### Stage C — P0 Correctness

**目标：** 用 A/B 的共通机制修复已确认错误模式，关闭主链假成功和改错对象风险；不是给每个 action 单独打补丁。

| 项目 | 内容 |
|---|---|
| **Scope** | 共享 UNKNOWN/EMPTY 解析、完整集合/属性/几何验证、source/ownership 解析；迁移主链 handler；移除 connect_pin 超时重发；probe 纳入事务步骤；强化 replacement/Board 已有恢复；一次性 UI apply 与无副作用等待分开；SCH→PCB 映射对账；依据 effects 补全 route gate；制造 expected 库存。 |
| **Likely files/modules** | `extension/src/actions.ts/util.ts/component-source.ts/native-footprint-source.ts`；已有 verifier 如 `propertyApplied/verifyPcbComponentPatch/matchesOperation`；`internal/app/sch_device_identity_compat.go` 及既有 connectivity/design-diff/Apply 模块；`internal/protocol/actions.go`；`internal/app/pcb_manufacturing.go/pcb_drc_compare.go`；对应 Connector/Go 测试。函数搬移可为复用服务，但不大拆重构全部 actions.ts。 |
| **Invariants** | 未知 DRC/库存/bbox 不通过；完整目标集合与字段才 COMPLETE；C 号不替代来源；sentinel 不被派生赋网；rollbackComplete 不跳过属性；未决创建不再触发第二次创建；probe 无残留或明确不完整；导入数量不能代替映射；core 路由入口一致门控。 |
| **Offline tests** | DRC 各已知/未知形状；合法空集与读取失败；额外/缺失约束成员；bbox 部分不可读；Value `""/null/0/false/missing`；同 C 多来源；库消耗属性改变；原生 modify 仅回显输入但实际没改；无关 via 位置相同；replace 恢复属性丢失；DOM 等待不二次点击；B01–B05 反例回归；gate/dryRun 各入口零写。 |
| **Host tests** | 复用 F1/F2 运行 Q03–Q07 和 Q11 的主路径：四象限/mirror、多单元、Value/来源重载、replace 恢复、wire/NC、电气映射、越界/锁/层、有效 DRC zero/nonzero。G474 不参与。 |
| **Exit criteria** | B01–B05 的相关机制反例关闭；每项主链 required postcondition 有对应 verifier/测试；H01/H02/H03/H07/H08/H09/H15/H16/H21 要么关闭所选范围、要么硬排除不可支持变体；无新增启发式 ownership/大 epsilon/静默回退；未获得 Host 证据项明确保留 Q。 |

**避免逐 action 打补丁的验收要求：** 新逻辑至少形成可复用的“结果形状与覆盖”“属性/集合对账”“目标所有权”“复合步骤结果”适配方法，并由不同 action 的反例调用同一方法验证。必要的逐 handler 接线和 required 字段声明允许；复制 N 份 catch/布尔猜测不允许。

### Stage D — Persistence + Autonomous Surface

**目标：** 从“本次写可说明”推进到“已保存、可恢复、明确限定的任务执行面”。

| 项目 | 内容 |
|---|---|
| **Scope** | 原文档 autosave/显式屏障；save/close/reopen 证据；partial salvage 与 clean checkpoint 分离；artifact 可靠交付；制造语义源指纹和库存；操作 intent/receipt/checkpoint 的保留与容量预算；catalog 派生 surface/executor 路由/依赖；实际 build/activation；有效禁用策略；旧 debug compat 和可 defer 变体排除。 |
| **Likely files/modules** | `internal/daemon/autosave.go/stalereads.go/dispatch.go/writehealth.go`、现有 audit/hub 生命周期；`internal/app/cmd_doc.go/cmd_doc_settle.go/pcb_manufacturing.go/pcb_plane_refresh.go/observed_content.go/version_gate.go`；已有更新/Skill 同步入口；`extension/src/protocol.ts/transport.ts/actions.ts/component-source.ts`；catalog、MCP 的 core/server/workflow/fast-path 投影、Skill references。路径为预计接入点，不表示所有实现都已审完。 |
| **Invariants** | 原页 dirty 不被其它页 save 清掉；UNKNOWN 不自动 save/close/升级；保存返回 false 不成功；reopen 用正确身份与完整必要状态验证；checkpoint 不自动通过 design gate；artifact 缺失不交付完成；制造属性-only 变化使 package 不合格；policy/capability 不能由单个请求降级绕过。 |
| **Offline tests** | 两页 autosave 竞争、退出/断连、save false/undefined；写前/写后/receipt前/checkpoint前崩溃矩阵；文件不可写/磁盘满/截断日志；最后一份 manifest 发布前失败；zero/单类/mixed 孔；metadata-only fingerprint；same semver 不同 build；未迁移 action/内部 dependency/参数变体拒绝；ledger 2048/2049、过期 receipt/重复 ID与保留策略；CLI/generic/MCP/HTTP surface parity。 |
| **Host tests** | Q01/Q02/Q10/Q12 的集成路径及所有必要 save/reload；关闭后重新打开 SCH/PCB；运行中配置/build漂移只安全停止；debug 禁用下正式身份/reload路径；零孔与单类孔真实导出。 |
| **Exit criteria** | 可重复生成当前范围 checkpoint 和合法制造包；明确报告不可恢复的未决操作；surface、内部依赖、策略、实际构建一致；所有 deferred 项有提前拒绝测试；无独立新事务 DB/第二个 autosaver/第二套 routeAllowed；生产 qualification 尚未自动授予。 |

**容量处理裁决：** 保留既有 Fast Path 上限，不通过任意清空事务表扩大容量。先以批处理和剩余额度保证所声明任务预算；有合格 checkpoint 且无未决写时才允许已验证的 activation 轮换/恢复。若 Connector 的重连不等于重新激活，应按真实 Host 行为记录，不能把两者混写。没有可靠轮换路径时声明单 activation 预算，超过预算的任务不准入，而不是跑到一半才碰壁。[S06][S27][S28]

### Stage E — Qualification

**目标：** 用有限小 fixture 证明所选 scope 的功能、耐久性、恢复和长期行为，产出可追踪 evidence；不再改一大批运行时代码。

| 项目 | 内容 |
|---|---|
| **Scope** | 第 7 节的四层测试与七组小 fixture 运行；固定实际构建/Host/locale/作用域；原始响应、独立读回、checkpoint 与资源趋势；逐 finding closure/deferred 记录；发布资格矩阵。 |
| **Likely files/modules** | 既有 `docs/revb-closure-acceptance.md`、现有测试/fixture 模块、MCP stdio 测试、Connector 和 Go contract tests、独立生成的验收 evidence 目录。历史记录只追加对照，不把旧记录改造成新通过。 |
| **Invariants** | offline 不冒充 Host；功能成功不冒充持久成功；安全停止不冒充自动恢复完成；限定参数子集不冒充整个 action；资格绑定真实 build 而非源码 bool；全部用例不能访问 G474。 |
| **Offline tests** | 全部新增故障注入、scope/依赖/策略/结果 parity、原 Fast Path 回归、证据文件 schema 与 hash 校验；补全本次候选 surface 的 CLI/Skill 声明对照。 |
| **Host tests** | 完整执行资格包 HF/HP/HL；选定必要功能两次独立运行；Q13 有限轮次恢复与长时档分开出证据。 |
| **Exit criteria** | 每条核心工作流边都有当前匹配的 functional、所需 persistence 与 recovery evidence；未验证能力不能出现在 qualified scope；无 unsafe bypass/人工修板污染；报告实际人工介入次数与所有未决停止；独立审查接受资格包及候选 commit。 |

Stage E 若发现源码缺陷，应停止该 scope 的资格认定，回到对应 A–D 阶段做明确返修提交，再重跑受影响证据。不能在验收过程中隐式热修、维持旧 build 标识、继续使用原“已通过”记录。

### 6.2 每阶段交付与审查输入

每阶段交付：基线与候选 commit、变更文件清单、机制级变更说明、invariant→test 映射、实际执行命令与结果、Host evidence（如适用）、仍开放/隔离的 finding 和明确的下一阶段边界。不得只提交“测试全绿”的摘要。

**通过依据：** 实际运行的新回归与既有机制回归、独立检查、对应 artifact 的哈希与版本归属。测试文件存在、注释写“verified”、模型判断“应该没问题”，均不构成通过。

---
## 7. Qualification strategy：最小但有效的真实 Host 资格包

### 7.1 四类证据必须分账

| 层级 | 证明什么 | 不能证明什么 | 运行位置 |
|---|---|---|---|
| **OF — offline fault injection** | 协议/守卫/outcome 的逻辑、失败传播、去重、崩溃记录、文件系统错误等。 | 不能证明当前 Host 真正支持 API、具有某种异常返回或持久语义。 | Go/TS/MCP 现有测试环境、假 NativePort、受控文件系统/传输 adapter。 |
| **HF — real Host functional qualification** | 真实激活构建在所选 Host/locale/参数下执行了正确目标与动作，native readback 与独立 oracle 相符。 | 不自动证明保存后还在、长期不退化或所有参数变体支持。 | F0/F1/F2 的独立真实工程；记录 raw response。 |
| **HP — persistence qualification** | 保存、关闭、重开后，同一工程/文档的完整承诺状态仍可验证，身份能重新解析。 | 不自动证明断电原子性、云端同步、跨机器或插件配置丢失恢复。 | 在 HF 的终态和已知 PARTIAL/恢复终态上复用 fixture。 |
| **HL — long-run/resume qualification** | 在实际运行预算、会话切换和受控故障下资源可控，未决状态不丢，已保存状态可恢复。 | 有限轮次不能自动证明 10–20 小时；安全停止也不等于恢复后自动完成。 | 复用小 fixture 的固定轨迹，不使用整板 benchmark。 |

OF/HF/HP/HL 是测试证据分类，不是源码里的资格布尔值。任一类缺失，报告具体缺口；不能用另一类代替。[S23][S24]

### 7.2 三个基础 fixture

| Fixture | 最小内容 | 复用目的 |
|---|---|---|
| **F0 — Runtime/Home** | Home 无工程；一个独占 registration 与一个可区分第二 registration；两个已知测试项目；若声明 Team/Folder 支持，另准备明确 scope。 | 部署、归属、生命周期、切换、禁用策略、重连。 |
| **F1 — Schematic** | 两页可区分 sentinel；2–4 个普通器件与一个多单元器件；可实际取得的同 C 不同来源候选；非空/显式空 Value；wire、T 连接、交叉不连、power/netflag、NC。 | 身份/属性/方向/替换/恢复/连通及保存重开。 |
| **F2 — PCB coupon** | 与 F1 对应的小型 PCB；直线/45°线/through via、锁定/越界对照、凹边板框、无关 netless via sentinel、两个有明确身份的 pour；孔库存四个预设变体。 | 映射、所有权、布局/gate、Fast、测量、Plane/DRC、制造。 |

fixture 名称不是授权证据。资格 harness 绑定**实际 project/document UUID allowlist**，每次 native write 前检查；不允许以“名字包含 TEST”决定可写。fixture 创建/复位也走受控既有机制；失败复位不得静默改变原测试条件。

同 C 多来源必须使用真实 Host 能读取的候选；本环境找不到候选时该子场景标为 fixture 不足/未验证，不能将 mock 搜索结果伪装为 HF。PTH/NPTH/zero-hole 变体是预先定义的库存，不为迎合 exporter 的非零条件临时添加孔。[S13][S23]

### 7.3 七组 Host 运行，保留原 Q01–Q13 的全部判据

只合并 fixture setup 和保存重开步骤，不删除原 Q 的 oracle。以下七组通常各跑两次独立 functional pass；失败注入不必对每个 action 做全排列，而按**每种执行机制与副作用类别**覆盖代表路径，并对已确认专门反例保留回归。

#### HF-1 — 部署、Home、项目生命周期（Q01、Q02）

**Setup：** F0；固定 CLI/daemon/Connector/Skill 构建清单、Host 版本、locale。包含同 semver 不同 bundle、唯一/双 registration、Personal root；Team/Folder 仅在声明支持时加入。

**Action：** health/capability 发现；Home current/list；create/open；首次 schematic 与 page create/open；再切换到另一个测试项目。

**Expected readback：** 实际 activation/build 与合同匹配；Personal scope 不从 owner UUID 误推成 Team；创建/页 settle 完成有准确 UUID 和实际库存；歧义无写拒绝。MCP 所列入口实际可执行，CLI composite 不被盲转 Connector。

**HP：** 明确保存各页后关闭/重开，项目与页面身份一致；同一名称下不选错另一个对象。

**Failure/transaction：** same ID/same payload 不创建两次；同 ID 异 payload 拒绝；name-only create 在 timeout 后不换 ID 重建；禁用动作在 typed CLI、generic call、MCP、受支持 daemon 和 Connector 边界都不得修改 sentinel。热更新造成身份变化则旧运行许可失效。

**Closure：** H05/H11/H12/H19/H18 的生命周期与入口部分。歧义下安全拒绝只证明 safety；若本次任务要求自动恢复归属，必须另有成功恢复证据。

#### HF-2 — 来源、原理图编辑、连接与替换恢复（Q03、Q04、Q05）

**Setup：** F1；保存逐器件 source/library/instance、属性、方向、subpart、pin/NC/net 的黄金表。正面样例包含 `keepProperties=false/true` 与显式空值。

**Action：** 现有 search/device.get/place/modify；四象限 rotate/mirror；wire/power/NC；兼容 replacement；对不兼容 pinDiff 或无法完整恢复变体在执行前拒绝或明确留下非电气完成结果。

**Expected readback：** 不是只看 primitive 存在：字段、来源、pin 坐标、NC/连接全覆盖；probe 归零；普通 rotate 不出现 `cmdKey`/command-context 问题。若仍出现，保留原始错误及配置，不能临时使用 debug JS 让测试“继续成功”。

**HP：** 成功终态、已知 PARTIAL salvage、已验证恢复态分别重开对账；插件 source receipt 不可用的情形不得按同 C 号静默重建身份。

**Failure/transaction：** OF 覆盖创建返回前、目标暂存后、删原件后、属性写后、恢复写后的失败；HF 用受控传输延迟验证原请求确实晚完成而不再创建第二份。无关页 sentinel、未知暂存 ID、probe 清理失败都保留证据。无法控制 Host 内部特定失败点时，只记录对应 OF 覆盖，不声称 HF 已测。

**Closure：** B02/B03、H01/H02/H04/H20/H21；Q05 连通性不能只靠 DRC 数字证明。

#### HF-3 — SCH→PCB、对象归属与布局门（Q06、Q07）

**Setup：** F1→F2；第一轮导入后记录完整双域 join。第二轮含添加/删除/改封装/改位号/改 net，至少一个场景总器件数不变；预先放置无关无网 via。

**Action：** import changes；必要的已有 PCB add path；单件与所选批量 move/rotate/layer/lock；outline/keepout/stackup 变化；未过门时调用各路由入口。

**Expected readback：** import 的 apply 至多触发一次；完整 `uniqueId/source/footprint/pad/pin/net` diff 达到期望；没有把无关 via 补网；板框 expected/checked 数量明确；未知 bbox 不是 allInside；routeAllowed 的实际依据与 stage/stale 一致。

**HP：** 两域分别保存重开；gate 不凭旧本地文件自动通过；目标对象的身份与完整属性继续一致。

**Failure/transaction：** DOM 缺按钮/不支持 locale、import 延迟、部分 target 缺失、modify 只回显不落地、unsupported dryRun、via_hop 绕门反例。假的 Host 行为注入归 OF；真实 Host 操作及原始 UI/API 结果归 HF。

**Closure：** B04/B05、H03/H07/H09/H15/H16；同步没有合格路径则不能资格化全主链。

#### HF-4 — Fast 事务、约束与测量（Q08、Q09；覆盖 H08）

**Setup：** F2 固定走廊、明确 target span/net、保护网和锁对象；固定 W/H/目标/容差；through via；可选 profile 的规则/layer 绑定记录。

**Action：** 既有 snapshot→preflight→apply；正常删除/创建线与 via；same ID 重入与 payload 冲突；line45/line90 的 single/bilateral；pair_plan；已有约束创建/改名/成员变化/删除。未纳入 scope 的 arc 写入和 arc90 计划必须在执行前拒绝。

**Expected readback：** COMPLETE 对 net/层/几何/宽度/孔径/删除消失有独立证据；constraint 对完整集合；测量使用原生实际几何，不复用 planner 输出当 oracle。经普通读取引起的保守 epoch 变化按现有 Fast 协议处理，不能削弱 revision gate。

**HP：** 重开后取新 ID/revision，重新测量并再做一次调谐；旧 receipt 标为历史结果；旧 token 拒绝不能替代原操作结果恢复。

**Failure/transaction：** OF 覆盖每类首/中/末 native 写和 readback/deadline；HF 选一个传输断连/晚响应场景；未决不换新 ID，删除不能恢复不称 rollback complete。若后续获准 arc scope，追加 `±90° + Host 量化 + 正常删除 + 二次调谐` 的 HF/HP，不能仅通过 add_arc。

**Closure：** H08/H10/H18 与既有 Fast 强语义不退化。缺物理 via barrel/package/delay 时保持 unresolved，不为资格测试开发新测量算法。

#### HF-5 — Plane 与原生 DRC（Q10、Q11）

**Setup：** F1/F2 的确定非零违规状态及可取得有效零违规的微型状态；两个不同 logical pour；同名/缺失/ID remap 反例；记录 rules 与完整目标 scope。

**Action：** pour create/list/refresh/rebuild；DRC baseline/full/delta；改变规则使旧比较不可用；修复一个已知违规并重查。

**Expected readback：** logical handle 解析明确，逐 item 失败完整上传；重建不等于 connectivity 已知。只有真实完成、形状可解释的 DRC 才能判零；false/unknown 不能给全零 PASS；new/cleared/persistent 与已知变化一致。

**HP：** 重开重新解析 pour 和完整 DRC scope；旧 baseline 的兼容条件再次检查；不以重载发生过就认为 DRC 仍有效。

**Failure/transaction：** `null/undefined/{}/未知节点/读取异常` 是 OF matrix；HF 验证该 Host 的真实 zero/nonzero、重建与超时行为。不能伪造 Host “返回过 undefined”的记录。晚重建未 settle 时不得继续其它相关写或最终制造。

**Closure：** B01/H08/H04 及 Plane 证明边界；未完全证明 connectivity 的字段继续是 unknown。

#### HF-6 — 制造与本地交付（Q12）

**Setup：** F2 的 zero-hole/PTH-only/NPTH-only/mixed 四变体；确定层清单、BOM/PnP 库存及至少一个可观察 Value/BOM flag 变化。

**Action：** 原生 Gerber/Drill/BOM/PnP → 本地持久化 → 结构/hash/库存/源版本检查 → 最终 manifest。

**Expected readback：** 应为零的孔库存合法；应有孔不得漏；原生 layer/钻孔类别/位号/数量/坐标/旋转与语义源快照相符；缺必要文件或字段不生成合格交付；各层只声称自己验证的内容。

**HP：** 保存重开后再导出；按稳定设计内容比较，不强求包含时间戳等非设计字段的文件逐字节相等；记录差异原因、源 fingerprint 和每个实际文件 hash。

**Failure/transaction：** OF 注入目录不可写、磁盘满、截断 File、损坏 ZIP/CSV；HF 验证真实文件落盘链。导出之间尝试属性-only 修改：受控并发应被拒绝；另一个可控变更场景必须使源一致性失败。旧文件不能被当成新交付。

**Closure：** H13/H14/H17；只能给出 package 所承诺的结构和源一致性资格，不越权声明 DFM/时序/阻抗合格。

#### HL-7 — 长期运行与恢复（Q13）

**Setup：** 复用 F0/F1/F2，固定运行轨迹及初始内容摘要；记录真实 build、Host 前后台状态、有效 registration、原生在途操作、receipt 使用量、进程/内存/文件预算。

**Action：** 固定小批读写→对账→检查点→跨页→save/reopen；在“已确认检查点”和“已发出但未定案”两个窗口做断连/daemon 重启/受控 Connector 重新激活。

**Expected readback：** 检查点恢复保持内容与来源；未决恢复不重发旧 mutation、不自动清 gate；每轮 sentinel、对象数和业务 fingerprint 与预期一致；无额外孤儿子进程、活跃 registration 或无限内存状态增长。

**HP/resume：** 先按已知身份找原目标；以旧 intent+receipt+合格当前观测决定 COMPLETE/PARTIAL/UNCERTAIN。无法定案的恢复应保留隔离，并在报告中计为未完成恢复，不能算该场景自动完成。

**Failure/transaction：** queue abandon、延迟响应、save 失败、receipt 容量将尽、日志/临时文件预算耗尽、同版异构建接入。旧样本/旧 activation 的迟到 evidence 不可修改新操作的结论。

**两个明确档位：**

- **HL-bounded：** 建议继承原 Q13 的 100 轮、每轮 50 次读、8 个小批及一个可验证检查点，共 800 个业务批次；实际 intent/retry/ledger 占用另计。2048/2049 等容量边界离线精确覆盖，不能在真实工程上靠耗尽账本“试恢复”。该档只证明实际轮数/操作预算，不自动证明 20 小时。
- **HL-duration：** 要声明覆盖 10–20 小时无人值守，必须另记录达到声明时长的真实 Host 驻留、周期操作、前后台与恢复事件；沿用同一小 fixture，不必设计大板。测试前固定时长档、最大 action/native-call 数、资源上限及安全停止条件；没有完成这一档就只公布 HL-bounded。本文没有执行或承诺已经执行这些测试。

资源判据不得事后放宽。receipt 不超过契约上限；已完成 child process 不残留；活跃 registration 回到预期数量；checkpoint 后临时文件可回收；日志作为证据允许受预算约束的线性增长，不要求总文件字节永远不变。内存需预先固定暖机基线与可接受增长预算，实际采样缺失不得填 PASS。连续完全未 settle 的 Host 行为不能用定时清空隔离来“通过 soak”。

### 7.4 Qualification evidence 的最小记录

每个证据包至少包含以下信息，字段名可以复用既有报告模型：

| 证据组 | 必要内容 |
|---|---|
| 构建身份 | repo commit、dirty 状态或实际源码摘要、CLI/daemon 二进制摘要、Connector bundle 摘要、实际 activation、contract hash、Skill 摘要、Host build、平台与 locale。 |
| 范围 | action/operation/参数子集、关键依赖、公开入口、fixture project/document UUID、允许及禁止目标；不只 action 名。 |
| 执行 | operation/parent/request ID、输入 hash、开始/结束、原始 Host 响应/错误、步骤与 native 调用计数（不可观测时写明 unavailable）。 |
| 验证 | 独立 oracle、required/observed/missing 覆盖、原生 fresh readback、pre/post scope 与 fingerprint、差异和容差来源。 |
| 恢复 | timeout/disconnect/late evidence 的事件顺序、quarantine 与解封依据、同 ID 无重放、恢复前后对象归属。 |
| 持久与交付 | 保存结果、close/reopen 结果、来源 receipt 可用性、检查点、artifact/manifest 实际路径与 hash。 |
| 判定 | OF/HF/HP/HL 分别结果、未测/不支持/安全停止、实际人工介入、审查者接受记录及日期。 |

Build 变化后，不必声称全部旧证据无价值，但不得无条件把它改名为 CURRENT。允许在独立审查下按受影响合同/依赖建立证据继承记录；核心执行/持久化/身份逻辑变化须重跑受影响 HF/HP/HL。继承关系本身是可审查资料，不是源码自动把布尔值置真。

### 7.5 最终判定与不可替代的失败条件

**安全资格**与**任务完成资格**分开：某用例正确返回 UNCERTAIN 并保护工程，可证明 failure safety；它没有证明该用例能无人值守自动恢复完成。报告必须分别记 `safe_stop`、`recovered`、`completed`，不得把三者都压成 PASS。

只有核心依赖闭包在选定作用域内都有所需 HF/HP/HL 证据、计划内恢复场景自动完成、无越权 sentinel 变化、无未决静默丢失、无重复 mutation，才可授予**该确切 build/Host/参数范围**的 autonomous qualification。凡实机中必须人工点击、人工补属性、手动删除残留、手动改板或重绑身份才能继续，应记录介入，相关恢复/功能 scope 不合格。

不需要为一个永远不返回的 Host 调用发明“自动完成”证明。必须证明系统不会因此造重复、破坏对象或假成功；其无法自动完成的故障范围公开限制。不能拿异常范围的诚实限制取消正常路径与可恢复故障的实际验收责任。

---

## 8. Non-goals 与不可跨越的范围

**本轮明确不做：**

- 新增 EDA/CAD 功能、通用几何内核、autorouter、自动选路/选层/避障/修线、阻抗或传播延迟求解器。
- 重写已有 Fast Path、替换 plan/revision/hash 协议或把其事务执行迁到 MCP/另一服务。
- 为了清零 HIGH 而给每个 action 复制一份特殊错误名单、回滚状态机、重试或布尔判定。
- 建立与 ActionSpec、writeHealth、Fast Path、workflow/stale guard、autosave 平行的第二套权威状态系统、数据库或 scheduler。
- 将 `verified=true`、`reviewed=true`、测试文件存在、源码 feature flag 或 semver 一致当成 `AUTONOMOUS_QUALIFIED`。
- 扩大 `debug.exec_js` 权限以掩盖 typed 能力缺口；通过其它 alias、raw HTTP、内部 helper 绕过已禁止作用。
- 修改当前 G474 benchmark 工程；也不通过在该工程上执行 save/reload/DRC/导入测试来验收本计划。
- 重做 RevA/RevB/G474 的 PCB 设计或以整板 benchmark 代替有限基础资格测试。
- 保证任意第三方插件、未知 Host build、任意 UI 并发、无限任务长度、跨机器/云同步或断电级 ACID；未取得证据的保证必须排除。

允许的“小范围代码整理”只服务于复用和契约收敛。将已有固定 close/reload 步骤从任意 JS 入口迁为受保护内部调用、统一已有 API 的验证和声明，不属于增加新 CAD 功能；不得借此扩展新的建模功能面。

### 8.1 不确定事项登记

| 项目 | 当前确定到哪里 | 实施规则 |
|---|---|---|
| 普通 component rotate / `cmdKey` | 历史问题明确；当前完整场景没有资格证明。 | Stage C/E 定位真实错误与调用上下文，未复现不猜修复；不可仅凭源码没出现 cmdKey 闭单。 |
| Board.delete/rebind 的真实工程树副作用 | 旧恢复控制流不充分；具体 Host 删除/绑定行为未完整证明。 | 使用隔离 fixture；不可类推成通用安全 undo。 |
| 同版本部署、multi-registration 实际激活 | 版本号和 manifest 不足以证明已加载 bundle。 | 用真实 activation/build 证据；不把重连与重新激活等同。 |
| 原审计全仓枚举边界 | 151 项 action 并集已整理；全部 CLI 叶子/Skill 引用没有零遗漏证明。 | Stage A/D/E 对**本次发布候选 surface**机械生成和对照；不宣称补成此前未做的全仓审计。 |
| 审计日志的 durability/retention | 当前存在 `s.audit.Append/fromResponse`；崩溃一致和 fsync 能力未在原审计中证明。 | 先核实现有实现，再提升同一层；不得假定已有 WAL。 |
| 来源跨机器/配置清空 | 现有来源 receipt 依赖插件 user config，普通 save/reload 与跨机器不是同范围。 | 本轮不承诺自动跨机器；有来源缺失则精确原生 reconciliation 或拒绝。 |
| Host native settle 与上下文原子性 | handler settle/FIFO seq 不等于文档原子提交。 | 用限制配置和实机证据界定，不以两个相同快照或任意等待秒数自证绝对完成。 |
| 任意规模/10–20 小时稳定性 | 有界 ledger 与历史观察存在，没有当前完整长期证据。 | 固定支持预算；必须实际 HL-duration 后才声明相应时长。 |

[S03][S06][S12][S15][S23][S24][S27][S28][S35][S38]

---

## 9. 源码与既有审计依据索引

所有源码引用均固定在审计提交 `a583bf731d946d2d39f1223e078d711bd41710d5`。引用证明的是上述**已有机制、控制流或声明**；本文新增合同/架构要求属于推荐设计，不是声称源代码已具备。

| 引用 | 文件与重点符号 |
|---|---|
| [S01] | `internal/protocol/actions.go`：`ActionSpec/AllActions`、各 action 的 effect/gate/verify 声明。 |
| [S02] | `internal/protocol/actions_closure.go`：`closureActions`、生命周期与 CLI composite 声明。 |
| [S03] | `internal/daemon/dispatch.go`：`handleAction/persistArtifacts`、`s.audit.Append/fromResponse` 调用点。 |
| [S04] | `internal/app/dispatch.go`：`postAction/requestActionTimed/requestActionOnce`、文档预检查和结果解析。 |
| [S05] | `extension/src/actions.ts`：`runAction/HANDLERS`、`normalizeDrc`、`schematicDrcCheck`、`schematicPowerConnectPin`、`pcbAddComponent`、`pcbComponentAttrsBackfill`、`schematicComponentReplace`、`boardRebind/pcbNewBoard`、`pcbImportChanges/clickImportConfirm`、`constraintList/assertNetsExist`、`pcbOutlineSet`、`verifyPcbComponentPatch`、`propertyApplied`、`detectRotationNegation/deleteProbeVerified`。 |
| [S06] | `extension/src/fast-path.ts`：`FastPath.observe/snapshot/apply/legacyBegin`、`validOperations/matchesOperation`、activation 内事务表。 |
| [S07] | `extension/src/fast-path-native.ts`：`nativePort.context/read/create/remove`、geometry/revision 投影。 |
| [S08] | `mcp/src/core.mjs`：`DOMAIN_NAMES/buildCallArgs/runEasyeda/toMcpResult`。 |
| [S09] | `mcp/src/server.mjs`：catalog 加载、domain tool 与实际工具派发。 |
| [S10] | `mcp/src/authoring-result.mjs`：`authoringResult`。 |
| [S11] | `internal/daemon/autosave.go`：`requestMutates/isDryRunRequest/schedule/deferAutosave/dispatchSave/stop`。 |
| [S12] | `internal/app/version_gate.go`：`evaluateVersionGate/connectorFinding`、发布来源与 dev/patch 策略。 |
| [S13] | `internal/app/pcb_manufacturing.go`：`nativeDrillHits/inspectManufacturingFile/addManufacturingExport`。 |
| [S14] | `extension/src/manufacturing.ts`：`manufacturingExport`、原生 File 与结构验证边界。 |
| [S15] | `extension/src/component-source.ts`：`sourceAsset/sourceReceipt/resolveSource/sourceStorageKey`。 |
| [S16] | `internal/app/sch_device_identity_compat.go`：`hydrateSchematicIdentityCompatibility/schematicIdentityProbeCode`。 |
| [S17] | `internal/daemon/stagegate.go`：`checkStageGate/maybeInvalidateStage/stageKeyCandidates` 与既有 workflow 调用。 |
| [S18] | `mcp/src/fast-path.mjs`：`FAST_ACTIONS/fastTools/compactFastResult`、操作 enum。 |
| [S19] | `extension/src/plane-lifecycle.ts`：`logicalPlaneId/refreshPlanes`。 |
| [S20] | `internal/app/pcb_drc_compare.go`：`compareDRC/addDRCCompare`、baseline 归属。 |
| [S21] | `internal/app/pcb_measurement.go`：`traceLength/measureGeometry/pcbReportScoped` 与 unresolved 物理长度。 |
| [S22] | `skills/easyeda-agent/SKILL.md`：执行、调试、保存、资格边界。 |
| [S23] | `docs/revb-closure-acceptance.md`：旧构建/Host 的限定验收，不是当前完整资格。 |
| [S24] | `extension/CHANGELOG.md`：1.4.15 等窄 Host 文字记录及部署限制。 |
| [S25] | `extension/extension.json`：Connector 版本、Host engines 与发行元数据。 |
| [S26] | `Makefile`：正式/开发构建版本来源。 |
| [S27] | `extension/src/action-queue.ts`：`ActionQueue.submit/runHead`、abandon 与 seq 边界。 |
| [S28] | `extension/src/lifecycle.ts`：`projectList/projectCreate/projectOpen/schematicCreate` 及 activation 内 receipt。 |
| [S29] | `internal/protocol/disabled_actions.go`：`ActionDisabled/AvailableActions`、配置而非授权的当前定位。 |
| [S30] | `internal/daemon/fastpath.go`：`isFastAction/forwardFast`、已有 plan receipt 与分发。 |
| [S31] | `internal/app/app.go`：根命令、通用 `call` 与全局路由参数。 |
| [S32] | `internal/app/cmd_sch.go`：已有原理图 typed/复合命令。 |
| [S33] | `internal/app/cmd_pcb.go`：已有 PCB typed/复合命令。 |
| [S34] | `internal/app/pcb_plane_refresh.go`：`addPlaneRefresh` 的 guarded composite。 |
| [S35] | `internal/daemon/writehealth.go`：`effectVerdict/effectFromResponse/writeHealthTracker`、`WriteVerification/handleWriteVerify`、`retryableOnFailure/forwardWithAdaptiveRetry`。 |
| [S36] | `internal/app/write_verify.go`：`writeVerdict/writeVerifyBody/reportWriteVerified`，当前 best-effort 遥测语义。 |
| [S37] | `internal/protocol/envelope.go`：`Request/Response/Context`、seq/abandoned 和缺字段边界。 |
| [S38] | `internal/daemon/stalereads.go`：`staleGuard.observe/blockedBy`、`pcbStaleMarks/pcbStaleRead/pcbStaleClears`。 |

[S01]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/protocol/actions.go
[S02]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/protocol/actions_closure.go
[S03]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/daemon/dispatch.go
[S04]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/dispatch.go
[S05]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/actions.ts
[S06]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/fast-path.ts
[S07]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/fast-path-native.ts
[S08]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/mcp/src/core.mjs
[S09]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/mcp/src/server.mjs
[S10]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/mcp/src/authoring-result.mjs
[S11]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/daemon/autosave.go
[S12]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/version_gate.go
[S13]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/pcb_manufacturing.go
[S14]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/manufacturing.ts
[S15]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/component-source.ts
[S16]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/sch_device_identity_compat.go
[S17]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/daemon/stagegate.go
[S18]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/mcp/src/fast-path.mjs
[S19]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/plane-lifecycle.ts
[S20]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/pcb_drc_compare.go
[S21]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/pcb_measurement.go
[S22]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/skills/easyeda-agent/SKILL.md
[S23]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/docs/revb-closure-acceptance.md
[S24]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/CHANGELOG.md
[S25]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/extension.json
[S26]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/Makefile
[S27]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/action-queue.ts
[S28]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/extension/src/lifecycle.ts
[S29]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/protocol/disabled_actions.go
[S30]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/daemon/fastpath.go
[S31]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/app.go
[S32]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/cmd_sch.go
[S33]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/cmd_pcb.go
[S34]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/pcb_plane_refresh.go
[S35]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/daemon/writehealth.go
[S36]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/app/write_verify.go
[S37]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/protocol/envelope.go
[S38]: https://github.com/WangONC/easyeda-agent/blob/a583bf731d946d2d39f1223e078d711bd41710d5/internal/daemon/stalereads.go

---

## 10. 给 Codex 的实施规则

**收到用户的实施启动指令后，只实施 Stage A。** 先读取本文件、固定基线的 ActionSpec/protocol、Fast Path、writeHealth/writeverify 及相关测试，确认已有机制的调用位置；不重做完整审计，不开始 B–E 的实现。

按 Stage A 的 scope 建立合同和共通结果投影，保留原 Fast Path、健康度、门控和 legacy 响应证据。新增类型或包装不是新增权威状态；遇到已有同义机制先复用，避免平行框架。

所有判断遵守：`resp.OK ≠ mutation COMPLETE`；timeout/disconnect 不等于 NO_WRITE；PARTIAL/UNCERTAIN 禁止 blind replay；UNKNOWN 不归 EMPTY/PASS；几何/名称仅发现 candidate；qualification 必须来自实际 commit/build/Host/test evidence。

不得为了使测试通过放宽 identity、错误分类、门控、数值容差或恢复所有权；不得用 debug、重新创建 ID、清空 ledger、自动重启来绕过未决写。证据不足就标记明确限制，不编造当前 Host 行为。

每阶段完成后交付候选 commit、真实测试结果、invariant 覆盖与剩余边界，**停止并等待独立审查接受**，再以已接受 hash 进入下一阶段。提交信息中文、不加前缀、不建 tag；本计划不是 push/PR 的额外授权。

不得触碰 G474 benchmark。未来需要 Host 测试时只能使用已明确授权、UUID allowlist 固定的独立 fixture；没有 Host 环境或授权就只交付真实 offline 结果，不能标 Host PASS。**收到启动指令前，不自动修改源码；启动某一阶段也不自动授权超出该阶段范围的 Host mutation。**
