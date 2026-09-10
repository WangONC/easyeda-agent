# Stage A — Execution Contract 候选交付

> 本页下文保留首次候选的历史记录。当前 Stage A-R2 合同为 execution.v1.2；修复、测试和留项以 [STAGE_A_R2_RESULTS.md](STAGE_A_R2_RESULTS.md) 为准。

日期：2026-09-10。实施基线和初始 HEAD 均为 a583bf731d946d2d39f1223e078d711bd41710d5；分支 main。
用户提供的 docs/AUTONOMOUS_EXECUTION_HARDENING_PLAN.md 在开始时未跟踪，全文已读取并保持原样，不混入代码提交。
本记录对应其第 4 节、第 6.1 节 Stage A 与第 10 节。只交付候选，不代表独立审查接受。
Host 资格：OFFLINE_ONLY。本轮没有 Host EDA 调用，没有修改、打开、保存、重载 G474，没有进入 B–E。

## 最终合同

现有 ActionSpec 增加 contract。withContracts 只丰富 AllActions 返回的同一记录，没有第二个手写 action registry。
保留 Mutates、NeedsWindow、NeedsConfirm、RequiresGate、InvalidatesStage、VerifyWith 的原含义。
新字段包括 version/hash、executor、effects、target_scope、dry_run、guard、verification、replay_policy、recovery、dependencies、supported_parameters、operations 与 autonomous_eligibility/exclusion_reason。

- version 为 execution.v1；hash 是 action 名和该合同确定性 JSON 的 SHA256，包含验证要求与支持范围；不是 semver 或 Host build 证明。
- executor 区分 CONNECTOR/DAEMON/CLI_COMPOSITE（LOCAL 是预留执行类别）。显式 hash/version 不匹配、未知 action、非本入口 executor、unsupported dryRun 在原生调用前拒绝。
- effects 区分设计内容、项目拓扑、库资产、导航/选择、原生重算、保存与 artifact 交付；不把历史 Mutates 的保存/显示用途改写成内容写。
- verification 保留 VerifyWith 引用，增加 required/coverage/量化来源/电气映射/持久化要求。未迁移 action 的 required 不伪造；只有字段已声明且证据齐全才能走结构化 COMPLETE。
- 所有 autonomous_eligibility 都为 EXCLUDED，理由是尚未完成目标、恢复和 Host 资格迁移。没有生产 autonomous 发布开关被开启。
- Request 新增 contractVersion/contractHash、operationId/parentOperationId、expectedTarget。新 CLI 和 daemon 主动传递合同身份；缺字段的旧客户端仍可走明确的 legacy 兼容路径，不获得资格。
- guard、operation/target/payload hash 等是后续阶段消费的协议字段；Stage A 不声称已经实现运行时身份锁、持久 intent、恢复账本或严格 amendment 解封。

## 结果与兼容

唯一正式位置是 Response.execution；原始 result/error/context/artifacts/FIFO 字段保持可见，resp.OK 仍表示调用层结果。
Execution 定义业务/请求身份、合同身份、目标与构建归属、四态 outcome、逐项结果、verification、recovery、persistence、request_satisfied、next_action/reason。
Evidence 区分 AVAILABLE/UNAVAILABLE/UNSUPPORTED/INVALID，coverage 单列 COMPLETE/PARTIAL，并携带来源、scope、revision、activation、时间、verifier version、required/observed/missing 和 evidence_refs。

NO_WRITE 必须来自确定的执行前拒绝、已声明无写 preview 或可检查的零写证据。
普通 legacy partial/notApplied/verified:false、native false/undefined、timeout、缺证据都不凭空变成 COMPLETE；不能证明 settle 的部分失败保持 UNCERTAIN。
结构化声明需经过同一 reducer 验证；裸 verified=true 或自行填 COMPLETE 不能资格化未迁移 handler。

FastPath 本身的事务、signature、preflight、guard、几何比较与补偿算法未改。
Go forwardFast 不再压写原 status/OK、不用错误码虚构 mutation_started=false。
Fast 原生 complete 只有 readback、revision、完整逐项结果、IDs、rollback 边界等齐全且不是历史 duplicate 时才投影 COMPLETE。
partial/stale 的无写映射要求 mutation_started=false 且无冲突 IDs；已写且范围已定案才 PARTIAL。
rollback_complete 在已知 PARTIAL 中投影 RESTORED；UNCERTAIN 不升级恢复状态。
缓存 receipt 的原 complete 仍原样保留，但它不证明当前新鲜状态。任何缺失或冲突只降低 execution，不覆盖 native evidence。

CLI 直接输出/dispatchCapture 的出口和 MCP authoringResult 共用同一真值表；MCP 不再维护五个 action 的错误白名单，compactFastResult 不再丢信封字段。
内部 requestActionOnce 保留调用错误语义，另外带 execution、完整 Raw 和结构化 Error，供旧复合流程继续独立读回/补偿。
这属于兼容边界：本阶段没有给每个旧复合 handler 迁移最终完成条件，它们仍全部 non-autonomous；不把兼容调用成功宣传为完整 mutation。
纯 legacy read 保留调用语义，不替代 Stage C 的 DRC/集合 shape validator。save false/missing、artifact missing/path/hash 缺失均不作完成投影。
保存 acknowledgement 不等于持久化或重开验证，文件存在不等于制造正确性。

## 复用既有消费者

writeHealth.effectFromResponse 使用同一 reducer 的结构化效果，并继续保留 partial/notApplied/survived/deleted 等旧负证据。
效果健康度仍是统计，不是 mutation receipt 或恢复许可。writeverify 端点和 CLI best-effort 上报未另建服务。
同 request ID 的迟到证据修改原样本；原样本已过期时回填仍保留 request ID，重复上报不会再制造第二个活动样本。
无 request ID 的批量遥测不承诺严格 evidence 归属；解封/严格 amendment 留给 B。

现有 stage/stale 消费 COMPLETE/PARTIAL/UNCERTAIN 的可能写影响，删除 Fast 专用伪造 OK=true 的失效分支。
autosave.go 仅将 isDryRunRequest 改为 catalog-declared preview 判定；没有改 scheduler、文档 dirty 归属、save/reopen 屏障。
Stage A 不承诺未决隔离、持久恢复、autosave 完成性或全部旧流程已按新 outcome 迁移。
既有 audit JSONL 增加 execution 字段；检查确认 Append 是 best-effort、无 fsync/可靠写前 intent，不能当成 WAL。
这项不足必须由 B 改造同一审计层，不能另建账本。

## 生成与测试

Go catalog → extension/src/action-contracts.json：go run ./internal/protocol/cmd/contractgen。
TypeScript reducer + catalog → mcp/src/execution.generated.mjs：node scripts/generate-execution-mcp.cjs。
node scripts/generate-execution-mcp.cjs --check 拒绝生成产物漂移；Go 测试逐项比较生成 catalog、依赖和合同 hash。
MCP Fast operation enum 从同一 contract.operations 投影，未新增 arc 能力或授予 arc autonomous 资格。

共享 internal/protocol/testdata/execution.json 覆盖 OK 真/假、native false/缺值、verified 缺失/false/裸 true、partial/notApplied、stale、save false/missing、artifact missing/负证据、Fast 历史/缺字段/补偿与 preview。
Go、TypeScript、MCP 使用同一 fixtures；CLI 测试使用真实 HTTP mock daemon + dispatch 出口，不只测试独立布尔函数。
另外覆盖零 native 调用拒绝、schema/enum parity、executor/依赖声明、健康迟到上报幂等与 stage/stale 不修改 OK。

真实命令、结果与日志摘要见同目录 STAGE_A_TEST_RESULTS.json。未跳过的 Stage A 相关回归均通过。
未筛选的 go test ./... 实际失败于四项 Windows 测试，均已在固定基线归档中复现；没有为本阶段修改这四项测试或产品路径：

1. TestStripArtifactNesting：Windows rooted path 差异。
2. TestResolveEnrichScriptPriority：测试 HOME 与 Windows UserHomeDir 的差异。
3. TestResolveEnrichScriptNotFoundListsProbedPaths：同上。
4. TestUpdateCLIReplacesBinaryAndVerifiesChecksum：Windows mode 没有 POSIX executable bit。

另运行显式 -skip 上述四个名字的 go test ./...；这次通过不等于声称未经筛选的全仓测试全绿。
MCP real Host 测试明确 SKIP，所有 mock/故障注入均归 offline。

## Exit criteria 对照

| 要求 | 候选证据 |
|---|---|
| 唯一正式合同与映射 | AllActions 单一来源、生成 catalog、Go↔TS fixtures；MCP reducer 从 TS 生成 |
| Fast status/evidence 不压扁 | native result 不改；完整信封与历史 receipt 保留；相关回归 |
| 原健康统计仍工作且不重复计数 | 原 writeHealth/writeverify 全套回归；新同 ID 重复/过期回填测试 |
| legacy 兼容明确 | 直接出口严判，内部复合调用保留调用错误语义；未迁移写 UNKNOWN/UNCERTAIN，全部 EXCLUDED |
| autonomous 未开启 | 所有 catalog 项 EXCLUDED；没有 Host qualification 或发布开关授权 |
| 范围与记录可审查 | 仅 Stage A 合同/接线/测试/文档；真实失败与 skip 单列；候选提交等待独立接受 |

## 留给 B–E 的 finding

- B：B02/B03、H02/H03/H05/H18 的 execution identity、排他范围、写前 intent、晚完成、operation 关联、严格 amendment、隔离与恢复。审计可靠性不足已确认，未在 A 中伪装解决。
- C：B01–B05 的具体 handler 反例及 H01/H02/H03/H07/H08/H09/H15/H16/H21：DRC UNKNOWN、connect_pin、via ownership、Board 恢复、import DOM、电气映射、属性/集合/bbox/方向探针、route gate 等具体修复未做。
- D：H06/H10/H11/H12/H14/H17/H18/H19/H20：文档 autosave、保存重开、artifact/source fingerprint、复合 surface/依赖闭包、实际 build/activation、策略强制、容量与旧 debug compat。A 的入口声明不等于完整 D surface parity。
- E：全部所选 scope 的真实 Host/持久/恢复/长期资格仍开放；H13 制造合法空库存等具体问题没有实机验收或补丁。没有 finding 因接口类型新增就标为全局 FIXED。

本阶段不改 connect_pin/via ownership/Board rebind/import DOM/制造/保存算法，不改 G474，不创建 tag、不 push、不建 PR。候选提交后停止，等待独立审查接受，不能自动进入 Stage B。
