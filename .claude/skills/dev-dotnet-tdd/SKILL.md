---
name: dev-dotnet-tdd
description: .NET（C#）项目写新功能或修可测 bug 时使用——基于 xUnit + Moq + dotnet CLI 的红绿重构循环，集成 dotnet test/build 验证。
rules: [test-standards, dev-security, dev-dotnet-standards, dev-code-quality]
---

# dev-dotnet-tdd · .NET TDD 开发流程

## 何时使用
- 写 .NET 新功能且可测试时
- 修一个可复现的 .NET bug 时（先写失败测试复现它）
- 通过 dotnet CLI 管理测试与构建的 TDD 开发

## 铁律

```
无失败测试无生产代码
```

先写测试之前写了代码？删掉。重新开始。不保留为"参考"，不"边写测试边改"。

## 流程

1. **先 Read 规则并严格遵守其约束**
   - `rules/dev-dotnet-standards.md` — .NET 编码规范（命名/异步/DI/异常/数据访问/API）
   - `rules/test-standards.md` — 测试规范（命名/一测一断言/测行为不测实现）
   - `rules/dev-code-quality.md` — 代码质量底线（单一职责/YAGNI/优先复用）
   - 若涉及 auth/密钥/输入处理，另 Read `rules/dev-security.md`

2. **探查项目结构**
   - Read 项目根目录的 `CLAUDE.md`，了解该项目的 .NET 源码目录与测试目录的约定
   - 确认已有测试文件位置，遵循同结构放置
   - 用 `dotnet test --list-tests` 了解已有测试命名风格

3. **红——写一个失败的测试**
   - 用 xUnit（`[Fact]` 或 `[Theory]`）+ Moq 写测试
   - 测试类名：`<被测类名>Tests`（如 `UserServiceTests`）
   - 测试方法名：描述行为与预期（如 `GetUserAsync_WhenUserExists_ReturnsUserDto`）
   - Arrange：用 Moq 设置依赖（`Mock<T>`）与测试数据
   - Act：调用被测试方法
   - Assert：断言可观察结果，不用 `Mock.Verify()` 测内部调用次数（除非确有必要）
   - 运行 `dotnet test --filter "FullyQualifiedName~<测试方法名>"` 确认它因"功能未实现"而失败（而非因语法/编译错误）

4. **绿——写最小实现使其通过**
   - 只写让当前测试通过的代码，不多加（YAGNI）
   - 遵循 `dev-dotnet-standards`：构造注入、异步到底、DTO 隔离、参数化查询
   - 运行 `dotnet test --filter "FullyQualifiedName~<测试方法名>"` 确认通过
   - 若需要新建项目/类文件：
     - 用 `dotnet new` 创建项目模板（如需新测试项目）
     - 类文件放在与测试对应的源码目录下

5. **重构——在不改行为的前提下清理**
   - 提取重复、改善命名、拆分大方法
   - 检查是否违反 `dev-dotnet-standards`（异步方法无后缀、异常吞掉、DI 用 Service Locator 等）
   - 每步重构后跑 `dotnet test` 确认仍全部通过
   - 重构范围不跨出当前文件组，重构与功能提交分开

6. **循环**
   - 回到第 3 步处理下一个行为点，直到功能完整
   - 每个测试独立可运行、不依赖其他测试的执行顺序

7. **回归 + 构建验证**
   - 全部完成后跑 `dotnet test` 确认全部测试通过
   - 跑 `dotnet build` 确认编译无警告（`-warnaserror` 或检查 warning 数未增加）
   - 若解决方案多项目，确认所有受影响项目的测试均通过

## TDD 检查清单

标记工作完成前：
- [ ] 每个新函数/方法有测试
- [ ] 看了每个测试在实现前失败
- [ ] 每个测试因预期原因失败（功能缺失，非拼写错误）
- [ ] 写了最小代码通过每个测试
- [ ] 全部测试通过
- [ ] 输出无错误/警告
- [ ] 测试用真实代码（mock 仅在不可避免时）
- [ ] 覆盖了边界和错误路径

不能全勾？你跳过了 TDD。重新开始。

## 关键原则

- **测试先于实现**——测试描述"要什么"，实现回答"怎么做"。
- **最小实现**——只让当前测试过，不为后续测试预写代码（YAGNI）。
- **每步都跑 dotnet test**——红、绿、重构每步后都跑，错误立刻暴露。
- **xUnit + Moq 组合拳**——xUnit 做断言框架，Moq 做隔离。测 Service 时 mock 掉 Repository/HttpClient/ILogger。
- **测行为不测实现**——断言方法返回值/抛出的异常/状态变化，不断言 `_mockRepo.Verify(x => x.Save(), Times.Once)` 作为首要断言。
- **dotnet CLI 全程驱动**——`dotnet test`、`dotnet build`、`dotnet new`，不依赖 IDE 按钮。

## 常见合理化（全错）

| 借口 | 现实 |
|------|------|
| "太简单不需要测试" | 简单代码也会坏。写测试只要 30 秒。 |
| "我之后补测试" | 后补的测试直接通过证明不了什么。 |
| "我已经手动测过了" | 手动测试无记录、不可复跑、容易忘。 |
| "删掉 X 小时的工作太浪费" | 沉没成本谬误。不可信的代码是技术债。 |
| "TDD 太教条，实用主义才灵活" | TDD 就是实用主义——比调试快、防回归、文档即测试。 |
| "就这一次" | 没有例外。 |
| "先探索一下" | 探索完删掉，从 TDD 开始。 |
| "测试不好写说明设计有问题" | 听测试的。不好测试 = 不好用。 |

## 常用 dotnet 命令速查

| 场景 | 命令 |
|------|------|
| 跑全部测试 | `dotnet test` |
| 跑单个测试 | `dotnet test --filter "FullyQualifiedName~TestName"` |
| 跑某测试类的全部测试 | `dotnet test --filter "FullyQualifiedName~ClassName"` |
| 编译检查（无输出） | `dotnet build --no-restore` |
| 新建 xUnit 测试项目 | `dotnet new xunit -n ProjectName.Tests` |
| 添加 Moq NuGet 包 | `dotnet add package Moq` |
| 添加项目引用 | `dotnet add reference ../src/ProjectName/ProjectName.csproj` |

## 示例

### 红阶段
```csharp
// 文件：<测试目录>/Services/UserServiceTests.cs
[Fact]
public async Task GetUserAsync_WhenUserExists_ReturnsUserDto()
{
    // Arrange
    var userId = 1;
    var user = new User { Id = userId, Name = "张三" };
    _mockRepo.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
             .ReturnsAsync(user);

    // Act
    var result = await _sut.GetUserAsync(userId);

    // Assert
    Assert.NotNull(result);
    Assert.Equal(userId, result.Id);
}
```
→ `dotnet test --filter "FullyQualifiedName~GetUserAsync_WhenUserExists_ReturnsUserDto"` — 失败（`GetUserAsync` 未实现，抛出 NotImplementedException）

### 绿阶段
```csharp
// 文件：<源码目录>/Services/UserService.cs
public async Task<UserDto> GetUserAsync(int id, CancellationToken ct = default)
{
    var user = await _userRepo.GetByIdAsync(id, ct);
    return new UserDto { Id = user.Id, Name = user.Name };
}
```
→ `dotnet test --filter "FullyQualifiedName~GetUserAsync_WhenUserExists_ReturnsUserDto"` — 通过

### 重构阶段
- 提取 `MapToDto(User user)` 方法
- 检查命名是否符合 PascalCase 约定
- 检查是否缺少 CancellationToken 传递
→ `dotnet test` — 全部通过
