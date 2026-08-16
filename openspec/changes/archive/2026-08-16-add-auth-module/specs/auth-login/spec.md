# auth-login · 隐私政策与微信静默登录

## ADDED Requirements

### Requirement: 隐私政策弹窗展示与同意
系统 MUST 在用户首次打开小程序且未缓存同意状态时展示隐私政策弹窗。弹窗 MUST 包含隐私政策内容链接、勾选框、同意和不同意按钮。未勾选时同意按钮 MUST 置灰。

#### Scenario: 首次打开展示隐私弹窗
- **WHEN** 用户首次打开小程序 AND 本地无隐私同意缓存
- **THEN** 系统展示隐私政策弹窗，含政策链接、未勾选的复选框、置灰的同意按钮、可点击的不同意按钮

#### Scenario: 未勾选时同意按钮不可用
- **WHEN** 隐私政策弹窗展示 AND 用户未勾选"我已阅读并同意"
- **THEN** "同意并继续"按钮保持置灰，点击无响应

#### Scenario: 勾选后同意继续
- **WHEN** 隐私政策弹窗展示 AND 用户已勾选"我已阅读并同意"
- **THEN** "同意并继续"按钮可点击，点击后缓存同意状态（含版本号）到本地 Storage，开始 wx.login 流程

#### Scenario: 拒绝隐私政策
- **WHEN** 隐私政策弹窗展示 AND 用户点击"不同意"
- **THEN** 系统跳转静态提示页"需要同意隐私政策才能使用"，不调用任何 API

#### Scenario: 再次打开跳过弹窗
- **WHEN** 用户之前已同意隐私政策 AND 本地缓存的同意版本号与当前政策版本号一致
- **THEN** 系统跳过隐私政策弹窗，直接进入登录流程

#### Scenario: 隐私政策版本更新后重新同意
- **WHEN** 用户之前已同意隐私政策 AND 小程序升级后隐私政策版本号变更
- **THEN** 系统再次展示隐私政策弹窗，要求用户重新同意

#### Scenario: 隐私政策链接不可达
- **WHEN** 弹窗中隐私政策链接被点击 AND 网络不可用或链接失效
- **THEN** 系统提示"暂时无法加载，请稍后查看"，不阻断流程，用户仍可勾选同意

### Requirement: 微信静默登录
系统 MUST 在用户同意隐私政策后通过 wx.login 获取 code，后端通过 `jscode2session` 换取 openid，查找或创建账户，签发 JWT 返回前端。

#### Scenario: 正常登录流程
- **WHEN** 用户已同意隐私政策 AND wx.login 成功返回 code
- **THEN** 后端用 code 换取 openid，查找已有账户或创建新账户，签发 JWT 返回前端，前端存储到 Storage

#### Scenario: wx.login 失败
- **WHEN** wx.login 调用失败（微信服务异常或网络不可用）
- **THEN** 系统展示"登录失败，请检查网络后重试"提示和重试按钮，不进入后续流程

#### Scenario: 后端换 openid 超时
- **WHEN** 后端调用微信 jscode2session API 超时（>5s）
- **THEN** 后端自动重试 1 次，仍失败则返回前端提示"服务繁忙，请稍后重试"

#### Scenario: 新用户自动创建账户
- **WHEN** 后端未找到对应 openid 的用户记录
- **THEN** 后端自动创建新账户（默认昵称"微信用户"、默认头像占位符、记录创建时间），返回新 userId + JWT

#### Scenario: wx.login 并发调用加锁
- **WHEN** 短时间内多次触发 wx.login
- **THEN** 前端只执行一次 wx.login，重复调用直接返回 pending 的 Promise

#### Scenario: 微信 API 返回 code 已使用错误
- **WHEN** 后端调用 jscode2session 返回 code 已使用错误
- **THEN** 后端返回特定错误码给前端，前端重新调用 wx.login 获取新 code 后重试，最多 1 次

#### Scenario: Storage 清除后重新登录
- **WHEN** 用户清除微信 Storage 导致 Token 丢失 AND 用户打开小程序
- **THEN** 系统重新走完整登录流程，用户无感知（wx.login 静默完成）

#### Scenario: 微信账号切换
- **WHEN** 用户在微信中切换账号 AND wx.login 返回新 openid
- **THEN** 后端查找新 openid，有则返回已有账户、无则创建新账户

### Requirement: 隐私政策版本号管理
系统 MUST 在本地缓存隐私同意状态时记录版本号。小程序升级后若隐私政策内容有变更，MUST 更新版本号并要求所有用户重新同意。

#### Scenario: 版本号不变时跳过弹窗
- **WHEN** 用户已同意隐私政策 AND 缓存的版本号与当前一致
- **THEN** 跳过隐私政策弹窗

#### Scenario: 版本号变更时重新弹窗
- **WHEN** 用户已同意隐私政策 AND 缓存的版本号与当前不一致
- **THEN** 重新展示隐私政策弹窗，要求重新同意
