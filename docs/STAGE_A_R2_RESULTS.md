# Stage A-R2 候选交付

日期：2026-09-10。起点 HEAD：da46d819d64297125e0037d3450c3836be8e582b。只处理用户指定的 A-R2-01～03，保留 Stage A 架构。

| 审查项 | 修复 | 回归证据 |
|---|---|---|
| A-R2-01 | NATIVE_RECOMPUTE 的可能副作用不再取决于 request_satisfied。收到 partial/uncertain/failed 响应仍使旧 stage 失效；显式 NO_WRITE、声明 preview 和已知派发前拒绝除外。内容 outcome 不适用于重算，不伪造 COMPLETE。 | 重算三种失败状态 × OK true/false；实际 workflow 文件失效；stale 不被错误清除、autosave 不被触发；preview/NO_WRITE/派发前拒绝。 |
| A-R2-02 | Fast raw complete 必须与既有 recovery 一致：只有 NOT_REQUESTED 可兼容无回滚的原请求完成；RESTORED 还必须对应原始 rollback_attempted/rollback_complete。冲突变为 UNCERTAIN，保留原 recovery 和原始 receipt。 | RESTORED + complete，有/无 raw rollback；FAILED/PENDING/UNKNOWN recovery；既有合法 restored partial 和 Fast complete 正例；跨语言重复解释。 |
| A-R2-03 | 在 reducer 消费前检查 verification/recovery/persistence 的对象、必需字段、数组元素、state 和 scope 字段类型。Go 解码保留缺失/null/错误类型的原始结构；TS 不对坏结构执行成员访问或补齐再判成功。 | 138 个共享 fixture，其中本轮增加 56 个；verification/recovery/persistence 缺失、null、错误类型、嵌套数组/成员错误，另含 SAVE/artifact 出口；MCP 重复投影。 |

无效 execution 的输出保留 invalid_evidence，verification.state=INVALID、request_satisfied=false；内容 mutation 为 UNCERTAIN。invalid_evidence 在重复解释和 JSON 往返后仍阻止升级。该字段是当前响应的原始证据，不是新的健康、事务或恢复系统。正常 metadata 和 Fast 原始 status/evidence 沿用原有保真路径。

合同版本为 execution.v1.2；同一 ActionSpec 重新生成 catalog/hash 和 MCP reducer。所有 151 项能力仍为 EXCLUDED。

完整规范化 execution 测试现在同时输入未经 Go 解码的原始 JSON、Go 解码响应和 Go 解释后的响应，并比较 TS 首次/重复解释及 TS→Go 输出，避免 Go 零值掩盖 missing/null 差异。初轮全套发现 reason 在重复解释时变化，已修复并由最终全套确认。

实际最终测试：

- Go 未过滤全套：仅四项已知 Windows 基线失败——TestStripArtifactNesting、TestResolveEnrichScriptPriority、TestResolveEnrichScriptNotFoundListsProbedPaths、TestUpdateCLIReplacesBinaryAndVerifiesChecksum。
- 明确排除上述四项的 Go 全套：通过。
- Connector：481 passed，0 failed，0 skipped；TypeScript typecheck 通过。
- MCP：176 total，175 passed，0 failed，1 Host 测试按既有开关跳过；使用当前源码独立构建的 .easyeda/stage-a-r2-easyeda.exe。
- 生成文件 --check、catalog/schema parity 和 Skill check（58 tracked files）：通过。

命令、最终日志 SHA256 与 changed files 记录在 STAGE_A_TEST_RESULTS.json 的 stage_a_r2。日志位于忽略目录 .easyeda。交付仍为待独立审查接受的 Stage A 候选，OFFLINE_ONLY；未进入 B–E，未进行 Host mutation 或 G474 操作，未 push/PR/tag。原计划 B–E 的所有留项保持不变。
