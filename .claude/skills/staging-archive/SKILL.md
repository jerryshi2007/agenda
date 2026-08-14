---
name: staging-archive
description: 归档 staging 需求目录——回写 STATUS done、合并 requirements、移入 production/archive/。OpenSpec 变更归档完成后使用。
rules: [req-staging]
---

# staging-archive · 归档需求目录

## 何时使用

- OpenSpec 变更已归档（`openspec archive` 完成，变更已移入 `openspec/changes/archive/`）
- staging STATUS.md 中 Stage 1–4 已 `done`，仅剩 Stage 5 归档待收口

> 本 skill 负责需求侧归档（staging 目录 → production/archive/），代码侧归档由 `openspec-archive-change` skill 负责。两步编排见 `archiver` agent。

## 流程

1. **回写 STATUS** — 将 staging STATUS.md 中 Stage 5 归档更新为 `✅ done`，整体状态更新为 `done`（握手点 3）

2. **校验** — STATUS.md 全 5 阶段 `✅ done`；否则 STOP

3. **合并需求文档** — 若 requirement.md 含新增/修改内容，合并入 `production/requirements/` 对应模块文档（复用已有章节，不重复）

4. **归档 staging 目录** — 移动目录：
   ```bash
   mkdir -p production/archive
   mv production/staging/<YYYY-MM-DD-概要> production/archive/<YYYY-MM-DD-概要>
   ```
   保留原名（含创建日期前缀）。目标已存在同名目录时 STOP，交主代理处理。

5. **更新全局表** — `production/CLAUDE.md` 模块实现进度表中对应行 Stage 5 归档 → `✅`，OpenSpec 列标注 `(archived)`

## 关键原则

- 不跳过回写——STATUS 未 done 就归档会让 staging 生命周期记录断裂
- 合并 requirements 用引用优先，不复制整篇
- 归档保留创建日期前缀，不改名（改名丢失 staging ↔ OpenSpec 追溯链）
