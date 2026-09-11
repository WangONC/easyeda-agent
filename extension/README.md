# EDA Agent

面向嘉立创 EDA 的开源 AI Agent 连接插件，非官方插件。

- 当前维护者：WangONC
- 版本：2.0.0（CLI、daemon、Connector、MCP、Skill 同版）
- 项目：https://github.com/WangONC/easyeda-agent
- 更新与下载：https://github.com/WangONC/easyeda-agent/releases
- 问题反馈：https://github.com/WangONC/easyeda-agent/issues

## 安装与菜单

先启动同版 easyeda daemon，再导入 Release 中的 `.eext`。侧载更新需卸载旧版后导入并完整重开；2.0 使用独立 name/UUID；安装前卸载旧 Connector，不同时启用两者。

Home、原理图、PCB 等环境的 EDA Agent 菜单提供：

- 重新连接
- 停止连接
- 自动连接
- 关于：只显示名称、版本和连接状态

菜单点击有中文可见反馈。无工程或服务不可用时，状态检查会明确报告，不能把发起连接当成已连接。

检查更新：`easyeda update --check`。下载源为 WangONC Releases；没有发布 Release 时会报告不可用，不回退上游。

## 2.0 边界

Execution V2 已完成真实 E2E 验收。后续 schematic ECO 自动同步受 Host API 限制；允许 operator/UI-assisted 操作后 exact rebind/readback。Host 生命周期异常允许人工恢复。制造结构检查不等于工厂 DFM 认证。

## 来源与许可

基于 [zhoushoujianwork/easyeda-agent](https://github.com/zhoushoujianwork/easyeda-agent) 演进。保留原项目 LICENSE 与历史贡献；当前 fork 的维护者与发布地址独立于上游。
