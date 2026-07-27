---
description: .NET/C# 编码规范——编写或审查 C# 代码时遵循。
---

# dev-dotnet-standards · .NET/C# 编码规范

## 约束

### 命名与组织
- **PascalCase 公开成员**——类、方法、属性、命名空间、接口（`I` 前缀）用 PascalCase。暴露给外部的标识符是所有调用方的契约，不统一导致调用方困惑。
- **camelCase 私有/局部**——私有字段（`_` 前缀）、局部变量、参数用 camelCase。私有字段加 `_` 前缀区别于局部变量，避免 `this.x = x` 歧义。
- **文件 = 一个主类型**——一个 `.cs` 文件只放一个公开类/接口/record/struct。文件命名与类型名一致。塞多个类在一个文件会让导航和 diff 定位变难。
- **命名空间与目录一致**——命名空间层级反映文件夹结构。不一致的命名空间让"这个类在哪"的查找变慢。

### 异步模式
- **异步方法后缀 Async**——返回 `Task`/`Task<T>` 的方法名以 `Async` 结尾。调用方看到方法名就知道需要 await。
- **异步一路到底**——不要在同步代码中 `.Result`/`.Wait()` 或 `Task.Run()` 包装异步方法。同步阻塞异步会造成死锁和线程池耗尽。
- **CancellationToken 贯穿**——可取消的操作接受 `CancellationToken` 参数（默认值 `default`），传递给下游异步调用。不传 token 的调用无法响应超时或请求取消。
- **ConfigureAwait(false)**——库代码中的 await 加 `.ConfigureAwait(false)`，避免无意义的 SynchronizationContext 捕获。ASP.NET Core 应用层不需要，但库代码需要。

### 依赖注入
- **构造函数注入优先**——依赖通过构造函数注入，不通过 `IServiceProvider.GetService()` 手动解析。构造注入让依赖关系显式可见，Service Locator 是隐藏依赖。
- **接口编程**——业务逻辑依赖接口而非具体类，便于测试替换（Moq）。具体类注入也不难，但接口让单元测试隔离变得简单。
- **注册生命周期选对**——Singleton（无状态/线程安全服务）、Scoped（请求范围，如 DbContext）、Transient（轻量无状态每次新建）。错误生命周期导致数据泄露（Singleton 持有 Scoped）或多余的创建开销。
- **选项模式**——配置绑定用 `IOptions<T>`/`IOptionsSnapshot<T>`，不直接从 `IConfiguration` 读字符串键。强类型配置有编译检查，字符串键拼错要到运行时才发现。

### 异常处理
- **不吞异常不空 catch**——catch 块必须有明确的处理逻辑（日志、降级、重试），不写空的 `catch { }` 或 `catch(Exception) { }` 什么都不做。吞掉的异常是隐藏的 bug。
- **不在循环里抛异常做控制流**——异常代价高（堆栈采集），用返回值/Result 模式处理"预期中的失败"（如 TryGet、TryParse）。
- **异常信息有上下文**——抛异常时带上关键参数值，如 `throw new InvalidOperationException($"User {userId} already has role {roleId}")`。无上下文的异常日志无法定位。
- **全局异常中间件**——ASP.NET Core 用异常中间件统一处理未捕获异常、记录日志、返回标准错误响应。不在每个 Controller Action 里 try-catch 包装。

### 数据访问
- **SQL 注入防护见 `dev-security` rule**。.NET 实现方式：优先 LINQ/EF Core；若需裸 SQL 则用参数化查询（`SqlParameter`）。
- **DbContext 生命周期 Scoped**——DbContext 注册为 Scoped，不在 Singleton 中注入。DbContext 不是线程安全的，一次一个请求。
- **仓储模式**——数据访问封装在 Repository 中，业务逻辑层不直接依赖 DbContext。隔离数据层，方便测试时 mock 仓储。
- **不跟踪只读查询**——纯读取查询用 `.AsNoTracking()`，避免 Change Tracker 额外内存与 CPU 开销。

### API 设计
- **RESTful 约定**——GET 读、POST 建、PUT 全量改、PATCH 部分改、DELETE 删。不把副作用塞 GET、不把删除伪装成 POST。
- **DTO 隔离**——不把 Entity 直接暴露到 API 响应；用 DTO/ViewModel。Entity 变更（加字段、改关系）不应直接破坏 API 契约。
- **FluentValidation 校验**——输入校验用 FluentValidation，在请求管道中（`AbstractValidator<T>`）。校验逻辑集中在 Validator 类中，Controller 保持简洁。
- **分页标准化**——列表接口返回 `{ items, totalCount, page, pageSize }` 结构，默认 pageSize 有上限（如 100），防止一次返回全量数据压垮内存。

## 示例

### 命名
- ✅ `public class UserService { private readonly IUserRepository _userRepository; ... }`
- ❌ `public class userservice { private IUserRepository UserRepository; ... }`（大小写不统一、私有字段无 `_`）

### 异步
- ✅ `public async Task<UserDto> GetUserAsync(int id, CancellationToken ct = default) { return await _repo.GetByIdAsync(id, ct).ConfigureAwait(false); }`
- ❌ `public UserDto GetUser(int id) { return _repo.GetByIdAsync(id).Result; }`（同步阻塞异步、无 CancellationToken）

### DI
- ✅ `public UserService(IUserRepository repo, ILogger<UserService> logger) { ... }`
- ❌ 在方法里 `var repo = HttpContext.RequestServices.GetService<IUserRepository>();`（Service Locator 反模式）

### 异常
- ✅ `catch (SqlException ex) { _logger.LogError(ex, "DB error for user {UserId}", userId); throw new ServiceException("...", ex); }`
- ❌ `catch { }` 或 `catch (Exception) { }` 空块

### 数据访问
- ✅ `var users = await _dbContext.Users.Where(u => u.IsActive).AsNoTracking().ToListAsync(ct);`
- ❌ `var sql = "SELECT * FROM Users WHERE Name = '" + name + "'";`（SQL 注入，违反 `dev-security` rule）
