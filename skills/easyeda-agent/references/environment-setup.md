# 安装、连接与恢复

仅在首次使用、升级或连接异常时读取。本地 IR 检查和离线规划不需要打开 EasyEDA；
实际读写、DRC 和原生导图需要已连接的编辑器。

## 安装与升级

CLI/daemon、`easyeda-agent` Skill 和 EDA Agent Connector 是三个必须同版的组成部分；
EasyEDA Pro 是宿主，不参与项目版本号对齐。

安装 metadata 缺失只是诊断信息，不代表 Skill 未安装或不兼容。若当前 Skill、CLI、
Connector 能正常完成 health 与正式调用，继续当前任务；不得自动 update/reinstall/覆盖。
只有用户明确要求更新，或真实 version/protocol incompatibility 已证明阻塞时才执行下列升级命令。

发布版安装 CLI 和 Skill：

```bash
curl -fsSL https://raw.githubusercontent.com/WangONC/easyeda-agent/main/install.sh | bash
easyeda update --check
easyeda update
```

`update --check` 只读，`--check --exit-code` 在有组件落后时返回 10；普通 `update`
更新 CLI 与已安装的 Skill，不能安装或替换编辑器里的连接器。需要安装缺失的客户端
Skill 时用 `--create-missing`，保留本地 Skill 修改用 `--preserve`，固定发布版用
`--version <version>`。更新二进制后还需让 daemon 使用新二进制启动。

在另一台机器或新的终端验证时，固定 Release 版本并使用独立目录，先检查
`easyeda --version`、`easyeda sch compose --help`、`easyeda blocks ls --json`。
这些命令无需 daemon；命令存在且离线规划成功后，再检查连接器与真实页面。
带 `-dirty` 或 git describe 后缀的版本是开发构建，不能作为正式 Release 安装验证的证据。

安装链的后续修复支持 `EASYEDA_INSTALL_DIR` 指定二进制目录，并遵循客户端的
`CODEX_HOME` / `CLAUDE_CONFIG_DIR`；未设置时仍用默认目录。需确认 `command -v easyeda`
指向刚安装的文件，必要时刷新 shell 命令缓存。Windows 下载
`easyeda_windows_amd64.exe` 并命名为 `easyeda.exe`，把所在目录加入 PATH，再运行
`easyeda update --skill-only --create-missing --version <version>` 安装 Skill。
Git Bash/WSL 与原生 Windows 是不同运行环境，选择相应的二进制。

安装/升级失败须保留非零退出码，不能只依据最后一行提示判定成功。普通 Skill 更新
应替换完整发布目录，清理已删除的旧参考；`--preserve` 是混合本地内容，保留旧版本标记，
不能宣称全部文件已升级。daemon 不因 metadata 缺失自动同步 Skill；只有显式
`--auto-update-skill` 或 `easyeda update` 才授权更新。

仓库开发使用 `make build` 构建 CLI，`make install` 安装，`make dev` 保持 daemon
随 Go 代码热重建。`make dev` 会刷新仓库二进制和可写的安装路径；先用 `command -v easyeda`
核对实际 CLI。不要再启动一个后台 daemon 与开发进程交替接管端口。

连接器使用本仓库 GitHub Release 的 `jlceda-agent.eext` 侧载。安装前卸载旧版
Connector，只保留 EDA Agent 一个插件；独立 UUID 不属于上游插件市场条目，
不要从上游市场安装或更新。CLI/daemon 与插件版本一致。

开发连接器：`make connector` 按当前版本/UUID 构建，`make eext` 升 patch 后构建同 UUID
安装包。更换连接器后保存文档，完全退出并重开 EasyEDA，让所有旧页面运行时停止。
只重新导入包不保证已打开页面执行新代码。不要用 IndexedDB 覆写或清空站点数据作为
常规升级方式；它们绕过安装流程且可能破坏扩展或登录状态。

## 确认连接和目标文档

桌面版和网页版使用同一连接器。打开用户指定的宿主、账号和工程，在扩展设置启用
“允许外部交互”。可使用现有浏览器或桌面工具完成已授权的打开操作；只有登录、权限
或界面操作确实无法代办时才请用户介入，不因连接失败擅自换到另一个宿主。

非开发环境在单独终端运行：

```bash
easyeda daemon start
```

当前默认固定监听 **60832**，连接器重试该端口。不要同时启动多个 daemon；端口被其他程序占用时按报错处理，不向后寻找另一个 daemon 端口。
自定义 `--ports` 时还须同步连接器 `daemonPorts` 配置。

```bash
easyeda health --project "<project>"
easyeda doc ls --project "<project>"
easyeda doc switch "<doc-name-or-uuid>" --project "<project>"
```

- 没有 daemon：检查当前安装路径与启动日志；开发环境恢复现有 `make dev`。
- daemon 正常但 `windows` 为空：检查编辑器、登录态、扩展启用和外部交互权限。
- 已连接：核对目标工程/文档、连接器版本及 `versionGate`。按 findings 的修复建议处理
  版本错位；同时核对 `source_revision` / `connectorBuild`，同为 `2.0.0` 但 build 不同仍是混版。
  `--skip-version-check` 不是常规升级或恢复方法。
- 写操作使用 `--project` 和 `--doc`，由 CLI 在派发前实时确认目标文档。没有独立的
  `easyeda context` 命令；`health` 显示连接状态，`doc ls/switch` 读取/切换实时文档。

## 上下文与缓存

`transportId` 会随重连变化；同一 Host 页面运行时的 logical `windowId` 与 activation 保持稳定，
但都不替代项目/文档 UUID。daemon 接收心跳、context 和动作响应来更新窗口信息，过期连接会退休，同一
project/document/tab 的重复连接会去重；缓存清理不需要手工删历史 windowId。

`health` 中的连接上下文不能代替目标页的数据快照。切页、重连或 Apply 后，需要
读取相应文档的新数据；离线文件须记录其来源和采样阶段。要刷新编辑器文档状态时：

```bash
easyeda doc reload "<doc-name-or-uuid>" --project "<project>"
```

它先保存，再关闭并重开文档。PCB 若刷新了铜形或规则，之后运行 `pcb pour-rebuild`
再验证；`doc switch` 只切前台，不等于 reload。文档重载也不等于停止旧连接器运行时。

## 单连接恢复

同一目标页出现多个版本或 windowId、反复注册或写请求超时时，先暂停 Apply，并保留
health、journal 和日志。多个真实工程/窗口可以同时存在；要排除的是同一目标的旧运行时。

1. 先用回读确认最后一条写是否落地；能保存时保存。响应失败不一定代表内容未改变，
   不要直接重放整队列。
2. 检查扩展管理器只保留所选渠道的当前连接器，卸载重复旧项后完全退出并重启 EasyEDA。
   网页版若同一 tab 重载仍无法重连，保存后关闭该 tab，再打开目标工程。
3. 只有 daemon 本身版本或状态异常时才重启它；正式环境用 `easyeda daemon restart`（或 `stop` 后 `start`），它先保存 durable operation handoff，再 graceful shutdown。`make dev` 管理的进程通过其终端恢复。
   若 `health` 明确给出 `v2_legacy_orphan`，表示旧版只留下带 operation ID/digest 的 effect marker、却没有可查询的 durable operation。先用正式只读入口新鲜核对 Host 状态，再由 operator 使用
   `easyeda operation retire-legacy-orphan <operation_id> --digest <digest> --fingerprint <marker_fingerprint> --reason "<核对依据>" --confirm-host-state`。若旧 marker 无完整 operation identity，则省略 operation ID 与 digest，但仍必须逐字匹配 health 给出的 fingerprint。
   该入口只把这个精确 legacy orphan 记为 `RETIRED_UNRESOLVED` 并释放 startup fence，语义 outcome 仍是 `UNKNOWN`，不会重放 mutation，也不会伪造成功；审计记录写入 daemon 状态目录。正常可查询的 durable UNKNOWN 先由 runtime bounded recovery 和 `operation status/evidence/reconcile` 处理，绝不能借 legacy orphan 入口绕过。
   若正常 V2 operation 已有精确 durable evidence 且 `native_settled=true`，但 authoritative fresh verifier 在 bounded recovery 后仍无法归因，才可用 `easyeda operation retire-unresolved <operation_id> --reason "<核对依据>" --confirm-native-settled`。CLI 会从当前 daemon 读取并逐字绑定 digest、evidence fingerprint 与 session；结果不声称成功，而是建立 durable scope quarantine。随后按 `easyeda health` 的 `required_requalification` 分别执行新的 NONE-effect read，再把每个 read operation_id 交给 `easyeda operation requalify <retired-id> <read-id>`。`native_settled=false` 时该入口必须拒绝，hard global barrier 保留。
4. 用 `health` 确认目标只剩预期连接和版本，再读取目标页，例如
   `sch list --page <uuid> --include-pins`。读回稳定且未完成步骤已核清后，再继续 Apply。

恢复后仍有同一错误就根据新日志定位，不循环刷新、批量杀浏览器进程、重发写操作或
清空 IndexedDB。离线数据准备可以继续，原生验证仍未完成时如实标明。

Connector 的产品契约是 daemon restart 后后台自动 reconnect，logical window 不重复、
activation 不变、transport 更新，且不会重放 mutation。若经过 health 显示的多个重连周期仍无窗口，
停止并明确要求用户 reload/reopen EasyEDA Host；不得自动启用 computer-use、UI 或 browser automation 绕过恢复契约。
