# auth-token Specification

## Purpose
TBD - created by archiving change add-auth-module. Update Purpose after archive.
## Requirements
### Requirement: JWT 签发与验签
后端 MUST 在登录/续期成功时签发 JWT，载荷含 userId/iat/exp，有效期 7 天。当用户角色为 Child 时，MUST 额外包含 `displayMode` claim（值为 `Preschool` / `Primary` / `UpperGrades`）。后端 MUST 对所有受保护 API 请求验签，验签失败返回 401。JWT 签名密钥 MUST 通过环境变量注入，不进源码。

#### Scenario: 正常签发 JWT
- **WHEN** 登录或续期成功
- **THEN** 后端签发 JWT，含 userId、iat、exp（7 天后），返回前端

#### Scenario: Child 登录含 displayMode
- **WHEN** 角色为 Child 的用户登录成功
- **THEN** JWT 含 `displayMode` claim，值为该 child 的当前展示模式（`Preschool` / `Primary` / `UpperGrades`）

#### Scenario: Parent 登录不含 displayMode
- **WHEN** 角色为 Parent 的用户登录成功
- **THEN** JWT 不包含 `displayMode` claim

#### Scenario: JWT 验签失败
- **WHEN** 请求携带被篡改的 JWT
- **THEN** 后端验签失败，返回 HTTP 401

#### Scenario: JWT 过期
- **WHEN** 请求携带的 JWT 的 exp 已过期
- **THEN** 后端返回 HTTP 401

#### Scenario: JWT 过期前 5 分钟策略
- **WHEN** JWT 距离过期时间不足 5 分钟
- **THEN** 后端仍然返回 401，由客户端统一处理续期，不依赖客户端提前刷新

#### Scenario: 后端时钟偏差容忍
- **WHEN** JWT exp 与后端当前时间的偏差在 30 秒以内
- **THEN** 后端容忍该偏差，视为 Token 仍然有效

### Requirement: 请求拦截器自动携带 Token
前端 MUST 在发起所有 API 请求时，通过请求拦截器从 Storage 读取 JWT 并写入 `Authorization: Bearer <jwt>` Header。

#### Scenario: 正常携带 Token
- **WHEN** 用户已登录 AND 发起任意 API 请求
- **THEN** 请求拦截器自动从 Storage 读取 JWT 写入 Authorization Header

#### Scenario: Token 不存在
- **WHEN** Storage 中无 JWT
- **THEN** 请求不携带 Authorization Header，后端返回 401

### Requirement: 静默续期
前端 MUST 在 API 返回 401 时自动触发静默续期：wx.login 获取新 code → 后端换新 JWT → 更新 Storage → 重放原请求。续期过程 MUST 对用户无感知。

#### Scenario: 单次 401 自动续期
- **WHEN** API 返回 HTTP 401
- **THEN** 响应拦截器自动执行 wx.login → 续期接口 → 存储新 JWT → 重放原请求，用户无感知

#### Scenario: 并发 401 续期锁
- **WHEN** 多个 API 同时返回 401 AND 续期正在进行
- **THEN** 后续请求等待首个续期 Promise 完成，使用新 Token 重放各自请求

#### Scenario: 续期时网络异常
- **WHEN** 触发续期 AND wx.login 或续期接口因网络异常失败
- **THEN** 提示"网络异常，请检查网络"，提供重试按钮，清除旧 Token

#### Scenario: 续期时 wx.login 失败（非网络原因）
- **WHEN** 触发续期 AND wx.login 返回非网络原因的失败
- **THEN** 提示"登录已过期，请重新打开小程序"，清除 Token

#### Scenario: 续期接口频率限制触发
- **WHEN** 前端续期请求收到 HTTP 429（频率限制）
- **THEN** 前端等待 60 秒后重试，不连续触发续期

### Requirement: JWT 存储
前端 MUST 将 JWT 存储在微信 Storage 中，使用常量定义的键名。Storage 满时 MUST 提示用户清理缓存。

#### Scenario: 正常存储 JWT
- **WHEN** 登录或续期成功获取新 JWT
- **THEN** 前端通过 wx.setStorageSync 存储 JWT

#### Scenario: Storage 满无法写入
- **WHEN** 续期获取新 JWT AND wx.setStorageSync 因 Storage 满写入失败
- **THEN** 提示"存储空间不足，请清理微信缓存"

### Requirement: 接口频率限制
后端 MUST 对登录和续期接口按用户维度做频率限制，每用户每分钟不超过 10 次。超过限制返回 HTTP 429。

#### Scenario: 正常频率内调用
- **WHEN** 用户在 1 分钟内调用登录/续期接口不超过 10 次
- **THEN** 接口正常响应

#### Scenario: 超过频率限制
- **WHEN** 用户在 1 分钟内调用登录/续期接口超过 10 次
- **THEN** 返回 HTTP 429，提示"操作过于频繁，请稍后再试"

