# dev-contracts · API 契约共享规范

## 约束

### 单一真相源

- **API 契约的枚举值、错误码、DTO 结构 MUST 定义在 `openspec/contracts/<domain>/` 下**，作为三端（后端、前端、测试）的共享真相源。禁止在后端 C# 代码、前端 JS 代码、测试 JS 代码中各自手写同一字符串字面量。
- **契约文件与 design.md 同时产出**——arch-architect 在设计 API 契约轮廓时，MUST 将可机读部分提取为 JSON 文件。design.md 描述"为什么这样设计"，contracts JSON 描述"具体值是什么"。

### 产出时机与角色

- **Stage 2（架构设计）产出**，由 arch-architect agent（通过 arch-design skill）创建。
- **arch-architect-reviewer 审核**，检查 contracts 与 design.md prose 描述一致、覆盖所有 API 端点。
- **下游消费**：dev-dotnet、dev-miniapp、test-writer 各自的前置检查中 MUST 确认 contracts 文件存在。

### 文件结构

```
openspec/contracts/<domain>/
├── enums.json        # 枚举值定义
├── errors.json       # 错误码 → HTTP 状态码 → 中文提示
└── dto.json          # request/response 字段名、类型、必填标记
```

### enums.json 格式

```json
{
  "Scope": {
    "values": ["ThisOnly", "ThisAndFuture"],
    "description": "编辑/删除的影响范围"
  },
  "ScheduleType": {
    "values": ["AfterSchoolActivity", "DailyRoutine", "HomeworkTask"],
    "description": "日程类型"
  }
}
```

### errors.json 格式

```json
{
  "SCHEDULE_NOT_FOUND": { "httpStatus": 404, "message": "日程不存在" },
  "SCHEDULE_NAME_EMPTY": { "httpStatus": 400, "message": "日程名称不能为空" },
  "CHILD_ACCESS_DENIED": { "httpStatus": 403, "message": "孩子角色无权执行此操作" }
}
```

### dto.json 格式

```json
{
  "CreateScheduleRequest": {
    "fields": {
      "name": { "type": "string", "required": true, "maxLength": 50 },
      "scheduleType": { "type": "ScheduleType", "required": true },
      "childIds": { "type": "Guid[]", "required": true, "minItems": 1 },
      "timeSlots": { "type": "TimeSlot[]", "required": false }
    }
  }
}
```

### 消费端约束

- **后端（dev-dotnet）**：枚举值、错误码 MUST 从 `openspec/contracts/` 读取或生成为 C# 常量类/enum，禁止在代码中硬编码字符串字面量。例如 `"ThisAndFuture"` MUST 只出现在 contracts JSON 文件中，C# 代码引用生成的 `ScopeConstants.ThisAndFuture`。
- **前端（dev-miniapp）**：API 请求参数中的 scope、scheduleType 等枚举值 MUST 从 contracts 引用，禁止在 `services/api.js` 或页面代码中手写字符串。例如 `scope: 'AllFuture'` 的错误应通过引用 contracts 在编译/加载期发现。
- **测试（test-writer）**：API client 的请求参数类型、测试断言中的错误码/状态值 MUST 从 contracts 引用。error 断言用 `errors.SCHEDULE_NOT_FOUND`，不写裸字符串 `'SCHEDULE_NOT_FOUND'`。

### 与已有 rule 的关系

- 契约文件是 API 设计的机器可读子集，与 design.md 中 API 契约轮廓（参见 `arch-design` skill）一一对应。
- 契约文件走 OpenSpec 变更管理流程（参见 `openspec-workflow` rule）——变更目录中有对应 contracts delta，archive 时合并。
- 各技术栈的 standards rule（`dev-dotnet-standards`、`dev-miniapp-standards`）中不再重复定义契约消费约束，统一由此 rule 定义。

## 示例

- ✅ `const { Scope } = require('../../openspec/contracts/schedule/enums.json');` — 测试引用共享枚举
- ✅ `if (request.Scope == ScopeConstants.ThisAndFuture)` — C# 引用生成的常量类
- ❌ `scope: 'AllFuture'` — 测试中手写字符串，后端实际值为 `ThisAndFuture`
- ❌ `expect(body.error).toBe('SCHEDULE_NOT_FOUND')` — 测试中硬编码错误码字符串
- ❌ C# 代码中 `case "ThisAndFuture":` — 在后端代码中硬编码字符串字面量
