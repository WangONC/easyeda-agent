# Stage A-R4 候选结果

目标：**STAGE A EXECUTION CONTRACT CLOSED CANDIDATE**。OFFLINE_ONLY，等待独立审查接受；不授予 autonomous qualification。

基线为 b3f22ac042720efe0d982d18915e33507328223b，开始时 HEAD 与它一致；原审计 a583bf7 是其祖先，相隔 4 个提交。候选 hash 以包含本记录的 commit 为准。保留 R3 的协议形状、execution.v1.3、四种 MutationOutcome 和 Validate → Reconcile → Derive；本轮修复冻结语义的输入适配，不增加 Outcome 或恢复模型。

## 唯一适配边界

validateExecution 前端调用 normalizeReceipt；raw/legacy 字段由 execution-evidence.json 的 30 个 adapter 归一化。Go embed 同一 JSON，TypeScript 导入同一 JSON，MCP 生成器内联同一来源。prior execution 经既有结构/合同校验，风险事实也使用同一 adapter；不另建 registry、事务或健康系统。

原 Fast fastNoWrite/fastSettled/fastComplete 继续验证 index、数量、ID 唯一性及集合对应、operation、revision、readback、rollback；normalizeReceipt 只把其结果适配为事实。Fast 执行核心没有改动。原 status/revision/item_results/IDs/rollback/telemetry、父子 receipt、未知 metadata 不裁剪。

- Validate：验证形状、类型、enum、合同归属；adapter shape 校验随清单增长，保留无效原证据。
- Reconcile：保持 R3 仲裁顺序，消费已归一化的风险/无写证明/Fast receipt/交付事实，以及已验证的 structured execution；不读取具体 legacy 字段。
- Derive：继续一次性写出 outcome、satisfied、next_action、reason、possible_effect 和相关 facts/权限；冲突降级不能残留旧 write_attempted:false 或 continue。

stage/stale/autosave/writeHealth 沿用 R3 canonical 接线。CLI replay 的旧 partial/notApplied 分支改为 canonical basis；MCP compact 出口要求 canonical request_satisfied，移除 raw status/OK 兜底。内部 legacy CLI 的独立读回/补偿仍保留原调用兼容语义；其 domain 数据/诊断不是新的 execution 完成证明。

## Evidence inventory 与映射

机械搜索覆盖 protocol、daemon、Connector、CLI、MCP 的 outcome/effect、stage/stale/autosave、health 与出口读取；另核对实际 handler 的字段生产点。当前原子适配如下（可组合，非互斥状态机）：

| Raw 表达 | Canonical facts |
|---|---|
| mutation_started:true、write_attempted:true、created_ids/deleted_ids 非空、item_results applied、legacy applied 非空 | write proven |
| partial:true、notApplied/survived/survivedIds 非空、survivedTotal>0、deleted:false、disconnected:false、visibilityApplied:false | incomplete effect；保留既有 verified negative 健康诊断，不解释成零写 |
| status:partial、rollback_attempted/rollback_complete 及 legacy camelCase 对应字段为 true | possible write；恢复不是原请求完成 |
| native_settled:false、duplicate:true、status:uncertain | unsettled；禁止 COMPLETE/NO_WRITE 和已验证负效果升级 |
| verified:false、unverified 非空、status:stale/failed/unverified、readback_verified:false | unknown/负响应；自身不证明无写 |
| native_settled:true | settled fact；自身不证明完成或无写 |
| write_attempted:false | absence candidate，须经过下述权威限制 |

Fast partial/stale 有完整执行前零写 receipt 时，使用更强复合证明，不能只凭 status。structured verification/recovery/persistence 继续经过 R3 shape/适用关系/冲突仲裁。save acknowledge、artifact inline/persisted path+hash 在同一前端适配，保留 Connector→daemon 的交付推进。CLI /writeverify 的 landed/notLanded 是已有独立读回的统计 verdict；继续复用原端点和去重，不升级为执行/恢复许可。

planned deletedIds、preview 计划计数、普通领域数据不自动视为实际写入。对它们的展示与领域读回检查不授予 canonical COMPLETE。未迁移 handler 仍为保守 UNCERTAIN。

## NO_WRITE 权威与 preview 闭包

absence of evidence 不是 evidence of absence。允许的正面证明为：实际派发前拒绝；归属/结构有效的既有 canonical 无写结论；严格 Fast 执行前零写 receipt；合同支持的 handler preview receipt。

机械搜索生产代码确认 raw write_attempted:false 只由三个既有 preview handler 返回。其证明要求合同 dry_run=preview、合法请求 preview，以及实际响应同时包含 dryRun:true / write_attempted:false / native_settled:true。裸 legacy write_attempted:false 不具备全局证明力。任何写入、可能写入、不完整、未 settle 或冲突都不能被该证明或请求意图覆盖。

从 generated contract 自动枚举出 pcb.beautify、pcb.page.clear、schematic.page.clear。测试调用实际 runAction/handler，仅用只读 native mock；空/非空场景各一次，任何非 get 原生调用立即失败。每份实际 receipt 测试正常 NO_WRITE、删除凭证后 UNCERTAIN，以及逐个注入 22 类 risk adapter；共 144 组。其余 148 个 action 的 unsupported dryRun 均在执行前拒绝。

## 独立 oracle 与覆盖

测试专用 execution-semantic-oracle.cjs 不读取 production facts，也不调用 interpret 计算预期。它只声明冻结的风险、未 settle、unknown、settled 和 absence-candidate 分类及 implication；production inventory 仅用于机械枚举和输入样本。每个 field/test adapter 必须被 oracle 明确分类，新未分类项直接失败。结构测试禁止 oracle 读取 production facts。

固定 corpus 为 151 项：原 147 项 raw request/response/before 完整保留，新增 preview+partial、正常 receipt、裸 legacy absence、proof+partial 冲突。原 preview 的无凭证输入保留，期望改为 UNCERTAIN/false，明确记录该纠正。

- 原 xorshift32 seed 0x53a3c0de：4096 组，原生成器保留。
- 独立语义组合：3294 组；seed 0x53a3c0de、0x14a4e001、0x76c0ffee，每 seed 1024 个随机组合，加完整 inventory×intent、证明×冲突和 preview action 闭包。
- 维度：RequestIntent、EvidenceCategory、SettledState、VerificationState、RecoveryState、EffectType、PriorExecutionState。
- 实际 preview receipt 闭包另有 144 组；Go/TS/MCP 比较完整 canonical JSON，包含 metadata、重复解释与序列化往返。
- 既有 AST consumer guard 保留；新增 Go/TS reducer 静态边界和 adapter shape/coverage 检查。parity 证明实现一致；独立 oracle 才承担冻结语义的判定。

## 真实测试结果

| 检查 | 结果 |
|---|---|
| Go 全仓，未筛选，-count=1 | FAIL：仅 4 项 Windows 基线失败，另含 1 个失败子测试 |
| 相同 4 项在隔离 b3f22ac 基线源码复现 | 相同失败，未修改基线源码 |
| Go 全仓，明确排除该 4 项 | PASS：11 个含测试 package |
| Connector 全套 | 498 PASS，0 SKIP |
| MCP 全套，当前候选 CLI | 191 PASS，1 Host SKIP |
| 151 fixed / 4096 原 seed / 3294 独立 oracle / 144 实际 preview | PASS |
| Go↔TS↔MCP 完整 projection、raw JSON 往返、idempotence | PASS |
| Fast 历史、R1/R2/R3、交付演进、health 去重、consumer | PASS |
| TypeScript typecheck | PASS |
| generated --check / catalog parity | PASS |
| Skill package / 本地链接 | PASS：58 个 tracked 文件 |
| git diff --check | PASS |

四项 Windows 失败：TestStripArtifactNesting、TestResolveEnrichScriptPriority（安装 Skill 路径子测试）、TestResolveEnrichScriptNotFoundListsProbedPaths、TestUpdateCLIReplacesBinaryAndVerifiesChecksum。未为了全绿修改这些路径/HOME/可执行权限测试。原始命令、日志 SHA256 和规模在 STAGE_A_TEST_RESULTS.json.stage_a_r4。开发中发现的旧 preview mock 缺证据已修正，最终记录来自修正后的真实运行。

## Frozen invariants

| 冻结项 | 结果 |
|---|---|
| Idempotence，metadata/evidence 保真，无递归 conflict 包装 | PASS |
| Go / TypeScript / generated MCP 完整 canonical parity | PASS |
| invalid/malformed/missing required/conflict 不产生 COMPLETE | PASS |
| observed/possible/incomplete/unsettled 优先于 intent | PASS |
| COMPLETE 的 verification/Fast/recovery/settled 严格性 | PASS |
| UNCERTAIN 不被弱 status/OK/intent 升级 | PASS |
| outcome/satisfied/next/reason/possible_effect/write facts 一致派生 | PASS |
| stage/stale/autosave/writeHealth canonical authority | PASS |
| NO_WRITE positive-proof 权威与所有 preview 闭包 | PASS |
| production inventory 全覆盖且 oracle 独立 | PASS |
| 151/151 action 继续 EXCLUDED | PASS |

这是冻结范围内有限 corpus/组合和既有回归的验证，不是对任意未来 JSON/Host 行为的形式化完备证明。目前没有发现仍未解决的已知 Stage A blocker。

## 留给 B–E

identity/导航互斥/quarantine/持久 intent/WAL/严格 amendment 与恢复归属；connect_pin、via ownership、来源/Board rebind/import DOM 及其它具体 handler correctness；文档绑定 dirty、save/reopen barrier、制造 fingerprint、autonomous surface 和真实 Host qualification/soak，均未实施。

没有 Host PCB/schematic mutation，没有修改 G474，没有新增 EDA 功能，没有 push、PR 或 tag。形成 A-R4 候选后停止，不进入 B，也不自行开启 A-R5。

## Changed files

- docs/STAGE_A_R4_RESULTS.md
- docs/STAGE_A_TEST_RESULTS.json
- extension/src/actions.ts
- extension/src/execution-evidence.test.ts
- extension/src/execution-preview-fixtures.ts
- extension/src/execution.ts
- internal/app/cmd_apply.go
- internal/app/sch_clear_verify_test.go
- internal/daemon/execution_r2_test.go
- internal/daemon/execution_r3_test.go
- internal/daemon/stale_read_gate_test.go
- internal/daemon/stalereads_test.go
- internal/protocol/execution-evidence.json
- internal/protocol/execution.go
- internal/protocol/execution_evidence.go
- internal/protocol/execution_evidence_test.go
- internal/protocol/execution_properties_test.go
- internal/protocol/execution_reducer.go
- internal/protocol/execution_shape.go
- internal/protocol/testdata/execution.json
- mcp/src/execution.generated.mjs
- mcp/src/fast-path.mjs
- mcp/test/execution-evidence.test.mjs
- mcp/test/fast-path.test.mjs
- scripts/execution-evidence-properties.cjs
- scripts/execution-preview-fixtures.cjs
- scripts/execution-semantic-oracle.cjs
- scripts/generate-execution-mcp.cjs
- skills/easyeda-agent/references/actions.md
