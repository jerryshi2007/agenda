# api/ · 后端云函数

微信小程序后端，采用**云函数 / 云开发**架构。首期提供：微信登录、家庭 CRUD、成员管理、日程 CRUD、模板 CRUD、打卡记录、完成统计、订阅消息推送、权限校验。

> **状态**：待开发。开始编码前先完成 Stage 2 架构设计（`dev-architect`），本文件届时补充构建/部署/测试命令。

## 编码约束

后端由 `dev-dotnet` agent 编排 SDD 实现，遵守：

- [`../.claude/rules/dev-code-quality.md`](../.claude/rules/dev-code-quality.md) — 命名、单一职责、YAGNI、复用优先、错误处理只在边界
- [`../.claude/rules/dev-security.md`](../.claude/rules/dev-security.md) — 外部输入必校验、参数化查询、不硬编码密钥、最小权限
- [`../.claude/rules/dev-dotnet-standards.md`](../.claude/rules/dev-dotnet-standards.md) — .NET/C# 规范（若采用 .NET 技术栈）

## 关键设计约束（源自产品需求）

- **数据按家庭隔离**：所有日程数据以家庭为边界，非家庭成员不可访问
- **登录态校验**：所有 API 需携带微信登录态
- **敏感操作二次确认**：删除日程、移除成员等由前端确认，后端做权限校验
- **分页标准化**：列表接口返回 `{ items, totalCount, page, pageSize }`，pageSize 有上限

数据模型概要见 [`../production/requirements/index.md`](../production/requirements/index.md) 第 7 节（概念模型，非数据库设计）。