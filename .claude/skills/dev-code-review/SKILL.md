---
name: dev-code-review
description: 审查 diff/PR 时使用——按维度扫描、列发现、逐条验证是否真问题、按严重度排序、给可执行建议。
rules: [dev-code-quality, dev-security, openspec-workflow]
---

# dev-code-review · 代码审查

## 何时使用
- 审查改动、diff、PR 时
- 自查即将提交的改动时
- SDD 流程中的 task review 和 final broad review

## 流程
1. **先 Read `rules/dev-code-quality.md`、`rules/dev-security.md`、`rules/openspec-workflow.md` 并遵守其约束。**
2. **生成 review package**——将 diff 输出为文件而非贴文本：`git log --oneline` + `git diff --stat` + `git diff -U10`，写入一个文件，reviewer 读文件而非运行 git 命令。
3. **理解改动意图**——读提交信息/PR 描述，搞清楚这次改动的目标与范围。
4. **按维度扫描**——
   - 正确性：逻辑对吗？边界覆盖了吗？
   - 安全：输入校验？密钥处理？注入/XSS？
   - 性能：有明显低效（N+1、不必要的循环、大对象拷贝）吗？
   - 可读性：命名清楚吗？职责单一吗？
   - 复用：是否重复造了已有的轮子？
   - **Spec 合规**：改动是否覆盖了 spec 中的所有 ADDED/MODIFIED requirements？是否引入了 spec 外的功能？
5. **列发现**——每条记录：位置、问题、为什么是问题。
6. **逐条验证**——对每条发现问"这真的会导致问题吗？"，排除误报。
7. **按严重度排序**——阻断(must-fix) / 建议(should-fix) / 可选(nit)。
8. **给可执行建议**——每条问题附具体改法。

## 双判决

每次审查必须给出两个独立判决：

| 维度 | 判决 | 含义 |
|------|------|------|
| **Spec 合规** | ✅ 符合 / ❌ 不符合 | 是否覆盖了 spec 中所有 requirements？是否引入了 spec 外的功能？ |
| **代码质量** | Approved / NeedsWork | 命名、结构、错误处理、复用是否符合 `dev-code-quality`？ |

两个判决独立。Spec ✅ + 代码质量 Approved 才能通过。

## 关键原则
- 先验证再下结论——可疑不等于有问题。
- 报真问题，不为凑数——假问题会淹没真问题。
- 可执行——建议要能直接照做。
- Review package 走文件——不贴 diff 到 prompt 里。

