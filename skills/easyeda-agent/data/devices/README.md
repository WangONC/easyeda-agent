# Device Knowledge V0.1

Device Knowledge 是具体器件的可追溯事实；现有 Standard Blocks 是可复用的设计知识／电路组合。此目录不定义新的设计格式。

从 [index.json](index.json) 按 MPN / LCSC / category 找条目，读取 parts 对应 JSON。`schema.json` 只描述器件条目；无需安装 schema framework。

## 首批范围与证据边界

仓库正式内置的首批 50 个器件知识条目：LDO、DC-DC、MCU、Battery Management、MOSFET 各 10 个。全部包含可用且有精确出处的技术事实，不接受 `identity_only`、demo 或占位条目。此集合同时作为后续社区／Agent 数据 PR 的质量参考；覆盖范围有限，不宣称包含器件全部规格。

- 49 个身份来自用户提供的试验 ZIP，`provenance` 保存原成员路径及 ZIP SHA256；不是厂商认证，LCSC 编号也不是实时库存或选型排名。
- `sources` 中 `pdf_page` 是从 1 开始的实际 PDF 页序，`printed_page` 仅在确认时记录。来源没有确认的旧字段不进入事实组。
- `facts` / `pins` / `constraints` 每组通过 `source_refs` 明确引用支持页面。事实组只覆盖列出的字段，不覆盖同系列其它封装、修订、温度或未列出的测试条件。引脚名称组不等于完整编号引脚表。
- 没有可靠证据的字段直接省略，不使用 `unavailable` 占位。缺失不表示不存在、不适用或默认值，Agent 不得补全。
- 原 34 份参考网表中仅保留 7 份已核对原图的范围；其它直接省略；参考应用不是必填项。`netlist` 沿用原试验的 components/nets，不是新的设计知识格式，不直接当作可执行 Apply 输入。
- `conditions` 只记录参考图或紧邻设计参数表明确给出的工作点；空对象必须标记 `topology_only`。即使有条件，也仅是该示例，不是器件通用保证。符号引脚、通配引脚组、未知阻值不能自动补全。
- RP2040 的参考指南印刷页 8/9 对应 PDF 页 9/10。TPS7A20 表 7-1 的示例输出为 2.8V，原 3V3 网表未作为其直接转录保留。
- 全部原 `required_external`、`optional`、`summary` 及无明确出处的布局概括不导入；Typical Application 的元件值只存在于该参考网表，不提升为“推荐外围”。

公开包只含 JSON 和说明，不再分发 datasheet PDF 或截图。本地补证记录在仓库 artifacts/device-knowledge；网页原链接可能不可用或切换修订，需对照条目记录的文档/页码（有本地 PDF 时附 hash）。

## Agent 使用

优先查本地器件知识；命中证据范围匹配的条目时复用已列出的事实，不重复通读 datasheet。命中成熟 Standard Block 时优先复用现有电路块。只有知识缺失、来源不可靠、修订不匹配或工况超出证据范围时回读原始文档。未写出的内容不能由模型补全。

## 首批补证与替换记录

原 18 个仅身份条目中，17 个已按厂商数据表补入基础参数或引脚，另外 1 个按正式数据质量要求替换。TECH PUBLIC TP4054 的原分销商文档未能取得足够可靠、可核验的证据，因此使用同属 Battery Management 的 TI BQ24040DSQR（C81080）替换；不是等效替代或引脚兼容声明。新条目的 `provenance.replaces` 记录原 ID，未继承 TP4054 的技术值。原始 ZIP 不变。

BQ24040 的技术依据为 TI SLUS941H：PDF 第 1、4、6 页；LCSC 链接仅证明采购编号。HT7333-A 依据 Holtek HT73xx Rev.1.80 的 HT7333 / 7333-A SOT89 对应关系。MT3608 使用 Olimex 托管的 Aerosemi 原厂数据表，不使用分销商参数摘要。

## 数据 PR 最低验收

每条必须包含实际可用的参数、引脚或明确约束，不能只有身份。技术事实必须来自厂商原始文档，逐组给出 URL 与实际 PDF 页码；涉及温度、测试电流、驱动电压、封装和修订的限定条件不得省略。绝对最大额定值不能当工作范围，参考图元件值不能升级为通用要求。没有可靠参考图就省略 reference_applications。校验脚本检查结构和引用，人工仍须核对原文是否真正支持事实，脚本通过不等于电气设计通过。
