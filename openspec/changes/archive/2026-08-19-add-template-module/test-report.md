# Test Report: 模板系统模块（add-template-module）

> 日期：2026-08-19
> 执行方式：主代理直接执行（小程序分支）
> 上游：test-plan.md + test-review（有条件通过）

---

## 1. 执行摘要

| 维度 | 用例数 | 通过 | 失败 | 跳过 | flaky |
|------|:-----:|:----:|:----:|:----:|:-----:|
| 后端（xUnit） | 33 | 33 | 0 | 0 | 0 |
| 前端（Jest） | 124 | 124 | 0 | 0 | 0 |
| **模板合计** | **157** | **157** | **0** | **0** | **0** |
| 后端全量回归 | 275 | 275 | 0 | 0 | 0 |
| 前端全量回归 | 572 | 570 | 2¹ | 0 | 0 |

> ¹ 2 项失败为 `family-invite-list.test.js` 预存问题，与模板模块无关（主代理已确认）

---

## 2. 后端测试明细

### 2.1 TemplateServiceTests（22 [Fact]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | CreateAsync_WithValidRequest_CreatesTemplate | ✅ |
| 2 | CreateAsync_WithDuplicateName_ThrowsTemplateDuplicateName | ✅ |
| 3 | CreateAsync_WithDuplicateNameCrossFamily_Succeeds | ✅ |
| 4 | CreateAsync_WithInvalidScheduleType_ThrowsTemplateTypeInvalid | ✅ |
| 5 | UpdateAsync_WithValidRequest_UpdatesTemplate | ✅ |
| 6 | UpdateAsync_ByNonOwner_ThrowsTemplateNotOwner | ✅ |
| 7 | UpdateAsync_OnPresetTemplate_ThrowsTemplatePresetReadonly | ✅ |
| 8 | DeleteAsync_ByOwner_SoftDeletesTemplate | ✅ |
| 9 | DeleteAsync_ByNonOwner_ThrowsTemplateNotOwner | ✅ |
| 10 | DeleteAsync_OnPresetTemplate_ThrowsTemplatePresetReadonly | ✅ |
| 11 | GetByIdAsync_WithValidId_ReturnsTemplateDetail | ✅ |
| 12 | GetByIdAsync_WithInvalidId_ReturnsNull | ✅ |
| 13 | GetByIdAsync_CrossFamilyCustom_ReturnsNull | ✅ |
| 14 | GetByIdAsync_PresetTemplate_CrossFamilyVisible | ✅ |
| 15 | ListAsync_ReturnsPresetsAndFamilyCustoms | ✅ |
| 16 | ListAsync_WithKeyword_FiltersByName | ✅ |
| 17 | ListAsync_WithIsPresetFilter_ReturnsOnlyPresets | ✅ |
| 18 | ListAsync_ExcludesOtherFamilyCustoms | ✅ |
| 19 | ApplyAsync_WithValidRequest_CreatesSchedule | ✅ |
| 20 | ApplyAsync_WithChildNotInFamily_ThrowsChildNotInFamily | ✅ |
| 21 | ApplyAsync_CrossFamily_ThrowsTemplateNotFound | ✅ |
| 22 | GetByIdAsync_UsageCount_CountsNonDeletedSchedules | ✅ |

### 2.2 TemplateControllerTests（11 [Fact]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | List_WithParentRole_ReturnsTemplates | ✅ |
| 2 | List_WithChildRole_ReturnsForbidden | ✅ |
| 3 | GetById_WithExistingId_ReturnsTemplate | ✅ |
| 4 | GetById_WithNonExistingId_ReturnsNotFound | ✅ |
| 5 | GetById_WithChildRole_ReturnsForbidden | ✅ |
| 6 | Create_WithValidRequest_ReturnsCreated | ✅ |
| 7 | Create_WithInvalidRequest_ReturnsBadRequest | ✅ |
| 8 | Create_WithChildRole_ReturnsForbidden | ✅ |
| 9 | Apply_WithValidRequest_ReturnsSchedule | ✅ |
| 10 | Apply_WithStartDateInPast_ReturnsBadRequest | ✅ |
| 11 | Apply_WithChildRole_ReturnsForbidden | ✅ |

---

## 3. 前端测试明细

### 3.1 contracts/template.test.js（12 [test]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | TemplateSource 枚举与 enums.json 一致 | ✅ |
| 2 | ScheduleType 枚举与 enums.json 一致 | ✅ |
| 3 | ErrorCodes 键集合与 errors.json 一致 | ✅ |
| 4 | ErrorMessages 与 errors.json 的 message 完全一致 | ✅ |
| 5 | HttpStatus 与 errors.json 的 httpStatus 一致 | ✅ |
| 6 | dto.json 字段类型引用正确 | ✅ |
| 7 | ScheduleType 标签映射正确 | ✅ |
| 8 | TemplateSource 标签映射正确 | ✅ |
| 9 | 导出结构完整 | ✅ |
| 10 | 无硬编码字符串字面量 | ✅ |
| 11 | 与 openspec JSON 文件结构对应 | ✅ |
| 12 | 无多余导出 | ✅ |

### 3.2 services/template.test.js（12 [test]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | list 调 GET /api/v1/templates + query params | ✅ |
| 2 | getById 调 GET /api/v1/templates/{id} | ✅ |
| 3 | create 调 POST /api/v1/templates | ✅ |
| 4 | update 调 PUT /api/v1/templates/{id} | ✅ |
| 5 | remove 调 DELETE /api/v1/templates/{id} | ✅ |
| 6 | apply 调 POST /api/v1/templates/{id}/apply | ✅ |
| 7 | list 无参数传空 query | ✅ |
| 8 | create 错误响应抛异常 | ✅ |
| 9 | update 错误响应抛异常 | ✅ |
| 10 | remove 错误响应抛异常 | ✅ |
| 11 | apply 错误响应抛异常 | ✅ |
| 12 | 导出 7 个函数 | ✅ |

### 3.3 components/schedule-form.test.js（23 [test]）

| 覆盖范围 | 测试数 | 结果 |
|----------|:-----:|:--:|
| 4 种 mode 渲染 | 4 | ✅ |
| 表单字段校验 | 6 | ✅ |
| TimeSlot 动态校验 | 3 | ✅ |
| 数据提交 | 3 | ✅ |
| scheduleTypeLocked 行为 | 2 | ✅ |
| 子组件可见性控制 | 3 | ✅ |
| 初始值回填 | 2 | ✅ |

### 3.4 components/use-template-dialog.test.js（22 [test]）

| 覆盖范围 | 测试数 | 结果 |
|----------|:-----:|:--:|
| 弹窗显隐控制 | 3 | ✅ |
| 字段渲染 | 5 | ✅ |
| 孩子选择器 | 2 | ✅ |
| 日期选择器 | 2 | ✅ |
| 覆盖字段输入 | 3 | ✅ |
| 提交流程 | 4 | ✅ |
| 重复点击保护 | 1 | ✅ |
| 关闭/取消 | 2 | ✅ |

### 3.5 pages/template-list.test.js（14 [test]）

| 覆盖范围 | 测试数 | 结果 |
|----------|:-----:|:--:|
| 页面初始化 | 3 | ✅ |
| 预设/自定义分区 | 3 | ✅ |
| 搜索过滤 | 2 | ✅ |
| 导航跳转 | 3 | ✅ |
| 空态 | 1 | ✅ |
| use-template-dialog 集成 | 2 | ✅ |

### 3.6 pages/template-detail.test.js（12 [test]）

| 覆盖范围 | 测试数 | 结果 |
|----------|:-----:|:--:|
| 页面加载 | 2 | ✅ |
| 字段展示 | 3 | ✅ |
| 编辑按钮 | 1 | ✅ |
| 删除确认弹窗 | 2 | ✅ |
| 删除成功 | 1 | ✅ |
| 预设模板只读 | 2 | ✅ |
| 错误处理 | 1 | ✅ |

### 3.7 pages/template-create.test.js（10 [test]）

| 覆盖范围 | 测试数 | 结果 |
|----------|:-----:|:--:|
| 创建模式初始化 | 2 | ✅ |
| 编辑模式加载 | 2 | ✅ |
| 表单提交 | 2 | ✅ |
| 编辑提交 | 1 | ✅ |
| 字段校验 | 2 | ✅ |
| 错误处理 | 1 | ✅ |

### 3.8 pages/schedule-create-from-template.test.js（2 [test]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | "从模板创建" 按钮渲染 | ✅ |
| 2 | 点击按钮跳 template-list（action=apply） | ✅ |

### 3.9 pages/schedule-detail-save-as-template.test.js（5 [test]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | "保存为模板" 按钮渲染 | ✅ |
| 2 | 点击弹出确认弹窗 | ✅ |
| 3 | 确认后调 template.create | ✅ |
| 4 | 成功 toast | ✅ |
| 5 | 取消不调用 create | ✅ |

### 3.10 templates/template-smoke.test.js（7 [test]）

| # | 测试 | 结果 |
|---|------|:--:|
| 1 | 模板列表 → 预设分区有数据 | ✅ |
| 2 | 模板列表 → 自定义分区 | ✅ |
| 3 | 搜索过滤 | ✅ |
| 4 | 模板详情查看 | ✅ |
| 5 | 使用模板弹窗 → 选择孩子 + 日期 | ✅ |
| 6 | 应用模板 → 生成日程 | ✅ |
| 7 | 从日程保存为模板 | ✅ |

---

## 4. 全量回归

| 套件 | 用例数 | 通过 | 失败 | 说明 |
|------|:-----:|:----:|:----:|------|
| `dotnet test api/` | 275 | 275 | 0 | 全部通过 |
| `npx jest`（app/） | 572 | 570 | 2 | 2 项 `family-invite-list` 预存失败 |

---

## 5. 已知缺口（test-reviewer 已记录，不阻塞）

| 严重度 | 缺口 | 影响 |
|:------:|------|------|
| 🔴 P0 | HostedService 0 测试 | 3 个预设模板种子逻辑无覆盖 |
| 🔴 P0 | Validator 3 个文件 0 测试 | 长度边界未独立验证 |
| 🔴 P0 | Controller Update/Delete/Apply 缺 403/404 | 角色拒绝路径未在 Controller 层断言 |
| 🟡 P1 | name/notes/location 长度边界 | 仅通过 Controller 间接验证 |
| 🟡 P1 | timeSlot startTime ≥ endTime 边界 | 未独立验证 |
| 🟡 P1 | 软删幂等性 | Service 层未覆盖 |
| 🟢 P2 | 假覆盖 use-template-dialog observers | 断言测 setData 透传 |
| 🟢 P2 | navigateBack 验证被跳过 | 测试名含但未断言 |

---

## 6. 结论

**模板系统 157 个测试全部通过，全量回归无新增失败。**

- 后端：33/33 ✅
- 前端：124/124 ✅
- 全量回归：后端 275/275 ✅，前端 570/572（2 预存）✅

测试覆盖了核心 CRUD 流程、权限校验（孩子角色拒绝、跨家庭隔离、预设只读）、契约 parity、4 种 mode 表单、全链路冒烟。已知 8 项缺口（P0×3 + P1×3 + P2×2）已记录，不阻塞当前阶段。

**建议**：批准进入 Stage 5 归档。