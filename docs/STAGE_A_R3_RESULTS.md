# Stage A-R3 候选结果

状态：OFFLINE_ONLY，等待独立审查接受。未进入 Stage B。

开始时 HEAD 与用户指定基线均为 `daaaef934e97d84705989785c170c54b5a544d5f`，分支 main；没有跨过未知提交。原始审计基线仍为 `a583bf731d946d2d39f1223e078d711bd41710d5`。
本轮按计划第 4 节、第 6.1 节 Stage A 和第 10 节，集中处理 A-R3-01～05。用户提供的计划及 stage-a*.patch 保留原样，不混入候选提交。

## 架构变化

保留原 ActionSpec/AllActions、Fast Path、writeHealth/writeverify、stage/stale/autosave。合同版本随解释语义变更为 `execution.v1.3`；151 项 action 全部继续 EXCLUDED。没有新 action registry、事务运行时、保存调度器、健康统计服务或 autonomous 资格。

`Interpret/interpret` 只串联 Validate → Reconcile → Derive。Go 位于 execution_reducer.go，TypeScript 位于 execution.ts；MCP 由 TypeScript 生成，CLI/daemon 使用 Go。阶段内的 facts 是一次解释的局部数据，不维护 operation 状态。

1. **Validate**：检查 execution 顶层判定字段、嵌套 verification/recovery/persistence、目标 metadata、child receipt 的 Response 信封、逐项结果、枚举、raw 判定字段的类型及合同/请求归属。带 decision_basis 的规范结果必须携带完整消费字段。原始 malformed JSON 保留到 invalid_evidence，不能通过 Go 零值、JS truthiness 或默认数组修成成功。显式缺失、null、错误类型分别保留；完整缺省 legacy 响应仍走已有兼容边界。
2. **Reconcile**：统一仲裁请求意图、prior execution、raw receipt、Fast status、验证覆盖、恢复和交付证据。正向写入/未 settle 证据优先于 preview。明确 missing、覆盖不足、冲突、未知恢复或不适用的 persistence 不能被 raw complete 覆盖。归属匹配的未决证据保持未决；已验证执行前拒绝携带其阶段到后续投影，但新的实际写证据会推翻无写结论。既有 artifact PENDING_DELIVERY 可以由 daemon 的实际落盘 receipt 补成 DELIVERED，DELIVERY_FAILED 不被覆盖。
3. **Derive**：统一写出 mutation_outcome、request_satisfied、next_action、reason、possible_effect，并派生 autosave_eligible、health_effect、freshness_restored。降级会清掉旧 continue/成功理由/保存许可，不再局部覆盖。decision_basis 记录这份 execution 的结论来源，供重复解释保持证据强度；它不是第二套 mutation outcome 或持久事务状态。

Go 的 wire 保留逻辑避免 typed decode 丢失显式 false、空 metadata、嵌套扩展证据或 child receipt 的原始信封。冲突时 prior_evidence 保存被仲裁的 prior；不会在每次解释时重复嵌套自身。原 result、Fast status、item/index/IDs、revision、rollback、telemetry 不改写。

## 消费者与兼容边界

- stage invalidation 消费 possible_effect；部分/未决 NATIVE_RECOMPUTE 请求失败仍使旧 stage 失效。NO_WRITE 不制造新影响。
- stale 观察消费 possible_effect/freshness_restored；preview 发生实际写入时不能再被请求侧的只读分类提前跳过。拒绝和普通预览不清除已有 stale。
- autosave 只消费 autosave_eligible；显式 invalid/conflicting/unsettled/Fast UNCERTAIN 不会由 resp.OK 兜底放行。普通无充分完成证据的 legacy 内容调用仍保留既有 autosave 兜底，不能据此宣布写完整或持久化完成。
- writeHealth 的 effectFromResponse 只映射 canonical health_effect。status:uncertain 是 UNKNOWN，不是 verified-not-landed。partial/notApplied/survived/deleted:false 的实际 legacy 负读回适配集中在 reducer，保留原健康诊断；它们不证明完全无写。已有明确未决证据不能仅凭较弱 status 得到已验证负效果。
- 原 writeHealthTracker 和 /writeverify 的计数、迟到回填、同 request ID 去重继续使用既有通道。健康统计仍不授予恢复或 autonomous 资格。
- reload 的既有 closeDocument 识别和 pour rebuild freshness 兼容映射仅集中到 reducer；没有扩展成 Stage D save/reopen barrier。

Fast 父/子 execution 归属、artifact 分阶段落盘、严格 ID/index/revision/settle 校验、MCP 无效响应出口均保留 R1/R2 实现，并纳入本轮回归。

## 固定语料与性质测试

固定语料为 147 项：保留原 138 项内容和期望，只更新合同版本/hash；增加 9 个输入覆盖 R3 五类 finding。独立比较确认历史输入和期望未被改写（排除递归合同身份字段）。

| Finding | 固定反例与组合消费 |
|---|---|
| A-R3-01 | Fast complete + explicit geometry missing/PARTIAL；不改写 missing，不升级完成 |
| A-R3-02 | preview + mutation_started/deleted_ids + prior UNCERTAIN/native_settled=false；另含 hash mismatch；真实 Connector→daemon stage/stale 失效 |
| A-R3-03 | request_satisfied/native_settled 字符串；document.open 的不适用 mutation outcome；完整 wire/metadata 往返 |
| A-R3-04 | prior COMPLETE/continue + raw readback_verified=false；三次重复投影不残留 continue |
| A-R3-05 | verification=null 且 native_settled=false；status:uncertain 的健康等级；消费者不得恢复保存许可或验证等级 |

确定 seed 为 `0x53a3c0de`（1403240670），xorshift32，4096 组、8 类组合。覆盖必定 malformed 的结构变换、不同 settle 强度的 prior UNCERTAIN、preview/实际写冲突、明确缺失验证项、raw 类型/ID/revision 变换、recovery/persistence 组合、过时成功许可、验证覆盖变化和 child receipt 的类型/时间/计数/交付字段破坏；独立变化外层 OK、合同 hash、request ID。

性质断言直接约束许可与证据，不从 reducer 的结果生成预期布尔值。固定正向 Fast/导出语料同时防止“全部返回失败”通过。Go 比较每个完整 JSON 的 Go/TS 首次与重复解释，以及 TS→Go 往返；Connector 套件直接运行 TypeScript 源码；MCP 套件再经过 authoringResult 验证完整 execution 与工具成功标志。

另外覆盖执行前拒绝跨消费阶段的保真与反证；AST 回归禁止 stage/stale/autosave/effectFromResponse 直接读取 resp.OK/Result/Execution 自行重判。R1/R2 的父子调用、落盘成功/失败、健康去重和重算消费者组合回归继续执行。

## 真实测试结果

最终命令、日志 SHA256、测试规模与 changed files 见 [STAGE_A_TEST_RESULTS.json](STAGE_A_TEST_RESULTS.json) 的 stage_a_r3。日志位于本地 .easyeda；未将生成测试日志或二进制纳入提交。

| 检查 | 真实结果 |
|---|---|
| Go 全仓，-count=1 | FAIL：仅 4 项既有 Windows 测试（含 1 个失败子测试） |
| Go 全仓，-count=1，显式排除上述 4 项 | PASS：11 个含测试的 package |
| Connector | 491 PASS，0 SKIP |
| TypeScript typecheck | PASS |
| MCP，使用本轮隔离 CLI | 185 PASS，1 个 Host SKIP |
| 生成投影一致性 | PASS |
| Skill 打包/链接 | PASS：58 个 tracked 文件 |

未筛选 Go 的四项 Windows 失败为：TestStripArtifactNesting、TestResolveEnrichScriptPriority（包含其安装路径子测试）、TestResolveEnrichScriptNotFoundListsProbedPaths、TestUpdateCLIReplacesBinaryAndVerifiesChecksum。与前两轮已记录并在原始基线复现的失败相同，涉及 Windows 路径/HOME/可执行权限语义。本轮没有修改这些产品路径或对应测试。单独排除这四个测试的运行不等于未经筛选全仓全绿。

## Frozen invariants / Stage A exit criteria

| 冻结项 | 机械证据与边界 |
|---|---|
| Interpret(Interpret(x)) == Interpret(x) | 固定语料与 4096 组逐项比较完整 execution；双向往返；阶段拒绝另测 |
| Go / TypeScript / MCP 一致 | 同一固定语料和 seed；真实 TS 源码 + 生成投影；MCP 出口完整结果对照；CLI mock daemon 出口回归 |
| malformed/conflicting/missing 不产生 COMPLETE | 结构变换、覆盖缺失、恢复/交付适用关系、Fast 证据冲突；固定正向对照 |
| UNCERTAIN 不被弱证据升级 | 不同 native_settled 组合及重复解释；显式未决 health UNKNOWN；无 continue/autosave 许可 |
| intent 不覆盖 side effects | preview + 真实写/未 settle/坏 hash；stage 与 stale 实际消费 |
| conclusion tuple 内部一致 | outcome/satisfied/next/reason/possible_effect 加健康/保存许可的组合断言 |
| 消费者只用 canonical 结论 | 四类消费者行为回归和 AST 结构检查；原始 OK 仅保留调用统计语义 |
| 唯一正式合同与结果映射 | 原 AllActions → catalog；三阶段 reducer；MCP 生成检查；旧未调用成功判据删除 |
| Fast 完整证据保留 | 历史与父子 receipt 回归，未改 Fast 几何、事务或补偿核心 |
| 现有健康通道仍工作且不重复计数 | 原健康 suite 与同 ID 迟到/过期回填测试，R3 未决负效果等级回归 |
| legacy 清楚兼容且资格关闭 | 普通 legacy 安全网独立于完成证明；151/151 EXCLUDED |
| 范围和结果可审查 | 本地候选 commit、固定语料、可重现 seed、完整测试记录；OFFLINE_ONLY |

这些是有限固定/组合输入上的机械检查，不是所有可能 JSON 的形式化证明，也不是 Host 资格。

## 留给 B–E

identity guard、导航互斥、quarantine、持久 intent/WAL、严格 amendment 与恢复许可仍未实现；旧 audit 的可靠性边界不改变。
connect_pin 重放、via ownership、器件来源/Board 重绑、import DOM、各 handler 的几何/属性/集合正确性仍由后续阶段处理。
文档绑定 dirty/save/reopen barrier、制造来源一致性、资格闭包与真实 Host 资格继续留给 D/E。所有 action 的 autonomous eligibility 仍关闭。

本轮没有 Host mutation，没有操作 G474，没有新 EDA 功能，没有 push、PR 或 tag。创建 Stage A-R3 候选后停止，等待独立审查接受。
