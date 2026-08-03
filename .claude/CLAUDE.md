# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目

**家庭日程协作工具（agenda）** — 微信小程序，帮家长规划孩子日程、孩子查看执行。覆盖课后活动、日常作息、作业任务三种场景，适配 3-14 岁儿童。

- **技术栈**：微信小程序（前端）+ 云函数/云开发（后端）。具体前端框架（原生/uni-app/Taro）和运行时栈在 Stage 2 架构设计阶段确定。
- **项目概览**：详见根 [`CLAUDE.md`](../CLAUDE.md)（项目概况、目录导航、工作流）
- **需求文档**：[`production/requirements/index.md`](../production/requirements/index.md) — 产品需求总纲，含定位、角色、模块、非功能需求、分期规划
- **当前阶段**：产品规划阶段（Stage 1），代码尚未开始编码。日程管理模块需求已完成，其余模块待创建。

## 三层结构与加载机制

本套配置采用**正交三层 + track 前缀**组织：

- **Rule（rules/）** = 约束/标准（"不能越界"）。**不自动挂载**，由 skill 在 frontmatter 声明 `rules: [...]`，被激活时显式 `Read` 对应 rule 文件。agent 不直接声明 rule，rule 通过 skill 间接获得。
- **Skill（skills/）** = 方法/流程（"怎么一步步做"）。按 description 触发或 `/skill` 调用，渐进披露。
- **Agent（agents/）** = 角色（"谁来做"）。主代理识别匹配任务时通过 Agent 工具调度，限定工具集。

三层正交：存储/扩展独立，运行时通过"引用"组合——agent 调 skill，skill 显式 Read 其声明的 rule。详见 `INDEX.md`。

## 快捷命令

OpenSpec 快捷斜杠命令（`/opsx:explore`、`/opsx:propose`、`/opsx:apply`、`/opsx:archive`），映射到对应的 skill，由 Harness 内置支持。

## 横切 rule

`rules/git-commit.md` 是横切规则（提交由主代理直接做，无专属 agent）。**创建 git 提交前，先 Read `rules/git-commit.md` 并遵守其约束。**

## 工具组合速查

完整 track × 层映射见 `INDEX.md`。

## 默认行为

- **非平凡需求 -> 主代理直接编排全链路**——用户提出非平凡功能需求或变更请求时，主代理直接按 SDLC 链路顺序调度各 agent（req-analyst -> req-reviewer -> dev-architect -> dev-architect-reviewer -> dev-planning -> test-planner -> dev-dotnet + dev-vue3 -> test-writer -> test-reviewer -> test-runner -> 收尾 -> 归档），含三道人审批硬 gate。简单 bug 修复、格式调整、文档更新等平凡变更可豁免，直接处理。
- **需求/架构/计划/测试阶段**的角色（req-analyst、req-reviewer、dev-architect、dev-architect-reviewer、dev-planning、test-planner、test-writer、test-reviewer、test-runner）端到端执行，含 openspec CLI 操作（自己跑 `openspec-cn new/status/instructions/archive` 等命令）。
- **dev-dotnet / dev-vue3** 各自编排各自技术栈的 SDD（dev-sdd + dev-verification），角色规格模式下由主代理扮演实现与自审（dev-reviewer 角色也由主代理切换扮演）。
- **bug / 测试失败 / 异常**，先用 `dev-debugging` skill 系统化定位根因，不要直接猜改。
- **改动前先查复用点**——搜索现有函数/组件，能复用就不新写。
- 需要专门角色时，读对应 `agents/*.md` 扮演；agent 通过 skill 间接获得 rule 约束。
