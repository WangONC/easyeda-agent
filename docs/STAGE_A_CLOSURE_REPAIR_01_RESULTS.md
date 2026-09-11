# Stage A Closure Repair 01 候选结果

本轮基线：`a1f41bbb64974c7ff26738d4f2471d90e0243b0f`，开始时 HEAD 与它一致。候选 hash 以包含本记录的 commit 为准。本轮仅修复四项已确认 implementation defects，保留 execution.v1.3、四种 MutationOutcome、30 个 evidence adapters 和现有 normalization → Validate → Reconcile → Derive → canonical consumers。所有 151 项 action 继续 EXCLUDED。

目标：**STAGE A EXECUTION CONTRACT CLOSED CANDIDATE**，OFFLINE_ONLY，等待独立审查；不授予 autonomous qualification。

## 四项修复

| Blocker | 修复位置与行为 |
|---|---|
| Request/Response attribution | `internal/protocol/execution_reducer.go::validateExecution`、`extension/src/execution.ts::validateExecution`：在 normalization 和 prior 分支之前检查 envelope ID。mismatch 进入 CONFLICT，外来 raw/prior 不贡献当前请求的 write/no-write/settled 事实；原 Response 不改写，prior 原文仅作 evidence。重复解释不递归嵌套 conflict。 |
| Structured prior tuple | 同文件 `validPriorTuple`：对已有 decision_basis 校验 outcome、satisfied、next_action、possible_effect、write_attempted 和适用关系。UNRESOLVED/CONFLICT/INVALID 不能夹带 NO_WRITE 或 write_attempted:false。无 basis 的旧 receipt 保留既有保守适配；不新增 Outcome/Recovery 模型。 |
| Atomic conflict downgrade | `deriveExecution`：先重置当前请求/合同归属和 conclusion-owned write_attempted，再从仍有效的 facts 派生。失效 prior 的 false 消失；独立、归属有效的 raw write:true 保留。无效证据归档不会重新取得权威，真实未 settle 标志不会因重复解释丢失。 |
| FAST_COMPLETE verification | `internal/protocol/execution_evidence.go::fastVerifiedRequirements` 与 TS 对应函数：投影现有 verifier 的固定证明能力，与合同 required 求覆盖。Derive 从当前合同填写 required，从 verifier 事实填写 observed。未支持 requirement 阻止 COMPLETE，不复制 required 到 observed。 |

MCP 生成投影同步更新。`mcp/src/authoring-result.mjs` 和 CLI `internal/app/dispatch.go::interpretDaemonExecution` 保留 daemon canonical 请求 ID 与 operation metadata，避免把外来 response.id 当作新请求 ID 再解释。CLI 原请求由 daemon 分配 ID，因此 CLI/MCP fixture 现在经过实际 daemon reducer 包装后再检查出口；protocol/Connector 测试仍直接覆盖无 prior 的原始 ID mismatch。

健康样本测试 mock 补齐正常响应 ID；writeHealth、writeverify、stage/stale/autosave 的生产实现未重写，继续消费 canonical conclusion。未改变 Fast 执行算法。

## Fast verification 的实际来源

| Requirement | 既有证明来源 |
|---|---|
| net | `extension/src/fast-path.ts::matchesOperation` 对创建图元与请求 net 比较 |
| layer | trace/arc layer 与 via 跨层约束的既有匹配 |
| geometry | trace 点、arc 几何与方向、via 坐标的既有匹配 |
| width | trace/arc width 匹配 |
| hole / diameter | via hole/diameter 匹配 |
| deleted_absence | apply 后 observation 的 present 集合确认全部 deleted_ids 不存在 |
| all_operations | 已有 fastComplete/fastSettled 对 operation、item/index、数量、唯一 ID 和 created/deleted 集合一致性的校验；失败/跳过不能通过 |
| no_pending_native_write | Fast 原有逐项 awaited native 调用、队列 epoch/deadline、最终 observation/revision，以及 settled receipt 对明确 pending/duplicate 的拒绝 |

这些项目针对本次实际 operation 的适用字段；例如没有 via 时，hole/diameter 没有待验证的 via 操作，不表示测量了不存在的对象。真实离线 Fast mock 执行 trace + via + delete 后，完整 receipt 产生九项 required/observed；另分别破坏 net/layer/geometry/width/hole/diameter 和删除回读，既有 verifier 返回 uncertain，归并器不能声明 COMPLETE。未知 requirement 注入分别在 Go 和 TS 测试中被拒绝。

## 覆盖规模与结果

- Fixed corpus：151 项原样保留，新增四项 Closure 最小复现，共 **155**。
- 原 property：**4096**，seed `0x53a3c0de`。
- 独立 semantic oracle：**3294**，seeds `0x53a3c0de`、`0x14a4e001`、`0x76c0ffee`；30 adapter 机械 coverage 保留。
- 实际 preview receipt closure：**144**，保留。
- 新增有限 Closure 组合：**450**，无随机 seed：12 项 envelope 归属组合、282 项冻结 tuple 禁止组合、4 项冲突原子降级、1 项 Fast 合同完整覆盖、151 项 catalog action 投影。预期由独立 implication 检查，不调用 reducer 计算 oracle。
- 上述固定/属性/preview/Closure 输入共 **8139** 项，复用现有 Go ↔ TS/generated MCP 完整 canonical execution parity、raw JSON 往返、JSON serialize/deserialize 和 repeated interpretation 检查。Parity 证明实现一致，独立 oracle 另行验证语义。

| 真实命令/检查 | 结果 |
|---|---|
| `go test -json -count=1 ./...` | 9 个有测试的包 PASS；app/selfupdate 仅四项既有 Windows 基线失败。3254 项测试及子测试 PASS。 |
| 原候选 git archive 隔离目录中重跑四项失败 | 同样四项失败复现，含其中一个子测试；没有修改基线源码。 |
| `go test -json -count=1 ./... -skip '^(四项基线测试)$'` | 11 个有测试的包全部 PASS，3250 项测试及子测试 PASS。 |
| Connector 全套 | **505 PASS，0 FAIL**；包含原 Fast compatibility、真实 receipt 及反证、全部 execution 与 preview closure。 |
| MCP 全套，使用本轮编译 CLI | **196 PASS，0 FAIL，1 Host SKIP**。 |
| TypeScript typecheck | PASS |
| generated artifact `--check` | PASS |
| Skill `pack-skill.py --check` | PASS，58 tracked files |
| `git diff --check` | PASS |

四项基线失败为 `TestStripArtifactNesting`、`TestResolveEnrichScriptPriority`（含 installed_skill_dir 子测试）、`TestResolveEnrichScriptNotFoundListsProbedPaths`、`TestUpdateCLIReplacesBinaryAndVerifiesChecksum`。未为全绿修改这些范围外代码。所有日志路径、命令和 SHA256 记录在 `STAGE_A_TEST_RESULTS.json` 的 `stage_a_closure_repair_01` 中。工作期间发现的中间失败均已修复并重跑，以上为最终结果。

## Frozen invariants 对照

| Invariant | 结果 |
|---|---|
| Idempotence、metadata/evidence JSON 保真、无 conflict 递归嵌套 | PASS |
| Go / TypeScript / generated MCP 完整 canonical parity | PASS |
| malformed/missing/conflicting evidence fail closed | PASS |
| 实际副作用证据优先于 request intent | PASS |
| NO_WRITE 必须有有效正面证明且无冲突风险 | PASS |
| COMPLETE 必须满足当前 ActionContract，不能覆盖 missing/unsettled/conflict | PASS |
| UNCERTAIN 不因弱 status/OK/intent 升级 | PASS |
| outcome/satisfied/next/reason/possible/write 原子一致派生 | PASS |
| stage/stale/autosave/writeHealth canonical consumer 与旧健康去重 | PASS |
| envelope attribution 先于证据权威；canonical prior tuple 一致性 | PASS |

在本轮冻结范围和离线回归覆盖内，**没有剩余已知 Stage A blocker**。Stage B identity/quarantine/WAL、Stage C handler correctness、Stage D persistence/save/reopen/manufacturing、Stage E Host qualification 仍留待原计划。本轮未执行 Host mutation、未触碰 G474、未新增 EDA 功能、未开启 autonomous eligibility、未 push/PR/tag。提交后停止。
