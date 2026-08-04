# HOW-TO-ADD · 如何新增 agent / skill / rule

本模板采用**正交三层 + track 前缀**组织。新增前先判断属于哪一层。

## 决策树

```
你要加的是什么？
│
├─ 约束 / 标准（"不能越界""必须遵守"）
│  → 加 RULE  (rules/<track>-<name>.md)
│     · 纯约束文档，本身不声明何时加载
│     · 必须被至少一个 agent 或 skill 引用，否则是死规则
│
├─ 做事的流程 / 方法（"怎么一步步做"）
│  → 加 SKILL  (skills/<track>-<name>/SKILL.md)
│     · frontmatter 声明 rules: [...]（它遵循哪些 rule）
│     · 流程首步常为 Read 声明的 rule
│
└─ 专门执行的角色（"谁来做"，需限定工具集）
   → 加 AGENT  (agents/<track>-<name>.md)
      · frontmatter 声明 tools（最小够用，只读优先），可按需声明 rules
      · rule 可通过 skill 间接获得，也可由 agent 直接声明
      · body 写明遵循哪个 skill
```

## 命名约定（双轴）

- **目录 = 层**：`rules/` / `skills/` / `agents/`
- **前缀 = track**：`req-`（需求）/ `design-`（设计）/ `dev-`（研发）/ `test-`（测试）/ `git-`（横切）
- 软约定：rule 名 = 名词（标准域）；skill 名 = 动词/方法；agent 名 = 角色（-er / -ist 结尾）
- 一文件一关注点

## 新增步骤

1. 复制对应模板（`_template/*.template.md`），填内容。
2. 按 track 前缀命名，放入对应层目录。
3. **若是 rule**：在至少一个 agent 或 skill 的 `rules: [...]` 里引用它，并在 body 写 `Read rules/<name>.md`。未被引用的 rule 不会被加载。
4. 更新 `INDEX.md`（在对应 track 行登记）。
5. 验证（见下）。

## 验证清单

- [ ] rule：被至少一个 agent 或 skill 引用？（无引用 = 死规则，删或补引用）
- [ ] skill：description 是否具体到可触发？（模型能否据此判断该用它）
- [ ] agent：tools 是否最小够用？（只读任务别给 Edit/Write）
- [ ] agent：description 是否可识别？（主代理能否据此判断何时调度）
- [ ] 命名：track 前缀 + 层目录是否对应？
- [ ] INDEX.md：是否已登记？

## 反模式（避免）

- ❌ 一个 rule 塞多个关注点 → 拆成多个
- ❌ skill 过长（流程塞太多）→ 拆成多个 skill
- ❌ agent 工具过多（又读又写又跑）→ 拆职责成多个 agent
- ❌ rule 无人引用 → 死规则，删掉或补引用
- ❌ 在三层间重复内容 → rule 只写约束，skill 只写流程，agent 只写角色，互相引用不复制
- ❌ agent 和 skill 重复 Read 同一 rule → agent 在 frontmatter 声明 rules，skill 在 body 中 Read 并执行；agent 决策流程中按需 Read 做 Gate 判断，不重复 skill 已做的 Read