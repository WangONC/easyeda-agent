# EasyEDA PCB — 布线 / 铺铜 / 禁布区 / 填充区域

> 从 [`pcb.md`](pcb.md) 拆出(RFC #178):这几节只在**动铜**时才需要,不该压在每次 PCB 调用的上下文里。
入口、坐标系、Workflow、Guardrails、`doc reload` 门仍在 `pcb.md` —— **先读它**,再按需读本文件。

---

## Routing Engineering Guidelines

以下是工程意图明确后的默认工作方法，不是新的 DRC、评分器或硬 gate。决策优先级：
**电气功能 / topology → SI / PI / return path / timing / current path →
manufacturing / mechanical / package escape → routing group strategy → geometry consistency / craftsmanship**。
低优先级偏好不得为“更漂亮”损害高优先级目标。这个顺序用于可行方案间的取舍，
不覆盖已确认的安全、制造硬约束或机械锁定；这些仍按
[布局约定](pcb-layout-conventions.md)处理。元件旋转/丝印朝向约定不等于走线角度规则。
本节不授权换用自动布线；严格手工任务沿用 [Fast Path](fast-manual-pcb.md) 和
[RevB contract](revb-agent-contract.md) 的批处理、门禁与验证节奏。下文 primitive 示例是能力说明，不是逐网事务策略。

### Group Before Net

DDR、FIFO、并行 bus、差分接口及其它明显成组的网络，默认先形成组级策略：
corridor、preferred layer set、escape direction、成员 ordering、via strategy，
以及需要时的 tuning region，再处理单网。宜把组的路径资源一起考虑，
而不是默认每网独立找一条合法路径；组策略不要求每个成员具有完全相同的 layer sequence。

### Ordinary Routing Geometry

没有特殊几何目的的普通信号，宜采用简单、一致的几何，通常优先水平、垂直和 45° 斜线。
这不是 DRC 硬规则或 SI 定律。BGA/fine-pitch、连接器 pin-field escape、RF/天线/受控几何、
差分、正式 length tuning/serpentine、大电流/power copper、polygon/fill/局部异形铜、
机械避让及其它有工程目的的几何均可有合理例外；不要为视觉上的 45° 牺牲高优先级目标。

### Intentional Layer / Via Strategy

换层和 signal via 宜服务于明确的实际换层、escape、corridor、reference strategy 或 intentional branch。
短距离 A→B→A、反复 layer ping-pong 和历史修改留下的 via 宜重新审视其目的，
而不是按固定最大 via 数裁决；保留有真实工程作用的结构。

### Coupled Structures as Objects

差分对、byte lane、equal-length group 及其它共享约束的网络组，宜作为耦合结构考虑。
差分对优先按 **common corridor → paired geometry → intentional transitions → residual skew** 处理，
使用现有 pair helper 展开明确意图。P/N 最终长度相等不自动证明整体几何合适；仍需结合参考、耦合及转换区域。

### Tuning Is Intentional Geometry

宜按 **主体 routing → measurement → tuning target → designated corridor → 正式 tuning helper** 完成，
再通过既有 preflight/apply/readback 和测量核对结果；不要在普通 routing 中为凑长度随手堆折返。
正式 serpentine/meander 本身可能有大量 segment、方向反复和非单调路径；这些事实不能单独判质量，
宜结合目标、pitch/amplitude、空间、耦合及实际增加长度判断，长度不同也不自动意味着需要 tuning。

### Routing Ends With Cleanup

All Nets Connected 不等于 Routing 完成。最终 DRC 前宜做一次 Routing Cleanup 复核：
过程残留、可能无目的的 via/tail、重复或重叠同网铜、same-net loop、局部碎折线、
无理由 layer hopping、组内明显离群成员及差分对不一致。先核对设计意图，再决定是否修改；
这是一轮工程复核，不是自动 detector 或新硬 gate，也不意味着发现这些形态就应删除。

### Telemetry: scope follows the edit

**Report scope should match mutation scope.** 需要统计时，单网/小批修改优先用
`pcb.report` 的 `telemetry:true,nets:[...]`；组完成后查看该组，阶段结束再看 board summary，
不默认每改一根线就重复整板报告。复用当前 project/document identity；telemetry 独立调用，
不与 profile/path 等测量选项混用，也不替代 authoritative readback 或既有验证。
长度、line/arc 组成、orientation、via 和 layer usage 只是事实，宜结合网络角色和设计 intent 解读。
单个角度、via 数、长度或层使用方式都不足以判错；方向桶只覆盖直线，arc 不参与。
铜长是平面内 trace+arc 中心线长度，不含 via 垂直段、封装内部长度或传播延迟；
`routedNetCount` 仅表示正铜长，不表示连通完成。不要从这些统计推断工具未提供的缺陷结论。

### 关键网与叠层

`pcb route-critical --spec <S0.json> --dry-run` 先检查真实铜层数与关键网方案。
执行时沿用同一份 spec；`stackup.layers` 与活板不一致，或读不到可靠铜层证据，
命令会在布线前拒绝。先用 `pcb layers` 检查；遇 `STALE_READ` 按提示 reload 后重读。
不把未启用的内层、图层总数或默认两层当成真实叠层。

- 两层板的电源步走 `pcb power-pour`；四层及以上走 `pcb power-planes`。
  `route-critical --allow-stackup-change` 不会把正常两层板改走内电层。
- 独立 `power-planes` 要求至少四层；已有六层等叠层保持原层数。
  只有用户已明确授权将已确认的两层板升级为四层，才使用
  `pcb power-planes --allow-stackup-change`。未知层数不能被此开关绕过。
- `power-planes --dry-run` 运行相同叠层预检；允许升级时，结果中的 `stackup`
  明确列出当前层数、目标层数、证据来源和是否需要修改，不写入板子。
  需要改变已确定的设计叠层时，应先单独确认需求并更新 S0，不能为方便布线擅改。

### Routing (copper tracks + vias)

Real routing primitives — **additive creates** (no confirm), like the schematic
`wire.create`. Bind to a net **by name** (pull from `pcb.nets.list`); layer ids from
`pcb.layers.list`. EasyEDA's `create()` is **lenient** — it can return no primitive on a
bad layer/coords without throwing, so each action verifies a primitive came back and
fails honestly otherwise. **PCB autosave is on** (debounced) — still **save explicitly**
at checkpoints. There is **no one-call autorouter** on this build
(`pcb_Document.autoRouting` is undefined — see `docs/ecosystem-survey.md` §6/§7); route
segment-by-segment, or use the file-exchange autoroute flow. **布线档如何选见
[`design-flow.md`](./design-flow.md) P7 三档阶梯——稠密板默认不是 file-exchange autoroute,而是
请用户点 EasyEDA 原生「布线→自动布线」(人机协作档);Freerouting 仅全 headless 无人可点时兜底。**

- `pcb.line.create` — a copper **track** (导线): line segment on a copper layer
  (`TOP=1`, `BOTTOM=2`; **inner-copper ids are higher** — `id 3` is silkscreen, not
  copper, so read real ids from `pcb.layers.list`) between `(startX,startY)` and
  `(endX,endY)` (mil, y-up), `lineWidth` (default 6 mil), optional `net`. Verify with
  `pcb.drc.check`.
- `pcb.via.create` — a **via** (过孔) at `(x,y)` with `holeDiameter` (drill, default 12
  mil) + `diameter` (outer pad, default 24 mil), optional `net`.
- `pcb.line.list` / `pcb.via.list` — read what's routed (filter by net/layer) before
  rip-up or reroute.
- `pcb.route.rip_up` — **reliable rip-up**: delete tracks+arcs+vias, `--net` to scope
  (string or list) or omit for ALL. **Copper layers only** — never deletes the board
  outline, silkscreen/assembly/mechanical artwork, or **locked** primitives. The
  iteration primitive: `rip_up → re-route`. (Reports `{requested, ok}` per type, since
  `delete()` is a batch boolean.)
- `easyeda pcb clear` (`pcb.page.clear`) — **一键整版复位**,`sch clear` 的 PCB 对称版。
  一次删掉所有**板级内容** primitive:器件 + 布线(轨/弧/过孔)+ 铺铜/填充(pour/fill)+
  keep-out/规则区域 + 自由丝印(**丝印层 3/4** 的字符串 + 线/弧图形,不碰铜层/文档层的自由文字或
  机械/装配线弧)。`pcb delete`(`pcb.component.delete`)**只删器件**,
  布线/铺铜/区域/丝印会静默残留(`components.list` 看着空了、铜其实还在)——要真正清板重来
  用这个。**默认保留锁定图元 + 板框(layer 11)**(板框是布局前提,和 `sch clear` 保留图框对称)。
  收窄:`--only components,routing,copper,regions,silk`(逗号子集,省略 = 全部);`--no-preserve-outline`
  连板框一起删;`--include-locked` 连锁定图元一起删(危险)。**无 undo**,确认门控。
  **默认自带 verify 复合流程(#121)**:清 → save → `doc reload` → 二遍清 → 最终 dry-run 计数——
  部分图元只在 save/reload 时被引擎物化,单次 handler 调用内任何枚举(含 #112 的循环)都看不到
  (R2 实测 reload 后冒出 3 条轨);返回 `{pass1, pass2, remainingAfterVerify, verified}`,
  `remainingAfterVerify` 非零 = 锁定/保留件或更深的引擎问题,绝不假报干净。`--no-verify` 回到
  单遍(快,但你要自己 reload 后 `--dry-run` 复查)。
  ⚠️ **破坏性**:生产流程必须**先 `--dry-run` 报告删除计数、等用户确认**,再执行。
  生成→检测→清板→重试闭环用这个。
- `easyeda pcb via-delete --ids …` / `pcb track-delete --ids …` (`pcb.route.delete`) —
  **surgical delete by primitiveId**: one bad via no longer costs re-routing the whole
  net (rip-up is net-scoped). Ids come from `pcb via-list` / `pcb track-list` / `pcb drc
  --json` `objs`; **pull them fresh — ids churn after edits**. `--ids` takes **CSV
  (`id1,id2`) or a JSON array (`'["id1","id2"]'`) — both work**; all delete-by-id
  commands (`pcb delete` / `pour-delete` / `region delete` / `fill delete` /
  `track-delete` / `via-delete`) now accept both formats (issue #109), so `pcb drc
  --json` `objs` arrays paste straight in. Each subcommand guards its
  kind (pasting track ids into `via-delete` errors out); locked primitives are skipped,
  stale ids reported as `notFound`. The result's `removed[]` echoes each primitive's full
  before-state (net/layer/geometry) so the audit log can recreate it. **Embedded-primitive
  pre-check + readback (#120, live-verified)**: a footprint-embedded via's id is its
  parent component's primitiveId + a suffix (`ba45…f3` + `e184`); deleting one lies
  TWICE — the SDK returns true AND an immediate getAll shows it gone, but the next
  save/reload re-materializes it from the footprint. The handler refuses these UPFRONT
  (`notDeletable[]` with the parent component + `ok:false`; use `pcb via-bond` to net
  them, or delete the whole component) and additionally readback-verifies the rest
  (`removed`/`count` only count what actually vanished; unattributable survivors land
  in `notDeleted`). ⚠️ **After surgical
  edits (delete/via-hop/fill changes), a burst of same-net (usually GND) Connection
  Errors in DRC is pour-mediated connectivity gone stale, not real breaks — run
  `pcb pour-rebuild` first, then re-judge** (verified live: 11→1 baseline).
- `easyeda pcb via-bond [--component U1] [--dry-run]` — **bond netless footprint-embedded
  vias (EPAD thermal vias) to the net of the pad they sit in** (#118). Scans every net:""
  via whose center sits inside a net-carrying pad's copper rect and assigns that pad's
  net via raw `eda.pcb_PrimitiveVia.modify` (debug-exec backed — works on every deployed
  connector, no re-import). Idempotent, readback-verified (`{planned, assigned, verified}`).
  ⚠️ **Platform limit (live-verified)**: the assignment does NOT survive a doc reload —
  embedded vias re-materialize netless every time; re-run after any reload, before
  DRC / power-planes. `pcb check`'s **netless-via-in-pad** WARN fires whenever a re-bond
  is due, with this command as the fix.
- `easyeda pcb via-hop --net N --from-x … --from-y … --to-x … --to-y …`
  (`pcb.route.via_hop`) — **composite layer hop**: entry stub → via → hop-layer track →
  via → exit stub. **track↔via registers as connected on its own** — no bond fill needed
  (see the truth table below). Vias sit `--stub` (default 20mil) inside the endpoints so
  they stay **off pads** (via-on-pad ≠ connected). `--layer` (default 1=TOP) /
  `--hop-layer` (default 2=BOTTOM), `--width`. `--bond-fill` (default **off**) adds
  optional extra copper over the vias for thermal/current — not for connectivity. Rolls
  back everything it created on mid-sequence failure. Verify with `pcb drc`.
- `pcb.clear_routing` — native `clearRouting` (`@alpha`, may be undefined on this build,
  and does NOT protect unlocked outline) — prefer `pcb.route.rip_up`.

#### 连通性键合真值表 (what actually registers as CONNECTED)

⚠️ **Corrected 2026-07-07 (跟进 pro-api-sdk#31).** The earlier claim — "track↔via does
not register on 4-layer / ex-PLANE boards, a bond fill is the only reliable bridge" —
was **our misdiagnosis** and has been retracted (official confirmed live; we reproduced
the correction on real hardware). What actually happened: DRC Connection Errors are
driven by netlist **ratlines**; a `track(L1)→via→track(L2)→via→track(L1)` bridge between
two same-net pads **satisfies the ratline and clears the error** in every plane state
(clean 4-layer / Inner=PLANE / flipped SIGNAL↔PLANE — all tested). The original
"+5V/U0TXD floating" symptom was **stale pour-mediated GND connectivity**, cured by
`pcb pour-rebuild` (same phenomenon as the ⚠️ note under `via-delete` above) — the fills
that "fixed" it were a red herring; the re-pour/recompute did the work.

| junction | registers? |
|---|---|
| track endpoint on a via (center or inside via copper) | ✅ (needs a fresh ratline recompute) |
| via on a track's body (mid-segment) | ✅ |
| pad ↔ track endpoint at pad center | ✅ |
| net-bound FILL overlapping via + track | ✅ (works, but **not** required) |
| pour (same net) flowing over via | ✅ (but pour reflow has its own traps — see pour section) |
| via ON a pad | ⚠️ offset + stub anyway (a via centered on a pad is redundant, not a bond failure) |

**Via-bridge SOP**: just route the hop with `pcb via-hop` — no bond fill needed. If DRC
shows same-net (usually GND) Connection Errors after routing surgery, that's **stale
pour connectivity**: run `pcb pour-rebuild`, let ratlines recompute, then re-judge — do
**not** paper over it with fills.

### Length constraints — differential pairs / equal-length groups (#176)

**布线前声明,布线后量。** 差分对与等长组是**约束对象**,不是走线:建了它们,EasyEDA 的 DRC 才把
两条网当一对查,`easyeda pcb report` 的 `skew`(|lenP−lenN|)/`spread`(max−min)才有东西可量。
不建 → 那两个数组恒空,报告里的测量能力空转。

```bash
# 差分对(USB / 以太网 / HDMI 这类)
easyeda pcb diff-pair create --name USB0 --positive USB_DP --negative USB_DM
easyeda pcb diff-pair list                       # 约束清单(≠ pcb report 的测量值)
easyeda pcb diff-pair rename --name USB0 --to USB
easyeda pcb diff-pair delete --name USB

# 等长网络组(并行总线 / 地址线),至少 2 条网
easyeda pcb eq-group create --name DDR_ADDR --nets A0,A1,A2
easyeda pcb eq-group add    --name DDR_ADDR --nets A3,A4     # 已是成员的自动跳过
easyeda pcb eq-group delete --name DDR_ADDR
```

**要点**(真机验过):网名**前置校验**,指向板上没有的网 = 零写入拒绝并点名(网名大小写敏感、来自
原理图,用 `easyeda pcb nets` 取准);回执的 `verified` 是连接器**重读比对**出来的,不是平台返回值;
同名同内容重建 = `alreadyExists`(可重放),同名不同内容 = 拒绝并给下一步;差分对**只能改名**,
要换绑定得删了重建。改完再读先 `easyeda doc reload`(铁律 5 的 `STALE_READ` 门会拦)。

**在流程里的位置**:P7 布线之前建好 → `route-critical` / 手工布线 → `easyeda pcb report` 回读
skew/spread 验收。

### Copper pour (铺铜)

A pour is a net-bound copper region (usually GND/power plane). **The agent passes raw
points** — the connector builds the `IPCB_Polygon` (`pcb_MathPolygon.createPolygon`)
and re-pours; passing raw points to the bare `eda.*` create fails ("无法创建覆铜边框图元").

- `pcb.pour.create` — pour from a closed polygon `points` (`[[x,y],…]`, mil, y-up) on a
  copper layer, bound to a `net` (**required — a netless pour is dead copper; `pcb pour`
  now refuses an empty `--net`, issue #34**). `fill = solid` (default) `| grid | grid45`.
  Size it to the board outline; verify `poured:true` + `pcb.drc.check`.
- `pcb.pour.list` / `pcb.pour.delete` — inspect / remove pours.
- `pcb pour-clean --netless` (daemon-side) — remove pours bound to **no net** (net:"" dead
  copper that `pour-fit --replace` can't clear — it only matches same-net pours). `--dry-run`
  lists them first. Detected by `pcb check` (netless-pour rule).
- `pcb.pour.rebuild` — re-pour all (or by net) after moving components/routing so the
  copper reflows around new obstacles.
- `pcb pour-fit` (daemon-side) — **auto-size a pour to the board**: reads the outline
  and insets its bbox by `--inset` (mil, default 20) so copper keeps edge clearance
  (fixes Board-Outline-to-Copper), then pours `--net`/`--layer`. `--replace` (default)
  clears the net's existing pours first so they don't stack. v1 pours a RECTANGLE within
  the bbox; for an odd outline draw a custom polygon with `pcb pour`. `--dry-run` previews.
- `pcb via-stitch` (daemon-side) — fill a `--rect "x0,y0,x1,y1"` with a `--pitch`-spaced
  grid of `--net` vias: **thermal vias** under a power-IC center pad (tie it to the GND
  plane) or **GND stitching** between top & bottom pours. Run `pcb pour-rebuild` after so
  the planes reflow onto the new vias. `--margin` insets from the rect edges. `--dry-run`.

### Keep-out / rule regions (禁止区域)

A region (`eda.pcb_PrimitiveRegion`) is a polygon carrying **rule types** that keep
things OUT of an area — antenna clearance, board-edge inset, mechanical exclusion.
It is **NOT net-bound copper** (that's a pour) — `create` takes no net. EasyEDA's own
DRC + copper pour respect it (a pour avoids a `no-pours` region). Same raw-points
convention as pour (connector builds the polygon).

- `pcb region create` (`pcb.region.create`) — specify the area **three ways** (pick one):
  `--points '[[x,y],…]'` (explicit polygon), `--rect x0,y0,x1,y1` (rectangular
  shorthand), or **`--ref <designator>`** (the placed component's bbox — e.g. the
  antenna module). `--margin <mil>` expands the `--rect`/`--ref` box outward (antenna
  clearance). `--rule` (repeatable, name or enum number): `no-components(2)` /
  `no-wires(5)` / `no-fills(6)` / `no-pours(7)` / `no-inner-electrical(8)` /
  `follow-rule(9)`. **Default** (no `--rule`) is a hard keep-out
  `[no-components, no-wires, no-pours]` — the antenna / board-edge case. `--locked`
  pins it. Verify with `pcb region list` + `pcb drc`.
  E.g. antenna keep-out under U1: `pcb region create --ref U1 --margin 40 --rule no-pours`.
- `pcb region list` / `pcb region delete` — inspect / remove (note `pcb delete`
  removes components, NOT regions — use `region delete`). `--ids` takes CSV or a
  JSON array.

> **Read-back limit (verified #18):** `--name` on a region is fire-and-forget —
> `getState_RegionName` never reads it back, so `region list` shows `null` and the
> injected DSN keepout is named `region_keepout_N`. Likewise `pcb fill`'s `fillMode`
> always reads back `solid`. Geometry / layer / net / **ruleType** persist fine —
> just don't gate logic on reading a region's name or a fill's mode. Platform SDK
> quirk (same family as the netflag rotation echo trap), not fixable from here.

> **ESP32-S3-WROOM-1 ships with NO antenna keep-out** — you must create it (test-case
> P1). **`getDsnFile` drops regions**, but `pcb export-dsn` now **re-injects** them as
> Specctra `(keepout (polygon …))` by default (reports `keepouts=N`; `--raw` to skip),
> so external Freerouting no longer routes under the antenna. Transform is a verified
> pure translation (1:1 mil, no flip).

### Net-bound filled region (填充区域 / 异形大块铜)

`eda.pcb_PrimitiveFill` — a **STATIC filled polygon bound to a net** (a 3V3/RF-ground
patch, thermal copper, an odd-shaped plane). Three net-copper primitives, don't confuse:
**fill** (static, no reflow), **pour** (`覆铜`, reflows around obstacles), **region**
(keep-out, no net). Same raw-points convention.

- `pcb fill create` (`pcb.fill.create`) — area via `--points` | `--rect x0,y0,x1,y1` |
  `--at x,y --size w,h` | `--ref <designator>` (+ `--margin`), on a `--layer`, bound to
  `--net`. `--fill-mode solid` (default) `| mesh | inner`. `--locked`. Verify with
  `pcb fill list`. ⚠️ **`--rect` 的四个数是两个对角点 `x0,y0,x1,y1`,不是 `x,y,宽,高`**
  (issue #109 实踩:按 x,y,w,h 传参生成盖住 USB-C 区的巨型 fill,原生 DRC 爆 ~50 条)——
  想按「角点 + 宽高」表达就用 **`--at x,y --size w,h`**(与 `--rect` 互斥,`--size` 从
  `--at` 向 +x/+y 延伸)。**防呆护栏**:fill bbox 面积 > 板框 bbox 的 **25%**(板框可读时;
  读不到板框则 > 4,000,000 mil² ≈ 50×50mm)直接拒绝,报错教两角点语义;确属故意的超大 fill
  加 `--force-large` 放行。
- `pcb fill list` / `pcb fill delete` — inspect / remove (filter list by `--layer`/`--net`);
  `delete --ids` takes CSV or a JSON array.

**Board cutout / slot (挖槽) — `pcb slot`.** A fill on the **MULTI layer (12)** IS a
board cutout (per the eda API: *"填充所属层为 MULTI 时代表挖槽区域"*; manufacturing
emits it as a `BoardCutout`). `pcb slot --rect … | --ref ANT1 --margin 20` mills a
hole — antenna isolation / mechanical opening. No net. It's a `pcb_PrimitiveFill` on
layer 12, so list/delete via `pcb fill list --layer 12` / `pcb fill delete`.

**M3 安装孔 — `pcb mount-holes`** (issue #102). Places corner mounting holes
**automatically and collision-checked** — never hand-place M3 holes at guessed
coordinates (#102: a blind hole landed on C1). Reads the real board outline
(errors without one — run `pcb outline-fit` first), computes each corner center
at `--inset` (default 197mil ≈ 5mm) from both edges, and mills a near-circular
MULTI-layer cutout (`--dia` default 126mil = M3 Ø3.2mm) — the same primitive as
`pcb slot`, so `pcb place-constrained` avoids it as a **Tier-1 obstacle** and
`pcb check` keeps copper off the milled edge. Each corner is checked against
every component's rendered bbox with the fastener keep-out radius
`max(hole R+40mil, M3 washer R118mil)` (conventions §2.3): a conflicting corner
is **warned + skipped**, never force-placed (`--clearance` overrides the radius
for a smaller fastener head you knowingly accept); a corner that already has a
cutout reports `exists` (idempotent rerun). `--corners tl,tr,bl,br` picks a
subset; `--dry-run` prints the per-corner plan. Save after placing; delete via
`pcb fill list --layer 12` + `pcb fill delete`.

  easyeda pcb mount-holes --dry-run          # plan only
  easyeda pcb mount-holes                    # 4 corners, M3 defaults
  easyeda pcb mount-holes --corners tl,tr --inset 250
> **Snapshot can't confirm it visually** — `pcb snapshot` (`getCurrentRenderedAreaImage`)
> does NOT auto-redraw after API edits and does not render filled copper/cutouts, so a
> fresh snapshot shows a **stale frame**. Verify slots/fills/pours by **data** (`pcb fill
> list`, DRC, manufacture export), not screenshot — the snapshot is for component layout only.
>
> **Stale-frame detection (issue #31).** `pcb snapshot` carries the anti-stale machinery (the schematic-side snapshot was removed — sch renders via `sch export-image`):
> the result exposes a frame `sha256`, and `--previous-sha256 <sha>` lets the connector
> detect a byte-identical (stale) frame, force a redraw (ratline recompute + zoom-to-all)
> and retry once, reporting `stale:true` if it still cannot refresh. **Reliable recording
> workflow** for user-facing videos/tutorials where the visual artifact is required:
> 1. `easyeda view region --left … --right … --top … --bottom …`（或 `easyeda view fit`）框住目标视口。
> 2. `easyeda pcb snapshot --fit=false --previous-sha256 <上一次的 sha256>`。
> 3. 若结果 `stale:true`，说明画布未刷新 — 告警/失败，不要用该帧。
> 4. 用 `pcb list` / `pcb drc` / `pcb check` / `pcb layout-lint` 做**权威**正确性校验（截图只作视觉终检）。
>
> **底面视觉 QA（issue #40）** — 不再需要人工点 UI 切层。`easyeda pcb view-side --side bottom`
> 会选底铜为当前层并聚焦底面铜+丝印层，随后 `easyeda pcb snapshot`（thread `--previous-sha256`
> 防陈帧）即反映底面（底丝印/底铜/背面装配标记）。更细的显隐用 `easyeda pcb layer-visibility
> --preset bottom-only|top-only|copper-only|silk-only` 或 `--show/--hide`。切当前编辑层用
> `easyeda pcb layer-set --layer bottom|Inner1|<id>`。**注意**：EasyEDA 无原生画布翻面/镜像视图
> API，`view-side` 是「层聚焦」近似（切当前层 + 只显示该面层），不是物理翻板；丝印极性仍以
> `pcb check` 的 silkscreen-flipped 规则（`layer=4` + `mirror=true`）做数据级判定为准。

> **Routing boundary (load-bearing — see `docs/ecosystem-survey.md` §7):** EasyEDA's
> interactive 布线 menu (single/multi/differential **routing**, stretch, optimize,
> length-tuning/serpentine, fanout, remove-loops) has **NO `eda.*` API** — the agent
> cannot do smart/avoiding/push-and-shove routing. Programmatic routing is limited to:
> create tracks/vias/pours by coordinate (above), rip-up, the `@alpha` `autoRouting`
> (undefined on 3.2.148), or read-primitives → external engine → write (the official
> kirouting pattern). So route segment-by-segment, pour planes, and leave smart routing
> to the human/UI. **Shipped: copper pour + rip-up (R1/R2).** **net-class WIDTHS
> are shipped daemon-side** (R3-width): `pcb net-classes` prints the role→spec-width
> ladder, `route-short` sizes each net by role (signal / power-branch / power-trunk /
> high-current — `pcb_netclass.go`), and `pcb check` **width-under-spec** gates
> under-sized power tracks. Still pending: writing those roles into EasyEDA's NATIVE
> net-class rules (`createNetClass`/`overwriteNetRules`, @beta — so the native DRC
> enforces per-class width) + diff-pair/equal-length **definitions** (read side is
> in `pcb.report`).


### EasyEDA 等长设置（1.4.11）

正式 `route.tuning_plan` 优先使用 `target_mode:specified_length` 和最终
`target_length`，配合选定 `span_id`、固定 `corridor`、`corner:line_45|line_90|arc_90`、
`side:single|bilateral`、`spacing_w`、`min_amplitude_h`（mil）。工具读取当前网络平面
铜长后求解增量；它不是端点路径/时延求解器。单边 corridor 应明确唯一摆动方向；双边
从有向 span 的左法向开始交替。W 是中心线间距，H 是最小振幅。

默认链：目标工程判断 → tuning plan → preflight → apply → reload/readback → report
复测，检查实际 residual 与返回 tolerance。`arc_90` 使用真实 Arc；不手算半径或逐点拼
蛇形。`follow_rule` 在无法证明唯一权威目标时明确拒绝，此时先完成工程判断再指定长度，
不猜规则上下界。旧 rectangular/rounded、radius/pitch 等仅兼容内部旧调用，不作为新的
Agent 正式参数。不要实现或请求其它 CAD 产品的 tuning pattern。
