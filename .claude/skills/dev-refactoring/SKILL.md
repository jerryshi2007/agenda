---
name: dev-refactoring
description: 重构或清理代码时使用——小步可验证、不改外部行为、不夹带功能、要求先有测试覆盖。
rules: [dev-code-quality, dev-refactor]
---

# dev-refactoring · 重构

> 重构纪律（不改外部行为 / 小步可验证 / 不夹带功能 / 先有测试 / 分开提交）的约束定义见 `rules/dev-refactor.md`，本 skill 只给执行流程。

## 何时使用
- 代码结构需要清理、提取、简化时（不改外部行为）
- 文件过大、职责混杂需要拆分时
- 消除重复、改善命名时

## 流程
1. **先 Read `rules/dev-refactor.md` 与 `rules/dev-code-quality.md` 并遵守其约束。**
2. **确认有测试覆盖当前行为**——没有测试先要求补测试（可派 dev-vue3 或 dev-dotnet），不裸重构。
3. **小步重构**——每步改完跑测试（Bash）确认行为不变，再继续下一步。
4. **不夹带功能、不修 bug**——发现 bug 单独记下，不在重构提交里改。
5. **重构与修 bug 分开提交**——"顺手修个 bug"会让 review 和回滚都困难。
