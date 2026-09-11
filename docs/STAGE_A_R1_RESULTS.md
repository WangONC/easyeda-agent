# Stage A-R1 候选交付记录

日期：2026-09-10。返修起点：f1bb17381fa36348f1dccacbdc09ac23e54e7d3a；原实施基线 a583bf731d946d2d39f1223e078d711bd41710d5 是其祖先。依据用户贴出的 NEEDS_STAGE_A_R1 完整审查正文，只处理 A-R1-01～06。

## 修复与证据

| 审查项 | 最终行为 | 回归 |
|---|---|---|
| A-R1-01 | Fast 四个派生 action 使用独立父 execution；子 snapshot 使用独立 request/operation ID 和 parent_operation_id，完整响应保留在 child_responses；失败子执行不能被父计算覆盖。legacy 父 operation ID 回退到本次 request ID。 | 四项真实 planner + 生成的 Connector TS reducer；HTTP/WebSocket 既有集成；子失败传播。 |
| A-R1-02 | inline artifact 只产生 PENDING_DELIVERY；daemon 实际落盘后的 path/SHA256 可推进 DELIVERED。落盘失败为 DELIVERY_FAILED；确定上游失败、INVALID/UNSUPPORTED、合同冲突不被覆盖。 | TS → Go persistArtifacts 的真实临时文件成功/失败 → TS/Go 再解释；共享 CLI/MCP fixture。 |
| A-R1-03 | Fast receipt 对照请求 operations，验证非空字符串 revision、base 对应、indexed items、数量、类型、ID 集合和唯一性；partial 必须具备完整步骤范围、有效 failed_index 和终态读回；显式未 settle、写尝试矛盾或 item 冲突保持 UNCERTAIN。 | 缺失/null/错误类型 index、重复/错误/冲突 IDs、无效 revision、native_settled false/null、缺失 operations 等反例。 |
| A-R1-04 | Go/TS 都保留 operation、target、verification、recovery、persistence、子证据等已有 metadata；重复解释不丢失恢复详情或证据引用；缺失字段不成为索引 0。 | 全部 82 个共享 fixture 加 metadata case，比较完整规范化 execution；Go→TS、TS→Go及重复投影。 |
| A-R1-05 | action 的 null、空、非 JSON、截断响应及非对象结果成为协议失败；可能已派发的 mutation 为 UNCERTAIN。保留原始 stdout/stderr/error。文本型本地辅助入口未改。 | MCP 无效响应和 TIMEOUT 保真；toMcpResult isError 断言。 |
| A-R1-06 | content、SAVE、navigation、recompute 分别消费合同 effects。pour rebuild 正常失效 post_route_checked；NO_WRITE 不失效；Fast UNCERTAIN/native unsettled 不安排 autosave；保留既有 legacy 内容写 safety net。 | stage/stale/autosave、Fast transport、健康统计与重复 request ID late verify 回归。 |

## 合同和兼容

合同版本 execution.v1.1，通过同一 ActionSpec 重新生成 TS/MCP catalog 和 hash，显式旧合同身份会被拒绝；省略身份的旧调用仍走保守兼容路径。151 项能力仍全部 EXCLUDED。没有第二份 action registry 或新的事务、健康、保存系统。

resp.OK 保持调用语义，mutation_outcome 保持 NO_WRITE / COMPLETE / PARTIAL / UNCERTAIN；原生重算不会被伪装成内容 COMPLETE。Fast 原始 status、items、IDs、revision、rollback 和 FIFO 证据保留。严格 compatibility reducer 只解释既有 Fast receipt，不重新执行几何验证或回滚。缺少完整 receipt 的旧简化响应不升级为 COMPLETE/PARTIAL。

writeHealth 和 /writeverify 继续沿用现有统计、负证据和 request ID 去重；本轮未新增严格 evidence amendment 或恢复授权。autosave 沿用原调度器；没有 dirty 数据库或 save barrier。旧 legacy handler 的调用成功仍不能证明语义完成。

## 实际测试结果

- Go 未过滤全套 `go test ./...`：失败仅限四项已有 Windows 基线问题：TestStripArtifactNesting、TestResolveEnrichScriptPriority、TestResolveEnrichScriptNotFoundListsProbedPaths、TestUpdateCLIReplacesBinaryAndVerifiesChecksum。上轮已在原始基线独立复现，本轮未修改它们。
- 明确排除上述四项的最终 Go 全套：通过。最后仅父 operation ID 补充及其 transport 断言，随后完整 daemon 套件再次通过。
- Connector：425 passed，0 failed，0 skipped；TypeScript typecheck 通过。
- MCP：119 total，118 passed，0 failed，1 Host 测试按既有开关跳过。使用本次源码独立构建的 .easyeda/stage-a-r1-easyeda.exe，未安装或重启 Host daemon。
- generated MCP --check：通过；catalog parity：通过；Skill package check：58 tracked files，通过。
- 82 个共享 fixture 被 Go、Connector、MCP 和真实 CLI HTTP mock 出口消费。新增完整 execution 双向/重复投影，以及真实文件系统与 HTTP/WebSocket 组合测试。

详细命令、日志哈希和 changed files 见 STAGE_A_TEST_RESULTS.json 的 stage_a_r1 字段。日志位于忽略目录 .easyeda，不混入发布资产。

## Stage A exit criteria 与留项

合同单一来源、未迁移 action 不自动获准、OK 与 outcome 分离、Fast 原始证据保真、未知/冲突不升级完成、跨入口一致性和原有健康统计，均有上述离线回归。此处为返修候选，不代替独立审查接受或 Host 资格。

保持 OFFLINE_ONLY。未进行 Host mutation、G474 操作、push、PR 或 tag。未进入 Stage B–E。identity/quarantine、持久 intent/WAL、严格 amendment、来源/Board rebind/import DOM、制造、完整保存屏障及真实 Host 资格仍按原计划留给后续阶段。
