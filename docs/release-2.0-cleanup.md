# EDA Agent 2.0 发布整理

## 最终身份

- 项目/CLI/Skill：easyeda-agent / easyeda / easyeda-agent，不变。
- 插件 name：jlceda-agent；displayName：EDA Agent（用户最终决定）。
- 新永久 UUID：2d9eaf157def4e1da312a15852404d71。
- publisher / author：WangONC；版本：2.0.0。
- 原创图标：extension/images/jlceda-agent.svg；通过 sharp 等比例导出同目录 PNG，manifest 引用 PNG。包内保留 SVG；不包含旧 logo.jpg。

旧 UUID 置空后，由现有官方模板 build/packaged.ts 的 crypto.randomUUID 流程生成新 UUID 并写回 manifest。之后重新编译/打包和 bump 2.0.0 均确认 UUID 不变。不是修改旧 UUID 字符，也不是每次构建新建身份。

## 菜单与 UI

真实根因是菜单存在但回调只输出 console，而非缺少 manifest 注册。静态 headerMenus 保留 home/blank/sch/symbol/pcb/footprint 六个环境，不新增动态注册。

顶级菜单 EDA Agent：重新连接、停止连接、自动连接、关于。前三项轻量 Toast；自动连接设置失败也给 Toast。关于仅三行：名称、版本、连接状态。维护者说明从状态 UI/manifest 描述移除，作者元数据保留。

关于读取 daemon 心跳；Home 以精确 Home tab 匹配，不将其它文档注册误认为本页连接。没有新增 typed action 或更改 execution semantics。

独立身份不再是上游插件的原地升级。安装前卸载旧 Connector；双插件同时启用可产生多个执行端/菜单，不建立兼容共存机制。安装 smoke 仅菜单/连接，不操作设计。

## 发布配置来源

| 来源 | 作用 |
| --- | --- |
| extension/extension.json | 永久身份、菜单、logo、版本、仓库 |
| extension/package.json 与 lock | npm 身份/作者/版本 |
| extension/scripts/bump.mjs | 统一同步 manifest、根 package、MCP package/locks、Skill 版本 |
| esbuild.common.ts | 从 manifest 注入 Connector 握手版本 |
| Makefile / internal/version | 正式 CLI/daemon ldflags 读 manifest；dev 仍允许 dev 标识 |
| mcp/src/server.mjs | 从 MCP package 读取版本 |
| selfupdate / version_gate / hub / cmd_update | WangONC Release 查询/版本提示/下载 |
| install.sh / release-check / release-smoke / Makefile | 发布资产名 jlceda-agent.eext 与版本一致性 |
| .gitattributes / pack-skill.py | shell 固定 LF，Skill tar 使用 POSIX 成员路径 |

所有正式版本元数据为 2.0.0，更新源为 https://github.com/WangONC/easyeda-agent。当前 Releases/latest 实际返回 404，尚无公开 Release，不回退上游；本轮不创建 tag/Release。Go module 路径、LICENSE 和历史贡献保留；它们不是更新源。

根 README.md / README.en.md 无本次 diff，不重写。上轮已存在的 extension README 整理保留，仅机械调整身份；后续主 README 单独整理。

## 验证

- Connector 最终全量 863 PASS；最终 Toast/About/Home/重连结果定向 10 PASS。
- typecheck / production bundle / package / catalog 一致性 PASS。
- 发布安装脚本 WSL 41 PASS；Windows packaging 11 PASS（此前同一发布整理）。
- Go selfupdate/app/daemon PASS。首次全组运行 Windows Go runtime signal 异常；隔离重跑通过，未修改业务代码。
- MCP 此次发布整理 28 PASS / 1 Host opt-in SKIP；未将 SKIP 当 Host PASS。
- 新包：extension/build/dist/jlceda-agent_v2.0.0.eext。
- SHA256：54C171D8FF8D05E57DDFD19781C79F41BD343013F0BF4DC1AD46E5F355B3EA76。
- 用户已安装最终包并确认重连结果 Toast 正常；关于简版/中文菜单此前反馈已纳入。daemon 实测 Connector 2.0.0 可连接。未进行设计 E2E。

## Git 边界

已接受 V2 提交 60a0bad9dab303a55052caa756eae695cd67e35c 原样存在远端 codex/execution-v2。
origin/main=594f78b3204ab0ff1110ff6aa7219ab6c0bef726 不是当前 HEAD 的祖先，两支真实分叉。用户只授权 fast-forward，因此不推送 main、不 force、不 merge/rebase，也不删除尚未由 main 包含的远端分支。发布整理可形成独立本地提交；远端收敛需要用户后续决定。

重连结果 Toast 观察单次重连的实际 handshakeVerified + windowId；成功、10 秒超时、异常、取消均有定向测试。停止连接取消旧提示，不修改 transport/executor 的重试语义。

现场 health 仍记录多个 2.0.0 activation（含过期注册），不将其表述为单执行端资格证明。本轮只验菜单反馈，未扩展 transport/Host 生命周期架构；独立插件与旧 Connector 应卸载后再安装，不能同时运行。
