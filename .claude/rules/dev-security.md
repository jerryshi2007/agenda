---
description: 安全底线——处理认证/API/输入输出或触碰敏感代码时遵循。
---

# dev-security · 安全底线

## 约束

- **外部输入必校验**——用户输入、请求参数、外部 API 返回，在边界处校验类型/长度/格式/范围后再用。不信任任何外部数据。
- **不硬编码密钥**——密钥、token、密码、连接串走环境变量或密钥管理服务，绝不进源码。提交即泄露。
- **参数化查询**——数据库查询用参数绑定，不拼接 SQL 字符串。拼接是 SQL 注入口子。
- **输出转义**——渲染到 HTML/URL/JS 上下文的数据按上下文转义，防 XSS。
- **最小权限**——服务账号/Token/角色只授予必需权限；不用 root/超管跑业务。
- **敏感数据不进日志**——密码、token、PII、卡号等不打印到日志/错误信息。日志泄露等同数据泄露。

## 示例

- ✅ `db.query('SELECT * FROM users WHERE id = ?', [userId])`（参数绑定）
- ❌ `db.query('SELECT * FROM users WHERE id = ' + userId)`（字符串拼接，可注入）
- ❌ 代码里 `const API_KEY = 'sk-xxx...'`；或 `logger.info('login with password=' + password)`
