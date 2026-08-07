---
name: dev-dotnet-tdd
description: .NET TDD 开发——基于 xUnit + Moq + dotnet CLI 的红绿重构循环。
rules: [test-standards, dev-security, dev-dotnet-standards, dev-code-quality]
---

# dev-dotnet-tdd · .NET TDD 开发流程

## 铁律

**无失败测试无生产代码。** 先写代码再补测试？删掉重来。

## 流程

1. **Read 规则** — dev-dotnet-standards / test-standards / dev-code-quality（涉及 auth/密钥/输入处理另读 dev-security）

2. **探查项目** — Read CLAUDE.md 了解目录约定，确认测试文件位置（同结构放置），`dotnet test --list-tests` 了解已有风格

3. **红——写失败测试**
   - xUnit（`[Fact]`/`[Theory]`）+ Moq
   - 类名：`<被测类名>Tests`，方法名：`<方法名>_<条件>_<预期>`（如 `GetUserAsync_WhenUserExists_ReturnsUserDto`）
   - Arrange: Moq 设置依赖（`Mock<T>`）+ 测试数据
   - Act: 调用被测方法
   - Assert: 断言可观察结果，不用 `Mock.Verify()` 测内部调用次数（除非确有必要）
   - 运行确认因"功能未实现"失败（非编译错误）

4. **绿——最小实现**
   - 只写让当前测试通过的代码（YAGNI）
   - 遵循 `dev-dotnet-standards`：构造注入、异步到底、DTO 隔离、参数化查询
   - 运行确认通过

5. **重构——不改行为清理**
   - 提取重复、改善命名、拆分大方法
   - 检查规则违规（异步无后缀、异常吞掉、DI 用 Service Locator 等）
   - 每步后跑 `dotnet test` 确认通过

6. **循环** — 回到步骤 3，直到功能完整。每个测试独立可运行。

7. **回归验证** — `dotnet test`（全部通过）+ `dotnet build`（无警告）

## 关键原则

- **测试先于实现**：测试描述"要什么"，实现回答"怎么做"
- **最小实现**：只让当前测试过，不预写代码
- **xUnit + Moq 组合拳**：xUnit 做断言，Moq 做隔离。测 Service 时 mock 掉 Repository/HttpClient/ILogger
- **测行为不测实现**：断言返回值/异常/状态变化，`Mock.Verify()` 不做首要断言
- **dotnet CLI 全程驱动**：`dotnet test`、`dotnet build`、`dotnet new`，不依赖 IDE