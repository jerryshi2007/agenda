# dev-codegraph · 代码图谱使用规范

## 前提

- 本 rule 依赖 CodeGraph 索引（repo 根存在 `.codegraph/`）。无索引时先 `codegraph init`（首次建图）或 `codegraph index --force .`（重建），否则退化为 grep/Read。
- 两种访问方式等价，优先 MCP 工具：
  - **MCP 工具** `codegraph_explore`（agent 可用时优先，一次调用返回符号逐字源码 + 调用关系）
  - **CLI** `codegraph explore "<符号名或问题>"`（Bash 兜底，永远可用）

## 约束

### 设计阶段：现状对账 gate（Stage 2）

- **MUST 在设计前对账已有代码**——arch-architect 通过 `arch-design` 做现状分析时，MUST 用 codegraph 探查 `api/` / `app/` / `web/` 已有代码，产出「现状对账清单」写入 design.md：列出已有实体/服务/组件/模块，并逐个标注本次变更是**复用 / 扩展 / 新建**。
- **MUST 增量设计**——design.md 的 ER 图、分层、模块划分 MUST 以现状对账清单为依据，禁止假设空仓库。复用/扩展已有实体（如 User、Schedule）时，字段增删、状态迁移 MUST 显式声明。
- **未对账即 STOP**——design.md 缺现状对账清单（或清单为空但 repo 已有相关代码）→ 设计未完成，arch-architect 不得交审，arch-architect-reviewer 不得批准。

### 研发阶段：消费约束（Stage 3）

- **定位/理解已有代码优先走 codegraph**——dev-dotnet / dev-miniapp / dev-vue3 及 dev-reviewer 实现/审查前需了解已有代码时，MUST 先 `codegraph_explore` / `codegraph explore` 查符号与调用关系，禁止一上来就 Read 大文件或 grep 全仓库。
- **Read 只用于精确行级内容**——以下场景才直接 Read 目标文件：写代码前后确认精确上下文、task brief 指定的待改文件、契约 JSON（enums/errors/dto）。"某个类做什么、谁调用它、改了影响谁"这类理解性问题用 codegraph。
- **查不到符号先同步索引**——codegraph 查不到应有符号时，MUST 先 `codegraph sync .`（增量）或 `codegraph index --force .`（重建）再查，不要直接退化为 grep/大量 Read。

### 测试阶段：消费约束（Stage 4）

- **定位/理解已有代码优先走 codegraph**——test-planner / test-writer / test-reviewer / test-runner 探查、理解已有 API/Controller/Service/组件时，MUST 先 `codegraph_explore` / `codegraph explore` 查符号与调用关系，禁止一上来就 Read 大文件或 grep 全仓库。
- **Read 只用于精确行级内容**——测试线直接 Read 仅限：契约 JSON（enums/errors/dto）、spec/requirement 文档、待审查/待运行的测试文件本体、失败堆栈定位到的具体行。"这个端点怎么解析请求、这个 Service 依赖谁"这类理解性问题用 codegraph。
- **查不到符号先同步索引**——同研发阶段：先 `codegraph sync .` 再查，不直接退化为 grep/大量 Read。

### 索引新鲜度

- 代码提交后索引由 OS 文件事件自动同步（2 秒防抖）。怀疑索引过时（查不到新提交的符号）时 `codegraph sync .` 手动增量更新。

## 示例

- ✅ arch-design 现状分析：`codegraph_explore "列出 User 实体及其被引用位置"` → design.md 对账清单标注「复用 User，升级 Status 字段对齐契约」
- ✅ dev-dotnet 实现前：`codegraph_explore "AuthService 调用链"` → 得知 AuthController 依赖 IAuthService，不 Read 整个 Auth/ 目录
- ✅ 查不到 UserStatus：先 `codegraph sync .` 再查，而非 `grep -r UserStatus`
- ✅ test-writer 探查端点：`codegraph_explore "AuthController 请求处理链"` → 得知 9 个端点依赖 IAuthService，不 Read 整个 Auth/ 目录
- ❌ 设计时假设 api/ 为空、不探查已有代码直接画全新 ER 图（导致 User 的 IsDeleted vs UserStatus 冲突返工）
- ❌ 实现一个 Service 前 Read 整个模块 20 个文件理解现状（应 codegraph 查调用关系 + 只 Read 待改文件）
