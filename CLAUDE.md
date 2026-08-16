# CLAUDE.md

家庭日程协作工具（agenda）—— 微信小程序，帮家长规划孩子日程、孩子查看执行。后端 .NET 10 Web API + PostgreSQL，前端微信原生小程序（WXML/WXSS/JS），E2E 测试 Playwright。

## 当前进度

| 模块 | Stage 1 产品 | Stage 2 设计 | Stage 3 研发 | Stage 4 测试 | Stage 5 归档 | OpenSpec |
|------|:--:|:--:|:--:|:--:|:--:|------|
| 日程管理 | ✅ | ✅ | ✅ | ✅ | ✅ | add-event-module (archived) |
| 认证 | ✅ | ✅ | ✅ | ✅ | ✅ | add-auth-module (archived) |
| 打卡 | ✅ | ✅ | ✅ | ✅ | ✅ | add-checkin-module (archived) |
| 家庭/模板/展示模式 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |

- `app/` 已有日程管理前端代码（4 页面 + 11 组件 + 3 Service + 2 Util），认证模块（mine/privacy-prompt 页面）
- `api/` 已有 .NET 10 后端（Schedule + Auth + Family + Domain + Infrastructure 分层），含 EF Core Migration
- `testing/e2e/` 已有 Playwright 测试套件（日程管理 139/140 通过，1 项打卡模块预置 skip）

详细进度见 [`production/CLAUDE.md`](production/CLAUDE.md) 全局模块进度表。

## 命令速查

```bash
# 后端 (.NET 10)
dotnet build api/Agenda.Api.csproj                          # 构建
dotnet test api/                                            # 全部测试
dotnet test api/ --filter "FullyQualifiedName~Xxx"          # 单个测试
dotnet run --project api/Agenda.Api.csproj                  # 启动 API

# EF Core 迁移
dotnet ef migrations add <Name> --project api/ --startup-project api/
dotnet ef database update --project api/ --startup-project api/

# E2E 测试
cd testing/e2e && npx playwright test                       # 全部 E2E
cd testing/e2e && npx playwright test --grep "规则"         # 按名称过滤
cd testing/e2e && npx playwright test --project=chromium    # 单浏览器

# OpenSpec
openspec list                                               # 活跃变更
openspec status --change "<name>"                           # 变更状态
openspec archive <name>                                     # 归档变更
```

完整命令参考见 [`.claude/operations-manual.md`](.claude/operations-manual.md) §8.2。

## 目录导航

| 目录 | 内容 | 说明 |
|------|------|------|
| [`api/`](api/CLAUDE.md) | .NET 10 Web API | 开发中：Schedule + Auth + Family 模块 |
| [`app/`](app/CLAUDE.md) | 微信小程序前端 | 开发中：日程管理 + 认证页面就绪 |
| [`testing/e2e/`](testing/CLAUDE.md) | Playwright E2E | 日程管理 140 用例 |
| [`production/`](production/CLAUDE.md) | 产品需求与原型 | 6 模块需求文档已完成 |
| [`.claude/`](.claude/CLAUDE.md) | 三层编排（agent/skill/rule） | 工作流权威定义 |

## 技术约束

- **平台**：微信小程序（基础库 ≥ 2.10.0），iOS 12+ / Android 8.0+
- **后端**：.NET 10 Web API，EF Core + PostgreSQL，JWT 鉴权
- **性能底线**：首屏 ≤ 2s，视图切换 ≤ 500ms，打卡响应 ≤ 1s
- **账户模型**：个人账户 + 家庭绑定，数据按家庭隔离
- **日程模型**：三种类型（课后活动/日常作息/作业任务），时间槽按星期几独立配置
- **关键流程**：创建日程 ≤ 3 步，所有 API 需微信登录态，敏感操作二次确认

## 工作流

agent 驱动的五阶段 SDLC 流水线，通过 OpenSpec 文件（git 共享）交接：

```
Stage 1 产品: req-analyst → req-reviewer → 人审批 → commit
Stage 2 设计: arch-architect → arch-architect-reviewer → 人审批 → commit
Stage 3 研发: dev-dotnet + dev-miniapp → dev-reviewer → commit
Stage 4 测试: test-planner → test-writer → test-reviewer → test-runner → 人审批
Stage 5 归档: archiver（两步：先 openspec archive 代码 → 再 staging → production/archive/ 需求）
```

**Gate 原则**：三层人审批不可跳过（需求审核 + 架构审核 + E2E 测试后），任一 gate 未通过禁止进入下一阶段。git commit 是阶段间硬性交接点。

完整编排规则见 [`.claude/CLAUDE.md`](.claude/CLAUDE.md)、[`.claude/INDEX.md`](.claude/INDEX.md)，操作手册见 [`.claude/operations-manual.md`](.claude/operations-manual.md)。

## 三层编排系统

`.claude/` 下采用正交三层组织：

- **Agent（agents/）** = 角色（"谁来做"），由主代理按阶段调度
- **Skill（skills/）** = 方法/流程（"怎么做"），被 agent 调用
- **Rule（rules/）** = 约束/标准（"不能越界"），被 skill 声明引用

Agent 不直接声明 rule——rule 通过 skill 间接获得。详见 [`.claude/INDEX.md`](.claude/INDEX.md) 的触发关系表。

## OpenSpec 目录结构

```
openspec/
├── specs/                  # 已归档的需求真相源（按 domain 组织）
│   ├── event-crud/
│   ├── event-instance/
│   ├── event-calendar/
│   └── event-checkin-integration/
├── contracts/              # API 契约共享（枚举/错误码/DTO），三端统一真相源
├── changes/                # 活跃变更（每变更一个目录）
│   ├── add-auth-module/    #   proposal → design → tasks → specs/
│   └── add-checkin-module/
└── changes/archive/        # 已归档变更
    └── 2026-08-09-add-event-module/
```

## staging 暂存目录

需求在 `production/staging/YYYY-MM-DD-概要/` 下以草稿演进：

```
requirement.md    # 本次变更需求（引用 requirements/ 已有内容，只写新增/修改）
epic-story.md     # Epic/Story 拆解清单
STATUS.md         # 状态机 + Stage 进度表 + OpenSpec 关联
review.md         # req-reviewer 审核报告
```

状态机：`draft → confirmed → dev-ready → in-progress → done`。`dev-ready` 是下游启动信号。完成后归档到 `production/archive/`。

## 提交规范

创建 git 提交前，先 Read [`.claude/rules/git-commit.md`](.claude/rules/git-commit.md)。核心：动词开头、一事一提交、不直推 main。
