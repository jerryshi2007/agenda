# Design Review (复审): 认证与账户模块

> Change: `add-auth-module` | Reviewed by: arch-architect-reviewer | Date: 2026-08-08 (复审)
>
> 复审目标：验证 2026-08-08 初版审核中 7 个阻塞项的修复情况

---

## 复审结论

**全部通过。** 7 个阻塞项均已正确修复，未引入新问题。设计可移交 arch-planning。

---

## 逐项验证

### B1 | 30 天到期清理策略 -- ADR-008 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| ADR-008 含 Context/Decision/Consequences/Alternatives 四段 | 通过 |
| 决策：惰性检查 + 定时扫描双路径 | 通过 |
| 惰性检查嵌入 POST /api/v1/auth/login 的说明 | 通过（line 372-378） |
| 定时任务描述（Hangfire/CronJob 每天 3:00） | 通过 |
| Risks R8 记录定时任务故障缓解 | 通过（line 989） |
| Trade-offs 表列入此权衡 | 通过（line 1000） |
| 时序 9 覆盖到期后登录清理流程 | 通过（line 925-947） |

### B2 | data-id 速查表 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| 新增 data-id 速查表 | 通过（line 572-608） |
| 覆盖元素数量 | 32 个（privacy-dialog 5 + privacy-prompt 1 + profile-collection 4 + mine 9 + profile-edit 5 + settings 4 + deleted-recovery 4） |
| 命名遵循 kebab-case `<页面>-<元素角色>` 模式 | 通过 |
| 动态列表项含唯一标识符 | 通过（`mine-family-info-{{familyId}}`） |
| 与 dev-miniapp-standards rule 对齐 | 通过 |

### B3 | "我的"页面家庭数据来源 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| 新增 GET /api/v1/users/me/families | 通过（line 358） |
| 完整请求/响应形状定义 | 通过（line 456-472） |
| Family 模块未就绪时返回空数组的降级策略 | 通过 |
| IFamilyQueryService 跨上下文契约 | 通过（line 1034） |
| 数据流节：并行请求 profile + families | 通过（line 650-658） |
| 时序 10：页面加载家庭数据流程 | 通过（line 950-972） |

### B4 | API 路径版本号 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| 版本策略声明（URL 路径 /api/v1/） | 通过（line 344） |
| 全部 9 个端点使用 /api/v1/ 前缀 | 通过（line 348-358） |
| 所有请求/响应示例已更新 | 通过 |
| 所有时序图 API 调用已更新 | 通过 |
| 破坏性变更发 /api/v2/ 的后续策略 | 通过（line 499） |

### B5 | 前端安全区域适配 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| 新增"安全区域适配"小节 | 通过（line 610-621） |
| 底部安全区域策略（env(safe-area-inset-bottom)） | 通过 |
| 顶部导航栏使用原生（无需手动适配） | 通过 |
| .safe-bottom 工具类定义 | 通过 |
| 适配验证清单（7 款 iPhone + Android 全面屏） | 通过 |

### B6 | 恢复页面路由注册 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| app.json pages 含 deleted-recovery/index | 通过（line 514） |
| 路由表含 deleted-recovery 条目 | 通过（line 532） |
| 组件树含 deleted-recovery 完整结构 | 通过（line 563-567） |
| 目录结构含 deleted-recovery/ 目录 | 通过（line 113） |

### B7 | 头像存储方案 ADR-009 ✅ 已修复

| 检查点 | 结果 |
|-------|:--:|
| ADR-009 含 Context/Decision/Consequences/Alternatives 四段 | 通过（line 259-271） |
| 决策：本地文件系统 + Nginx/CDN 反向代理 | 通过 |
| IAvatarStorageService 接口预留迁移路径 | 通过 |
| 配置键（Storage:AvatarRootPath, Storage:AvatarBaseUrl） | 通过 |
| Trade-offs 表列入此权衡 | 通过（line 1001） |
| 头像上传端点含 multipart/form-data 规格 | 通过（line 449-453） |

---

## 新增问题检查

对照 10 个审核维度扫描修复后 design.md，确认无新增阻塞问题：

- ADR-008 的 Hangfire 定时任务在 Handoff 中列为前置依赖，与构建序列一致
- GET /api/v1/users/me/families 通过 IFamilyQueryService 接口解耦，Family 模块未就绪时降级返回空数组
- ADR-009 本地文件存储与单实例部署假设一致，接口预留迁移路径
- data-id 速查表命名与 dev-miniapp-standards rule 完全对齐
- 无 TBD/TODO/占位符残留
- 无新增规则违规

---

## 10 维度总览（复审后）

| # | 维度 | 复审前 | 复审后 | 说明 |
|---|------|:--:|:--:|------|
| 1 | 需求覆盖 | ⚠️ | ✅ | GET /users/me/families 补齐家庭数据来源 |
| 2 | ER 关系可反推 | ✅ | ✅ | 无变化 |
| 3 | 时序完整 | ⚠️ | ✅ | ADR-008 补充清理时序，原有 9 个时序增至 10 个 |
| 4 | ADR 充分 | ⚠️ | ✅ | ADR-008（清理策略）+ ADR-009（头像存储），7 个 ADR 增至 9 个 |
| 5 | 规则合规 | ❌ | ✅ | data-id 速查表 + /api/v1/ 前缀 + 安全区域适配全部补齐 |
| 6 | 质量底线 | ✅ | ✅ | 无变化 |
| 7 | 限界上下文合理 | ✅ | ✅ | 无变化 |
| 8 | API 契约完整 | ⚠️ | ✅ | 新增 /users/me/families 端点，上传接口补充规格 |
| 9 | 前端架构对齐 | ⚠️ | ✅ | 恢复页面注册路由，profile-collection 角色明确 |
| 10 | 构建序列可行 | ✅ | ✅ | AUTH-004 依赖 IFamilyQueryService 接口（降级策略明确） |

---

## 三判决

| 判决维度 | 结论 | 说明 |
|---------|:--:|------|
| 设计质量 | ✅ 合格 | 9 个 ADR 覆盖全部关键决策，10 个时序图覆盖正常+异常+并发路径，数据模型清晰，前端路由/组件/data-id/安全区域完备 |
| 规则合规 | ✅ 合规 | 通过全部 6 条 rules 扫描（dev-dotnet-standards, dev-miniapp-standards, dev-security, dev-code-quality, openspec-workflow, design-ui-standards） |
| 审批建议 | ✅ 建议批准 | 7 个阻塞项已全部修复且验证通过，无新问题引入。设计文档达到可移交 arch-planning 状态。 |

---

## 审核备注

- staging STATUS.md 已更新为 `in-progress`
- 设计文档版本：`openspec/changes/add-auth-module/design.md`（修复版，2026-08-08）
- 审核范围：初版审核的 7 个阻塞项 + 修复引入的新问题检查
- 原有 7 个建议项（S1-S7）和 2 个疑问项（Q1-Q2）作为非阻塞项，可在 arch-planning 阶段酌情处理
