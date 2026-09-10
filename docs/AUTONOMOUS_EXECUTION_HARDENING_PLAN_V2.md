# AUTONOMOUS_EXECUTION_HARDENING_PLAN V2

## Professional Solo Autonomous EDA

> **用途**：`WangONC/easyeda-agent` 后续 Stage B–E 的实施与独立验收基线。  
> **定位**：面向专业个人使用的高质量 Autonomous EDA Agent，不追求多租户/工业控制系统级可靠性，但必须具备成熟、便捷、优雅、低返工、低 token、可验证的真实制板主链。  
> **重要迁移规则**：**Stage A 的既有冻结 Scope / Invariants / Closure 标准不因本文修改。** Stage A 必须先按原 `AUTONOMOUS_EXECUTION_HARDENING_PLAN.md` 完成独立 Closure 并得到 accepted commit；本文从 **Stage B** 开始成为新的实施计划。

---

## 0. 文档状态与实施基线

| 项目 | 约定 |
|---|---|
| 仓库 | `WangONC/easyeda-agent` |
| 原始审计基线 | `a583bf731d946d2d39f1223e078d711bd41710d5` |
| Stage A accepted baseline | **PENDING**；必须由独立 Closure Review 明确接受后填写 |
| 文档日期 | 2026-09-10 |
| 产品档位 | **Professional Solo Autonomous EDA** |
| 主要用户模型 | 单用户、单 Agent、单受控 EasyEDA Host，会话内尽量 single-writer |
| 核心目标 | 从 Home / Project / Schematic / PCB / Placement / Routing / Plane / DRC / Manufacturing / Save / Reload 形成成熟的专业主链 |
| 可靠性目标 | 常见故障自动处理；不确定副作用安全停止；不 blind replay；允许 operator-assisted resume |
| 效率目标 | 尽可能减少 tool calls、重复 readback、全量 JSON、上下文膨胀和模型返工 |
| 工程保护 | 不使用 G474 benchmark 工程做破坏性资格测试；Host mutation 只作用于独立 fixture |
| 提交纪律 | 阶段以 accepted commit hash 为唯一锚点；不使用 Git tag；提交信息中文、无 `feat:` 等前缀 |

### 0.1 为什么需要 V2

原计划的可靠性目标偏向“长期完全无人值守 + 多入口一致 + 崩溃后自动恢复 + 强持久化资格”，其中很多机制对生产级平台合理，但对本项目的主要使用方式成本过高。

本文不是把系统降级成脚本或 demo，而是重新分配工程预算：

- **保留**：正确目标、唯一执行语义、no-blind-replay、真实 readback、主链正确性、保存/重开、制造交付、明确支持边界。
- **强化**：AI 制板质量、一次做对、compact/scoped/delta context、batch/composite、稳定引用、确定性 preflight、低 token/低 tool-call。
- **弱化**：多用户/多租户并发、任意第三方 UI 并发、崩溃一致 WAL、所有异常自动恢复、无限任务长度、跨机器/云同步、10–20 小时工业级 soak 资格。
- **不允许**：为了轻量化重新接受假成功、重复 mutation、错误目标、unknown→PASS、缺文件却声称制造完成。

### 0.2 新的成功定义

本项目的目标不是：

> “任何异常发生后都必须无人值守自动恢复并最终完成。”

而是：

> **在已支持的 EasyEDA Host / build / 参数范围内，AI 能以较少的交互和上下文稳定完成真实 PCB 工程；常见故障能够自动对账或恢复；真正无法判断的副作用会安全停止，并提供足够清晰、低成本的 operator-assisted resume 路径。**

**安全停止是受支持行为，不是假成功。**  
但正常主链若频繁依赖人工点击、人工补属性、人工删残留、人工修板，则不能称为 Professional Solo READY。

---

## 1. 产品目标

### 1.1 第一优先级：AI 真正把板做好

系统价值优先级如下：

1. **正确性**：不改错对象、不重复 mutation、不把未知当成功。
2. **制板质量**：重要设计状态有真实语义 readback，Agent 能基于可信事实决策。
3. **低返工**：一次规划尽量能一次执行、一次验证；失败后只修剩余差异。
4. **低 tool-call**：避免 N 个小动作产生 N×读取/验证微循环。
5. **低 token**：默认给 Agent 紧凑、与任务相关的上下文，而不是整板原始 JSON。
6. **低延迟**：把确定性检查移到工具侧，不让模型反复推理 Host 可以机械判断的问题。
7. **恢复方便**：常见异常自行处理；少见 UNCERTAIN 能够清晰停止、对账、继续。
8. **维护简单**：不建立平行 action registry、事务数据库、第二套 routeAllowed、第二套 autosaver。

### 1.2 目标使用体验

理想工作流应接近：

```text
任务目标
→ compact project/board context
→ 高层规划
→ deterministic preflight
→ batch/composite apply
→ semantic readback
→ delta context
→ 下一阶段
```

而不是：

```text
整板 snapshot
→ components list
→ pads list
→ nets list
→ layers list
→ rules list
→ 模型自行拼接
→ 单条 modify
→ 单条 read
→ 再 modify
→ 再 full read
→ ...
```

### 1.3 Professional Solo READY

达到 READY 至少意味着：

- 在已声明 Core Surface 内，可以从项目创建/打开推进到制造输出。
- 正常路径无需人工编辑 PCB 或原理图。
- 主链 mutation 不因 timeout/retry 产生重复写。
- 关键 mutation 有 fresh semantic readback。
- SCH→PCB 映射、目标 ownership、关键属性、几何、DRC、制造输出不能靠请求回显自证。
- 保存/重开后，关键 milestone 状态可以重新读取。
- 制造文件真实落盘、结构有效、来源状态一致。
- 常见异常可自动 reconcile；无法定案时 fail-safe stop。
- MCP 默认输出适合 Agent 消费，不要求模型反复解析大量无关 Host 数据。

---

## 2. 可靠性档位：专业而非工业级

### 2.1 必须保证

以下不因“主要是个人使用”而降低：

- `resp.OK != semantic COMPLETE`。
- timeout/disconnect 不等于取消，也不等于 NO_WRITE。
- mutation 不能 blind replay。
- UNKNOWN 不得归 EMPTY/PASS。
- request intent 不能覆盖实际 side-effect evidence。
- 写入目标必须属于预期 project/document/object。
- source/C-number/几何近似不能替代 destructive ownership。
- DRC / bbox / collection / property / manufacturing inventory 缺证据时 fail closed。
- 本地 artifact 丢失不能返回交付成功。
- 核心 route gate / stale gate / contract policy 不能从 alternate entry 绕过。
- Fast Path 的既有 transaction/revision/readback 语义不得退化。

### 2.2 允许简化

以下不作为基础 READY 的强制要求：

- 任意多个 Agent/用户同时操作同一个 Host。
- 任意第三方插件/人工 UI 切页下仍保持强并发安全。
- daemon 崩溃后对每一笔 in-flight write 自动恢复并继续任务。
- fsync/WAL/断电级 ACID。
- 跨机器、跨账号、cloud-sync 一致性。
- 无限 transaction ledger / 无限任务长度。
- 所有 151 个 action 都进入 autonomous qualified surface。
- 所有 PARTIAL/UNCERTAIN 都必须自动补偿到原状态。
- 10–20 小时真实 Host soak 才允许基础 READY。

### 2.3 允许 operator-assisted resume，但不能滥用

仅以下情况允许请求 operator：

- native call 可能晚完成，安全读取仍无法定案；
- Host/插件状态已经超出当前资格范围；
- destructive ownership 无法证明；
- reload 后 source/identity 仍无法唯一恢复；
- EasyEDA 本身进入无法通过受支持 API 恢复的异常状态。

不允许把以下普通情况推给用户：

- 正常的 save/reload；
- 已知参数错误；
- 支持范围内的 target 选择；
- 常见 transient read 失败；
- 可由一次 fresh readback 明确定案的 PARTIAL；
- 主链常规 SCH→PCB、Plane、DRC、Gerber/BOM/PnP。

---

## 3. 核心架构原则

### 3.1 一份动作真值

`ActionSpec / AllActions` 继续是动作、executor、effects、dry-run、verification、dependency 与支持边界的唯一正式来源。[S01][S02]

禁止：

- 第二份手写 autonomous action registry；
- MCP/CLI 各自维护不同能力名单；
- 为某一入口复制独立错误语义。

### 3.2 一份 execution truth

Stage A accepted 后，其 canonical：

```text
Validate
→ Normalize / Adapt
→ Reconcile
→ Derive
```

以及 `MutationOutcome / verification / request_satisfied / possible_effect / next_action` 成为后续阶段唯一结果真值。

Stage B–D 不重新设计 Outcome 类型，不建立第二套 reducer。

### 3.3 Single controlled edit session

Professional Solo 默认支持：

- 一个用户；
- 一个主要 Agent；
- 一个受控 Host；
- mutation 期间一个明确 active project/document；
- 不支持任意 UI/Agent 并发编辑。

若发现多 registration / 目标歧义：

- 读取可以继续到足以诊断；
- destructive mutation 必须拒绝或先选定唯一 session；
- 不需要实现通用多租户调度器。

### 3.4 Common failures automate, rare uncertainty stop

异常处理优先级：

```text
能证明未写
→ 可安全重试

已 settle PARTIAL，差异可界定
→ 重新规划剩余工作

UNCERTAIN，但安全 read/reconcile 能定案
→ 自动对账后继续

仍 UNCERTAIN
→ 停止 destructive mutation
→ 输出明确诊断与 resume 条件
→ operator-assisted resume
```

### 3.5 AI 效率是一等工程指标

任何新增可靠性层不得默认要求 Agent：

- 再调用 3–5 个工具才能知道刚才发生了什么；
- 每笔 mutation 后重新拉整板；
- 重复获取相同 revision 的不变信息；
- 把 raw Host receipt 全部塞进模型上下文才能判断下一步。

---

## 4. 现有机制：继续复用，不重造

| 机制 | 继续负责 | V2 的提升方向 |
|---|---|---|
| `ActionSpec / AllActions` | capability / effects / contract | 派生 Core Surface、MCP schema、支持边界 |
| Stage A execution reducer | canonical result semantics | B–D 只消费，不重新解释 raw evidence |
| Fast Path | routing transaction / revision / readback | 保留核心；增强 Agent 侧紧凑投影 |
| Connector FIFO | Host handler 顺序 | 配合 single-writer session guard |
| daemon dispatch | 唯一派发 choke point | target/session 准入、pending stop、入口一致 |
| writeHealth | 统计与退化诊断 | 只做 health，不授予恢复/资格 |
| stage / stale guard | workflow 与 freshness | 消费 canonical effects，不另建 routeAllowed |
| autosave / save / reload | 保存能力 | 简化为 milestone persistence |
| component source receipt | 来源身份 | Core Surface 的 source/replace/import 验证 |
| manufacturing / artifact | Host 文件与本地输出 | 可靠落盘、结构、source consistency |
| CLI composites | 高层现有工作流 | 继续作为效率层，不强搬到 daemon |
| MCP | Agent 工具入口 | 默认 compact、批处理、少 round-trip |

---

## 5. Core Surface：真正值得做强的主链

V2 不以“151 actions 全部 qualification”为目标。

### 5.1 Core Surface 功能域

#### Project / Document

- health / capability
- project list/create/open
- schematic/page create/open
- document current/list/switch
- save/reload
- 必要的 PCB document 创建/定位

#### Schematic Authoring

- library search / device get
- component place / modify
- supported replacement
- wire
- power/netflag
- NC
- page clear preview/apply
- 必要的属性/source readback

#### SCH → PCB

- import changes
- 完整 source/uniqueId/footprint/pad/pin/net mapping
- 单次 apply + 无副作用等待
- diff/readback

#### PCB Placement

- component move
- rotate / layer
- lock
- selected practical batch move/arrange
- outline
- keepout/关键约束（若主链实际依赖）

#### Routing

- board snapshot compact
- route preflight
- route apply batch
- line / via
- line45 / line90 / pair-plan 中已支持且可正常返修的子集
- route gate

#### Plane / DRC

- pour list/create/refresh/rebuild
- DRC check
- DRC compare
- stale/revision 规则

#### Manufacturing

- Gerber
- Drill
- BOM
- PnP
- 本地持久化
- manifest / SHA256 / inventory / source fingerprint

### 5.2 默认非 Core

以下能力保留为 interactive / experimental，不阻塞 Professional Solo READY：

- raw `debug.exec_js`
- autoroute / SES
- arc 写入与 arc90 自动调谐，直到正常生命周期真正闭合
- Board rebind/copy 的复杂变体
- 未资格化永久 library 创建/build/delete
- 任意 bus/hierarchy 扩展
- negative-plane/custom geometry
- 未实际需要的 constraint 变体
- bulk arrange 的未验证高级模式
- 未知 Host/locale 分支
- 跨机器 source receipt 恢复

### 5.3 Surface 原则

一个 action 可以存在于公开 capability，但不进入 Core Surface。

Core Surface 必须：

- 依赖闭合；
- 参数子集明确；
- unsupported 变体执行前拒绝；
- Skill / CLI / MCP 一致说明；
- 不通过 alias/debug 绕回 excluded 路径。

---

## 6. AI Productivity Layer

这是 V2 相比原计划新增的第一等目标。

### 6.1 Compact Context

Agent 默认需要“做决定所需事实”，不是所有原生细节。

应优先提供紧凑视图：

```text
project/document identity
stage
stale / revision
board outline
layers / routing profile
关键 rule
组件摘要
未连接/未布网络摘要
关键错误/DRC 摘要
当前 unresolved execution
最近一次 milestone
```

raw Host response 仍保留用于诊断，但不默认全部注入 Agent 上下文。

### 6.2 Scoped Reads

支持按以下 scope 获取数据，而不是每次整板：

- component / designator
- net
- primitive IDs
- region / bbox
- layer
- selected objects
- changed objects
- specific DRC class
- manufacturing inventory class

原则：

> 已知目标越具体，返回越小。

### 6.3 Delta Reads

若调用者持有稳定 revision / snapshot token：

```text
previous revision
→ current revision
→ changed / created / removed / invalidated only
```

不重复返回未变化的大型 inventories。

Delta 不自造新的 board truth；必须由现有 revision/readback 可证明。

### 6.4 Batch Mutation

适合批处理的动作优先一次提交：

- 多器件 placement/position update
- 多条明确 trace/via operation
- 多项属性修改
- selected deterministic cleanup
- 已计划好的 independent changes

Batch 必须保留：

- item_results；
- failed_index / failed items；
- real readback；
- partial/uncertain；
- no-blind-replay。

不能为了减少 tool-call 把失败压成一个 `ok=true`。

### 6.5 High-Level Composite

允许新增或强化**高层工作流 composite/read helper**，前提是：

- 复用已有 CAD primitive；
- 不新增 autorouter/几何求解器；
- 不隐藏实际子步骤结果；
- 不建立第二套 execution runtime。

高价值 composite 示例：

```text
schematic context
pcb context compact
import + reconcile
placement preflight
routing preflight
plane refresh
drc compare
manufacturing package
milestone save/reload
```

### 6.6 Deterministic Preflight

Host/API 能机械判断的问题应在工具侧一次返回：

- target 不存在/歧义；
- document type 错；
- locked object；
- layer 不合法；
- route gate 未通过；
- stale state；
- bbox/outside；
- unsupported geometry；
- missing source；
- transaction conflict；
- required inventory unavailable。

不把这些低熵判断反复消耗模型 reasoning。

### 6.7 Stable Handles

Agent 第一次定位对象后，应尽量获得稳定引用：

```text
project UUID
document UUID
native primitive identity + scope
source/device identity
Fast revision
logical plane handle
operation ID
```

后续操作优先复用，避免按名称/坐标重复搜索。

### 6.8 效率可观测性

对代表性 workflow 记录：

- MCP tool-call 数；
- native API call 数；
- full-read 次数；
- compact/delta-read 次数；
- 输入/输出 JSON 字节量；
- batch size；
- retry/reconcile 次数；
- operator intervention 次数；
- wall-clock；
- 产生的 PARTIAL/UNCERTAIN 次数。

目标不是追求一个虚构的固定 token 数，而是：

> 同等 correctness 下，改造后的 workflow 不得因为可靠性层显著增加模型往返；新的 compact/batch 路径应能证明减少冗余调用或上下文。

---

## 7. Failure Handling：四级策略

### Level 0 — Deterministic Refusal / NO_WRITE

适用：

- 参数/contract 不合法；
- unsupported dryRun；
- target 在派发前不存在；
- gate 未通过；
- queue 尚未开始执行就明确过期。

行为：

- 明确 NO_WRITE；
- 可修正参数后重试；
- 不制造 dirty/stale。

### Level 1 — Settled PARTIAL

条件：

- 已知哪些步骤执行；
- native 已 settle；
- remaining diff 可界定；
- 不存在可能晚到的写。

行为：

- fresh readback；
- 只规划剩余工作；
- 新子 operation 指向原 operation；
- 不重放旧完整 payload。

### Level 2 — Auto Reconcile UNCERTAIN

条件：

- 本次可能写过；
- 当前仍可以通过安全读取/reload/receipt 查询自行定案。

允许：

- side-effect-free reads；
- operation receipt 查询；
- scoped fresh readback；
- 必要的 reload；
- 已有明确 owned compensation。

禁止：

- 换 ID 重发 mutation；
- 根据相似几何猜 orphan ownership；
- 清空 ledger / restart Host 来“解决”。

若自动对账获得终态，则继续。

### Level 3 — Operator-Assisted Stop

当 Level 2 仍无法定案：

- 阻断相关 destructive mutation；
- 保留 operation ID；
- 输出：
  - 最后已知目标；
  - 已知 applied steps；
  - 未决点；
  - 建议的安全观察；
  - 恢复所需条件；
- 允许用户明确执行 `resume/reconcile/abandon` 类型的受控操作。

V2 不要求所有 Level 3 都自动恢复完成。

---

## 8. Persistence：专业工作流，而不是 ACID 数据库

### 8.1 Milestone Save

关键阶段形成自然 milestone：

```text
schematic-ready
pcb-imported
placement-ready
routing-ready
routing-complete
drc-clean
manufacturing-ready
```

在这些节点显式保存。

Autosave 保留为兜底，但不作为唯一持久化证明。

### 8.2 Lightweight Checkpoint

Checkpoint 记录：

- project/document；
- relevant revision/fingerprint；
- stage；
- semantic summary；
- save result；
- created time；
- unresolved operation count。

它用于：

- 降低 Agent 恢复上下文成本；
- restart 后知道从哪里重新读；
- 比较当前状态与最近 milestone。

它**不是**：

- 通用事务数据库；
- 跨机器工程镜像；
- 断电级 WAL；
- 自动 undo 系统。

### 8.3 Reload

在以下情况执行 reload/re-read：

- Host 已知 stale；
- milestone 后准备跨关键阶段；
- UNCERTAIN reconcile 需要；
- DRC/manufacturing 前需要 fresh state；
- 用户显式要求。

不要求每一笔普通 mutation 都 save+reload。

### 8.4 Manufacturing Delivery

制造终点必须保留严格要求：

```text
generated
→ persisted
→ structure_verified
→ inventory_checked
→ source_consistent
→ manifest_published
```

本地文件写失败、必要文件缺失、hash 不一致、inventory unknown、导出期间 source 改变：

> 不得返回完整制造交付成功。

---

## 9. Stage Plan

```text
Stage A — Execution Contract
    ↓ accepted commit
Stage B — Reliable Execution Session
    ↓ accepted commit
Stage C — Core Board-Making Correctness
    ↓ accepted commit
Stage D — Productive Workflow + Practical Persistence
    ↓ accepted commit
Stage E — Professional Solo Qualification
```

每一阶段只在上一阶段 accepted commit 上开始。

---

# Stage A — Execution Contract

## 状态

**冻结，沿用原计划。本文不重写 Stage A Scope / Invariants / Exit Criteria。**

Stage A 当前任务是取得唯一 accepted commit。

Stage B 不得用本文为理由放宽或跳过 Stage A Closure。

---

# Stage B — Reliable Execution Session

## 目标

让一个受控单用户 Agent 会话满足：

> **写在正确目标；业务 mutation 最多真正执行一次；timeout/disconnect 不 blind replay；常见未决可以自动对账，无法定案则安全停止。**

不建设通用多用户 transactional runtime。

## Scope

### B1. Session Identity

最小 session tuple：

```text
project_uuid
document_uuid
document_type
connector activation / registration
```

核心 mutation：

- daemon 确认唯一执行 session；
- Connector 入队后复核；
- 每笔真正依赖 active document 的 native write 前复核；
- write 后读取目标时再次确认。

若多 registration 造成歧义：

- 不做复杂 arbitration；
- destructive mutation fail closed；
- 用户/Agent 选择明确 session 后继续。

### B2. Single Writer

在受控 Host 中：

- mutation；
- 依赖当前焦点的 navigation；
- save/close/reload；

不得互相穿插破坏 target attribution。

复用现有 hub/FIFO/non-reentrant，不新增第二个通用队列。

### B3. Operation Identity / No-Blind-Replay

对 Core Surface mutation：

```text
operation_id
request_id
target
payload / plan hash
```

规则：

- same operation + same payload → receipt / in-flight 查询，不重复 native write；
- same operation + different payload/target → 拒绝；
- timeout/disconnect → UNCERTAIN；
- 明确未派发/执行前拒绝 → 可重试；
- PARTIAL → 重新规划 remaining diff；
- 不自动换 ID 重放。

### B4. Lightweight Unclean Session Marker

V2 不要求 crash-consistent WAL。

但 daemon / Connector 异常退出后，系统不得假定“没有未决写”。

最小允许实现：

```text
clean / unclean session marker
last known operation
target
known outcome
checkpoint reference
```

若 restart 后无法恢复充分证据：

- 进入 `RECONCILE_REQUIRED`；
- 允许安全读取；
- 拒绝 destructive mutation；
- reload / scoped reconcile / operator acknowledgement 后再继续。

不要求自动重建所有 in-flight native step。

### B5. Safe Reconcile

建立受支持的通用 reconcile 行为：

- receipt query；
- scoped target readback；
- changed-since/revision comparison；
- reload 后重新定位；
- known owned cleanup。

不建立通用 undo。

## Invariants

- mutation 不使用后来变化的 `current` 替代原 target。
- timeout/disconnect 不等于 NO_WRITE。
- same operation 不重复 mutation。
- queued write 明确过期且未开始后不能晚执行。
- session ambiguity 不猜第一个/最新 registration。
- UNCERTAIN 不因 reconnect/health green 自动清除。
- operator resume 必须是显式 control action，不能由普通业务 request 偷偷解除。
- read-only reconcile 不产生未声明 mutation。

## Tests

### Offline

- target 切换/ABA；
- queue wait expiration；
- native 返回前断连；
- first/middle/last step failure；
- late completion；
- same ID same/different payload；
- restart clean vs unclean marker；
- receipt missing；
- safe read 不触发 write。

### Host

只做有限 fixture：

- 双文档切页 sentinel；
- 一个受控 delayed/timeout mutation；
- same operation 不重复；
- reload/reconcile 后继续；
- 多 registration 歧义时零写拒绝。

不做多用户并发 soak。

## Exit Criteria

- Core representative mutation 证明 target 归属。
- timeout/late response 不产生 duplicate mutation。
- UNCERTAIN 后不会继续相关 destructive write。
- 一般 PARTIAL 可以基于 current state 继续剩余工作。
- restart 后若证据不足，能进入明确 RECONCILE_REQUIRED，而不是假 clean。
- operator-assisted resume 有清晰、有限、可审计入口。
- Fast Path 原事务语义未退化。

---

# Stage C — Core Board-Making Correctness

## 目标

把**实际制板主链**做到可信、低返工，而不是为了清单让所有 action 都变成 autonomous。

## Scope

### C1. Strict Evidence Utilities

形成可复用能力：

- UNKNOWN / EMPTY normalization；
- collection coverage；
- property readback；
- geometry readback；
- target ownership；
- source identity；
- composite step result；
- SCH↔PCB mapping diff。

不同 handler 复用同一方法，不复制 N 份布尔猜测。

### C2. Schematic

Core 支持范围内：

- place；
- modify；
- replace；
- rotate/mirror（仅真实资格通过的变体）；
- wire/power/NC；
- page clear；
- source/Value/footprint/subpart readback。

要求：

- C 号不作为 source authority；
- explicit empty property 不被 library value 覆盖；
- replacement 最终属性/identity/readback 完整；
- probe 无残留，否则 PARTIAL/UNCERTAIN；
- connect_pin timeout 不二次 create。

### C3. SCH → PCB

`pcb.import_changes` 是主链能力，必须可靠。

要求：

- apply side effect 至多一次；
- UI apply 与无副作用 wait 分开；
- locale/build 支持范围明确；
- 完整对账：
  - source；
  - uniqueId；
  - footprint；
  - pad/pin；
  - net；
  - add/remove/change；
- 总数量相等不能代替 mapping 正确。

### C4. PCB Ownership

任何 destructive mutation：

- exact native identity；
- parent/component relationship；
- current session/document；
- 本次 create receipt（适用时）。

via/pad 的空间包含关系只可用于 candidate discovery，不可单独授权补网/删除。

### C5. Placement / Outline

选定主链支持：

- move；
- rotate；
- layer；
- lock；
- practical batch placement；
- outline；
- 必要 keepout。

要求：

- input echo 不等于 landed；
- bbox unknown 不得 allInside；
- expected/checked/missing 数量明确；
- locked/outside/layer mismatch preflight 尽早返回。

### C6. Routing

默认 Professional Solo Core：

- line；
- via；
- line45/line90 中已闭合路径；
- pair plan 中已闭合路径；
- Fast snapshot/preflight/apply；
- route gate。

默认排除 arc write，直到正常 create/delete/re-tune 生命周期单独闭合。

### C7. Plane / DRC

- logical plane identity 不按重名选第一个；
- rebuild 不自动代表 connectivity 已知；
- DRC unknown shape 不得变 zero；
- valid empty 和 unavailable 分开；
- baseline/delta 绑定规则/revision/scope。

### C8. Manufacturing Correctness

- zero/PTH-only/NPTH-only/mixed inventory 均有正确语义；
- BOM/PnP/Drill/Gerber 各自验证承诺的 inventory；
- 不把结构检查冒充 DFM/SI/PI。

## Efficiency Requirements

Stage C 的每个 Core handler 在增强 correctness 时同时评估：

- 是否可以把 verification 合并到同一响应；
- 是否可以 batch；
- 是否可以 scoped read；
- 是否能避免 caller 再发一次全量 list；
- 是否能返回 compact diff 而不是重复大对象。

“为了验证安全，每笔 action 再增加 5 个 Agent 工具调用”不是理想完成方式。

## Finding Disposition

必须关闭或硬排除 Core Surface 涉及的：

- B01–B05；
- H01/H02（Core replace/source 范围）；
- H05/H07；
- H09（若 via_hop 仍进入 Core；否则 excluded）；
- H13/H15/H16；
- H21（Core rotate/probe 范围）。

允许保持 excluded：

- Board rebind/copy 的复杂变体；
- arc；
- 未使用的 permanent library mutation；
- 非核心 constraint 变体；
- 未选择的 bulk helper。

## Host Qualification

使用 F1/F2 小 fixture：

- 多单元/source/Value；
- wire/NC；
- replace；
- import change；
- unrelated netless via sentinel；
- move/rotate/layer/lock；
- outline outside/unknown；
- line/via Fast；
- DRC zero/nonzero；
- manufacturing inventory。

不使用 G474。

## Exit Criteria

- Core required postcondition 有真实 verifier。
- 主链无已知 request-echo false success。
- 主链无启发式 destructive ownership。
- SCH→PCB mapping 真实闭合。
- routing gate 不可绕过。
- DRC unknown 不 PASS。
- unsupported 变体在执行前拒绝。
- correctness 强化没有导致明显的 tool-call/context 爆炸。

---

# Stage D — Productive Workflow + Practical Persistence

## 目标

从“能正确执行”推进到：

> **AI 使用起来快、上下文小、可连续工作、保存可靠、制造交付完整。**

这是 V2 的生产力阶段，不是工业持久化阶段。

## D1. Context Compact

构建或强化一个统一的 Agent-facing compact context 入口，聚合：

- project/document；
- stage；
- stale/revision；
- board size/layers/rules；
- key component/net summary；
- unresolved operations；
- current DRC summary；
- current milestone；
- recommended next actions。

它可以是已有 report/snapshot 的组合投影，不要求新增独立状态数据库。

## D2. Scoped / Delta

为 Core workflow 优先提供：

- net scoped；
- component scoped；
- region scoped；
- changed-since revision；
- DRC delta；
- import diff；
- routing diff。

Agent 有可用 token 时，避免重复全量读取。

## D3. Batch / Composite

优先优化实际高频循环：

```text
placement batch
routing batch
import + reconcile
plane refresh
drc compare
save/reload milestone
manufacturing package
```

要求：

- 子步骤错误保真；
- execution 可追踪；
- PARTIAL 不被隐藏；
- Agent 不需要自行把十几个底层 receipt 拼成一个结果。

## D4. Milestone Persistence

关键 milestone：

- 保存目标 document；
- 记录 lightweight checkpoint；
- 必要时 reload；
- fresh semantic summary。

不要求断电 ACID。

## D5. Artifact Delivery

保留严格本地交付：

- actual path；
- bytes；
- SHA256；
- required files；
- manifest；
- source fingerprint；
- inventory summary。

最后 manifest 只在必要文件全部合格后发布。

## D6. Manufacturing Source Consistency

简化但保留高价值 fingerprint：

- component identity；
- designator；
- Value/BOM flag；
- footprint；
- layer；
- position/rotation；
- pad/net；
- relevant layer/drill inventory。

导出前后若这些发生变化：

- package 不合格；
- 不要求建立通用 board revision engine。

## D7. Startup Build Handshake

Professional Solo 基础要求：

```text
repo / CLI identity
daemon identity
Connector version or bundle identity
contract hash
Host build
```

启动时 mismatch：

- 明确警告或拒绝 Core autonomous mutation；
- 不需要复杂证据继承/多版本 control plane。

## D8. Core Surface Projection

从 catalog 派生：

```text
CORE_READY
INTERACTIVE
EXPERIMENTAL / EXCLUDED
```

不得另建第二份动作真值。

MCP、CLI、Skill 必须一致。

## D9. Token / Tool-Call Efficiency Acceptance

Stage D 必须给代表 workflow 做 before/after：

- project→schematic；
- schematic→PCB；
- placement；
- routing batch；
- DRC；
- manufacturing。

至少记录：

- tool calls；
- native API calls；
- response bytes；
- full-state reads；
- compact/delta reads；
- retries；
- elapsed time。

不要求固定百分比，但若新增 abstraction 没有减少任何 round-trip/context，也没有增加 correctness，则不应保留。

## Exit Criteria

- Agent 可从 compact context 开始，不依赖一串手工 list 才进入规划。
- 已有 revision 时能用 scoped/delta 避免重复全板输出。
- 高频 mutation 可 batch/composite。
- milestone save/reload 可重现关键状态。
- artifact 丢失不会发布成功 manifest。
- manufacturing source consistency 能检测属性-only 变化。
- startup 能识别明显 build/contract drift。
- Core Surface/Skill/MCP/CLI 一致。
- 不存在第二个 autosaver/routeAllowed/transaction DB。

---

# Stage E — Professional Solo Qualification

## 目标

证明：

> **这套工具在真实、受控的个人专业使用环境下可以稳定完成实际主链，同时保持正确、低返工、可恢复和合理效率。**

不把 Stage E 做成工业认证工程。

## 资格类型

### OF — Offline Fault / Contract

证明：

- reducer；
- guard；
- no replay；
- malformed evidence；
- ownership adapters；
- artifact failure；
- compact/delta/batch correctness。

### HF — Host Functional

证明：

- 当前 Connector/Host 真正支持所选 Core path；
- fresh native readback 与期望相符。

### HP — Practical Persistence

证明：

- milestone save；
- close/reopen；
- source/identity/geometry/connectivity 仍可恢复；
- manufacturing 前状态可重建。

### HR — Recovery / Safe Stop

证明：

- 一个 timeout/late-response 场景不 duplicate mutation；
- 一个 PARTIAL 可以继续 remaining work；
- 一个真正 UNCERTAIN 能安全阻断并通过 reconcile 或 operator-assisted resume 继续。

### HS — Optional Soak

非基础 READY blocker。

可选择运行：

- 2–4 小时真实工程 session；
- 或固定若干百次代表性读写。

用于观察：

- memory；
- stale registration；
- receipt usage；
- orphan process；
- context/token 膨胀。

只有要声明更长稳定性时才增加更长 soak。

## Fixtures

### F0 — Runtime/Home

- Home；
- 两个测试 project；
- 一个主要 registration；
- 一个用于歧义拒绝测试的第二 registration。

### F1 — Schematic

- 两页 sentinel；
- 普通 + 多单元元件；
- nonempty/empty Value；
- wire/T/cross/no-connect/power；
- source/replace。

### F2 — PCB Coupon

- 对应 F1；
- line/45°/through via；
- unrelated netless via；
- outline；
- locked/outside；
- 两个 pour；
- DRC zero/nonzero；
- zero/PTH-only/NPTH-only/mixed inventory。

## 代表性真实运行

### E1 — Project + Schematic

Home → create/open → schematic edit → source/Value → wire/NC → milestone save/reopen。

### E2 — SCH → PCB + Placement

import changes → mapping reconcile → move/rotate/layer/lock → outline → milestone。

### E3 — Routing

compact/scoped context → preflight → batch route → readback → delta → milestone。

### E4 — Plane + DRC

pour → rebuild → DRC nonzero/zero → compare → fresh state。

### E5 — Manufacturing

save/reopen → source fingerprint → Gerber/Drill/BOM/PnP → local persist → inventory/hash → manifest。

### E6 — Recovery

- deterministic no-write retry；
- settled PARTIAL remaining plan；
- timeout/UNCERTAIN safe reconcile；
- operator-assisted resume 一次。

## READY 判定

允许：

- 一个罕见 UNCERTAIN 最终需要 operator 明确 resume；
- 不支持能力执行前拒绝；
- experimental action 不进入 Core。

不允许：

- 正常主链经常依赖人工点击；
- 人工修板后继续假装 autonomous；
- duplicate mutation；
- wrong-target mutation；
- unknown DRC/manufacturing 被当 PASS；
- artifact 缺失却生成成功 manifest；
- 每个正常阶段都需要 full reload/full snapshot 才能继续；
- Core workflow 因工具抽象过低产生明显无必要微循环。

---

## 10. 质量与效率 Gate

### 10.1 Correctness Gate

Core Surface：

```text
silent false COMPLETE = 0
known duplicate mutation = 0
known wrong-target destructive mutation = 0
unsupported variant late failure = 0
unknown → PASS = 0
missing required artifact → delivered = 0
```

### 10.2 Productivity Gate

代表 workflow 必须证明：

- 可从 compact context 开始；
- 支持 scoped/delta；
- 高频多步可以 batch/composite；
- raw evidence 不默认灌入模型上下文；
- verification 尽量随 execution 返回；
- 重试/对账不重新做整条业务 intent。

### 10.3 Maintainability Gate

禁止：

- action-specific 成功白名单；
- 第二套 execution reducer；
- MCP 独立 transaction manager；
- 第二个 autosaver；
- 第二个 routeAllowed；
- 第二份手写 Core Surface action 真值；
- 为测试扩大 epsilon；
- 为兼容偷偷使用 raw debug 路径。

---

## 11. Finding → V2 处置

| Finding | V2 处置 |
|---|---|
| B01 DRC unknown→zero | **Core 必修，Stage C** |
| B02 connect_pin timeout replay | **Core 必修，Stage B/C** |
| B03 partial/uncertain consumer | Stage A canonical + **B/D session/persistence** |
| B04 arbitrary dryRun | Stage A + **C handler closure** |
| B05 embedded via ownership | **Core 必修，Stage C** |
| H01 attrs backfill/source | Core 需要时 **C**；否则该 helper EXCLUDED |
| H02 replace recovery truth | supported replace **C**；复杂变体 EXCLUDED |
| H03 Board rebind/copy | 默认 EXCLUDED；不阻塞 Core READY |
| H04 CLI/MCP result projection | Stage A |
| H05 target drift | **Core 必修，Stage B** |
| H06 autosave/save barrier | **D milestone persistence**，不做 ACID |
| H07 import DOM/mapping | **Core 必修，Stage C** |
| H08 constraints unknown | Core 用到的子集 C；其它 EXCLUDED |
| H09 via_hop gate | 若进入 Core 则 C；否则 EXCLUDED |
| H10 arc lifecycle | 默认 EXCLUDED |
| H11 composite/MCP/library surface | Core 入口 **D**；广泛 library write 不要求 |
| H12 build identity | **D startup handshake**；不做复杂 fleet attestation |
| H13 zero-hole inventory | **Core manufacturing C/D** |
| H14 manufacturing source fingerprint | **D 简化保留** |
| H15 outline bbox | **Core 必修 C** |
| H16 bulk readback | 选定高频 batch **C/D**；其它 EXCLUDED |
| H17 artifact persist warning-only | **Core 必修 D** |
| H18 long-run ledger/resume | **B/D 简化**：有界预算 + unclean marker；长时 soak 非 blocker |
| H19 disabled-action consistency | **D Core Surface policy** |
| H20 legacy debug identity | Core 不得依赖 arbitrary debug；legacy 可 interactive |
| H21 probe/rotate | Core 支持范围 **C**；未资格变体 EXCLUDED |

---

## 12. 明确 Non-goals

V2 不要求：

- SaaS / multi-tenant / fleet orchestration；
- 任意多个 Agent 同时写同一板；
- 恶意本机进程隔离；
- 通用数据库级事务；
- fsync/WAL/ACID；
- 断电自动恢复；
- cloud sync consistency；
- 跨机器 source receipt portability；
- 无限 ledger；
- 无限任务时长；
- 所有 failure 自动 recovery；
- 151 action 全 autonomous qualification；
- 10–20h soak 才能 READY；
- 通用 autorouter；
- 新的几何求解器；
- 阻抗/时序/电磁求解；
- 通过 MCP hardening 自动提升 PCB 设计水平到专业 SI/PI sign-off。

### 12.1 明确允许的效率增强

以下**不属于新增 CAD engine**，可以在 B–D 实现：

- compact report；
- scoped read；
- delta read；
- high-level composite；
- batch wrapper；
- deterministic preflight；
- semantic diff；
- stable handle；
- milestone checkpoint；
- Agent-facing concise diagnostics。

---

## 13. 阶段交付与独立验收

每阶段必须交付：

- base commit；
- candidate commit；
- changed files；
- scope；
- invariant → test；
- actual commands/results；
- Host evidence（需要时）；
- Core / Excluded disposition；
- efficiency metrics（C/D/E）；
- remaining limits；
- 是否触碰 G474：必须为 NO。

### 13.1 Blocker 标准

新的阶段 blocker 必须同时给：

```text
源码位置
最小复现
expected
actual
违反的当前阶段 invariant
为什么属于当前阶段
```

“未来可以更严格”不得阻止 PASS。

### 13.2 不以测试数量替代语义证明

以下不单独构成 PASS：

- 测试全绿；
- fixture 数量很多；
- fuzz case 很多；
- Go/TS/MCP parity；
- 文档写已验证；
- semver 一致。

必须确认实际实现支撑 stage invariants。

---

## 14. 给 Codex / Agent 的实施规则

1. **Stage A Closure 完成前，不按本文启动 Stage B。**
2. Stage A accepted 后，把 accepted hash 填入本文第 0 节，后续阶段只从该 hash 开始。
3. 一次只实现一个 Stage。
4. 不重做已 accepted 的前一阶段架构。
5. 遇到已有机制优先复用，不建平行 runtime。
6. 不为清 finding 扩大 action surface；Core 不需要的能力可以明确 EXCLUDED。
7. correctness 与 efficiency 同时考虑：新 verifier 优先随原调用返回，避免让 Agent 再发多轮 full reads。
8. 新的 compact/scoped/delta/batch/composite 必须保留 raw evidence 可追踪性，但 raw 不默认塞入模型上下文。
9. 不允许为了节省 token 压掉 PARTIAL/UNCERTAIN/item_results。
10. 不允许为了减少调用放宽 target ownership、DRC、geometry 或 source 校验。
11. timeout/disconnect 不 blind replay。
12. operator-assisted resume 是最后一级，不作为普通错误处理。
13. 不操作 G474 benchmark。
14. Host 测试只在独立 fixture。
15. 未经明确授权不 push / PR / tag。
16. 阶段完成后停止，等待独立审查接受 candidate commit。

---

## 15. 源码依据索引

以下引用沿用原始审计基线 `a583bf731d946d2d39f1223e078d711bd41710d5`，用于说明既有机制位置；后续 accepted Stage A/B/C/D commit 应在阶段结果文档中另记录。

| 引用 | 文件与重点 |
|---|---|
| [S01] | `internal/protocol/actions.go`：ActionSpec / AllActions |
| [S02] | `internal/protocol/actions_closure.go`：closureActions / composite |
| [S03] | `internal/daemon/dispatch.go`：dispatch / artifact / audit |
| [S04] | `internal/app/dispatch.go`：CLI request / result |
| [S05] | `extension/src/actions.ts`：typed handlers / verifier / import / clear / ownership |
| [S06] | `extension/src/fast-path.ts`：Fast transaction / revision / receipt |
| [S07] | `extension/src/fast-path-native.ts`：NativePort / geometry |
| [S08] | `mcp/src/core.mjs`：MCP CLI bridge |
| [S09] | `mcp/src/server.mjs`：tool surface |
| [S10] | `mcp/src/authoring-result.mjs`：MCP execution result |
| [S11] | `internal/daemon/autosave.go`：autosave |
| [S12] | `internal/app/version_gate.go`：build/version gate |
| [S13] | `internal/app/pcb_manufacturing.go`：manufacturing |
| [S14] | `extension/src/manufacturing.ts`：native export |
| [S15] | `extension/src/component-source.ts`：source identity |
| [S16] | `internal/app/sch_device_identity_compat.go`：identity compatibility |
| [S17] | `internal/daemon/stagegate.go`：stage gate |
| [S18] | `mcp/src/fast-path.mjs`：Fast MCP |
| [S19] | `extension/src/plane-lifecycle.ts`：logical plane |
| [S20] | `internal/app/pcb_drc_compare.go`：DRC compare |
| [S21] | `internal/app/pcb_measurement.go`：measurement |
| [S22] | `skills/easyeda-agent/SKILL.md`：Agent workflow |
| [S23] | `docs/revb-closure-acceptance.md`：historical Host evidence |
| [S24] | `extension/CHANGELOG.md` |
| [S25] | `extension/extension.json` |
| [S26] | `Makefile` |
| [S27] | `extension/src/action-queue.ts`：FIFO |
| [S28] | `extension/src/lifecycle.ts`：project/document lifecycle |
| [S29] | `internal/protocol/disabled_actions.go`：disabled action |
| [S30] | `internal/daemon/fastpath.go`：Fast daemon bridge |
| [S31] | `internal/app/app.go` |
| [S32] | `internal/app/cmd_sch.go` |
| [S33] | `internal/app/cmd_pcb.go` |
| [S34] | `internal/app/pcb_plane_refresh.go` |
| [S35] | `internal/daemon/writehealth.go` |
| [S36] | `internal/app/write_verify.go` |
| [S37] | `internal/protocol/envelope.go` |
| [S38] | `internal/daemon/stalereads.go` |

---

## 16. 最终工程判断

Professional Solo Autonomous EDA 的目标不是“缩小版工业系统”，也不是“加了几个 MCP tool 的脚本集合”。

它应当具备以下特征：

> **专业主链是完整的；结果可信；常见异常自动消化；真正不确定时不会胡来；保存和制造交付可靠；Agent 得到的是紧凑、相关、可行动的上下文；高频工作可以批处理和组合；低级 Host 细节尽量由工具机械处理，从而把模型 token 与 reasoning 留给真正的 EDA 决策。**

当这些条件成立时，即使系统不提供多租户、ACID、全自动 crash recovery 和 20 小时 qualification，它仍然是一套成熟、优雅、适合长期真实工程使用的 Autonomous EDA 工具。
