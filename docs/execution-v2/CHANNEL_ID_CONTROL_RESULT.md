# Channel ID 最小对照结论

分类：MCP_CREATE_METADATA_BUG。

## 真实 Host 证据

- UI 对照只修改 R1/R2 Channel ID：空值分别变为 `$1I2` / `$1I3`。DRC 的 Netlist Error 消失；4 项未布线 Connection Error 保留。
- UI 对照证据：`artifacts/final-e2e/31-ui-control-result.json`。
- 单次正式 API `pcb.component.modify` operation：`d645da0e-5a21-4c27-9635-a6c11662f52c`，仅写 R1 otherProperty.Channel ID。
- 独立 fresh readback operation：`250c81d5-95a4-426a-b393-646757ff26e6`。
- 原始网表唯一变化：`/components/V2_E2E_R1/props/Channel ID` 从空值到 `$1I2`。其余字段不变。证据：`artifacts/final-e2e/33-api-netlist-diff.json`。
- 未重试该 API 写入，未写 R2，未布线/铺铜，未跑整板 E2E。

## 最小实现

- schematic.read 从正式原生网表按 component uniqueId 输出 channelId，不从名称生成。
- pcb.add_component 接受可选 channelId，与既有链接属性在同一次 modify 中写入；合并保留已有 otherProperty。
- 已预登记的 fresh verifier 检查 Channel ID 精确值；Host 忽略写入不能满足完整验证。reconcile 不补写。
- 这是显式传递来源字段的接口；调用创建动作时应传入 schematic.read 得到的 channelId。省略参数仍保留原业务行为，不自动猜测。

## 离线验证

- v2-round2-pcb-add.test.ts + netlist-diagnostic.test.ts：10 PASS。
- TypeScript typecheck：PASS。
- generated V2 catalog --check：PASS。
- go test ./internal/protocol：PASS。

## 边界

- 新创建路径修复尚未部署或进行真实新建 Host qualification；单次正式 otherProperty 写入已获真实证据。
- UI undo/redo 曾使可丢弃 PCB2 的 R2 pad net 变为空；这一状态发生在 API 对照前，单次 R1 API 写入未再改变它。未擅自修复或把当前整板标为 DRC PASS。
- 本结论不恢复 pcb.import_changes，也不宣布完整 Execution V2 E2E 完成。


## 修复后 Host 验收 — 2026-09-11

- 安装包 SHA256：518BFC2A397366AC5E5B29396D6DF5301387CB613D8A109F0D59A2E505A13EB4。
- p1 fresh read `135e0a23-170b-471a-a065-78d7be2b9f28` 确认两个 Channel ID 和 pin-net；未修改原理图。
- 新 PCB UUID `115441ce50dc4b90`，board.new_pcb `513d4628-28b2-4f4b-9dd7-9f56265c9100` SUCCEEDED。
- R1/R2 创建 operation `563d730b-b5e7-4a75-98a0-d37e0ac50837` / `11046e73-cec9-4e53-a6d7-cd994f191955` 均 SUCCEEDED。
- 独立 fresh read `c2219d4e-df69-42b2-a5ce-fcc28e35ac52`：两个 Channel ID 正确，pad 1 GND、pad 2 VCC；与已通过 UI 对照的完整原始网表 diff=[]。
- DRC `d205adb3-d5bb-4a27-9e25-c9788c3a486f`：无 Netlist Error，仅四项未布线连接错误。
- Channel ID blocker CLOSED。未复用或修复 PCB2。后续 E2E 沿用该新 PCB。
