# app/ · 微信小程序前端

## 目录结构

```
app/
├── miniapp/         # 微信小程序正式应用项目（源码，微信开发者工具打开此目录）
└── miniapp-test/    # Jest 测试项目（引用 miniapp/ 源码）
```

构建/校验/测试命令见仓库根 [`../CLAUDE.md`](../CLAUDE.md) 命令速查。

家长端 + 孩子端在同一小程序内通过角色区分。首期提供：日历三视图（月/周/日）、日程 CRUD、认证、家庭与成员管理、模板、打卡与完成统计。

> **状态**：开发中。日程管理 + 认证 + 家庭 + 打卡 + 模板模块前端均已就绪。

## 编码约束

前端由 `dev-miniapp` agent 编排 SDD 实现，遵守：

- [`../.claude/rules/dev-miniapp-standards.md`](../.claude/rules/dev-miniapp-standards.md) — 微信小程序编码规范，**含 `data-id` 可测试性契约**
- [`../.claude/rules/ui-miniapp-standards.md`](../.claude/rules/ui-miniapp-standards.md) — 小程序 UI 标准（WeUI 设计变量、rpx、原生组件层级、安全区域）
- [`../.claude/rules/dev-code-quality.md`](../.claude/rules/dev-code-quality.md) — 命名、单一职责、YAGNI、复用优先
- [`../.claude/rules/dev-security.md`](../.claude/rules/dev-security.md) — 安全底线

## 关键设计约束（源自产品需求）

- **双端角色区分**：家长端（规划管理）+ 孩子端（查看打卡），同一小程序内切换
- **性能底线**：首屏 ≤ 2s、视图切换 ≤ 500ms、打卡响应 ≤ 1s
- **数据按家庭隔离**：所有日程数据以家庭为边界
- **敏感操作二次确认**：删除日程、移除成员等由前端确认，后端做权限校验

数据模型概要见 [`../production/requirements/index.md`](../production/requirements/index.md) 第 6、7 节（页面结构、概念模型）。
