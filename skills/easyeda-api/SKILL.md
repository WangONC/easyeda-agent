---
name: easyeda-api
description: 嘉立创 EDA 官方 API 与扩展开发参考；实际工程操作统一使用 easyeda-agent 的公开 CLI/MCP，经 Execution V2 执行。
license: MIT
metadata:
  author: WangONC
  version: "2.0.0"
---

# EasyEDA API 参考

本地现有官方 API 文档用于查证原生能力、参数和扩展开发，不是另一套运行入口。
资料来源与原作者 attribution 保留在现有文档中。

实际工程读写使用 easyeda-agent Skill 的公开命令：先 `easyeda health`，再查看对应高层命令 `--help`。
所有公开命令和 MCP domain 工具内部走同一 Execution V2；MCP 只提供 action、input 和可选逻辑窗口/工程/文档选择器。
不要启动独立 WebSocket Bridge，不执行任意脚本，不手写内部请求 envelope、会话标识或 schema，也不查源码目录拼调用。

多窗口必须明确选择。UNKNOWN/PARTIAL 不算成功，不重放；通过 `easyeda operation status <id>` 或 `easyeda operation reconcile <id>` 读取原操作状态。

需要查阅 API 时使用 `easyeda api search` / `easyeda api show` 或已安装的官方参考文档；查阅资料不授权绕过 V2 操作工程。
