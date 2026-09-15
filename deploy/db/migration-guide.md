# 数据库迁移检查与更新操作指南

> 生产库迁移的**状态检查 + 应用**操作手册，附 2026-09-13 实际检查记录。
> 生产部署拓扑见 [../README.md](../README.md)；本文件不含真实密钥（密码一律用 `<DB密码>` 占位）。

## 1. 生产 DB 拓扑

- 数据库：**独立 docker 容器 `postgres`**（不进 compose，与 API 分署），库名 `agenda`，端口 5432
- 生产环境**不自动迁移**——`Database.Migrate()` 仅在开发环境执行，生产迁移由本机手动跑
- 本机直连数据库用**公网 IP `115.159.206.106`**（内网 `10.0.0.15` 从本机连不通，仅服务器容器内部可用）

## 2. 检查迁移状态

在仓库根目录执行（`<DB密码>` 替换为真实 DB 密码）：

```bash
dotnet ef migrations list   --project api/Agenda.Api/ --startup-project api/Agenda.Api/   --connection "Host=115.159.206.106;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>"
```

**解读输出**：

- 不带 `(Pending)` 后缀的迁移 = 已应用到生产
- 带 `(Pending)` 后缀的迁移 = 尚未应用，需用第 3 节的 `database update` 补齐

## 3. 应用待执行迁移

```bash
dotnet ef database update   --project api/Agenda.Api/ --startup-project api/Agenda.Api/   --connection "Host=115.159.206.106;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>"
```

再次执行第 2 节的 `migrations list` 复核，确认输出中不再有 `(Pending)`。

## 4. 本次检查记录（2026-09-13）

### 4.1 检查结果

| 迁移 | 状态 |
|---|---|
| `20260809110306_InitialCreate` | 已应用 |
| `20260809121037_AddOverrideDate` | 已应用 |
| `20260816013432_AlignUserWithAuthContract` | 已应用 |
| `20260816125357_AddCheckin` | 已应用 |
| `20260818032945_AddFamilyExpansion` | 已应用 |
| `20260819014740_AddTemplateModule` | 已应用 |
| `20260823092338_RenameAssignedChildIdToAssignedMemberId` | ⚠️ Pending |

### 4.2 待应用迁移内容

`RenameAssignedChildIdToAssignedMemberId`：`Schedules` 表列 `AssignedChildId → AssignedMemberId`，并重命名两个相关索引。纯元数据重命名（PostgreSQL `RENAME COLUMN`），不重写数据、可回滚（`Down` 方法完整）。

### 4.3 为何必须应用

2026-09-13 重新 build 的 `agenda-api:1.0.0` 镜像已包含 generalize-schedule-to-member 代码，EF 模型认列名 `AssignedMemberId`。生产库仍是旧列名 `AssignedChildId`，不应用该迁移会导致日程相关查询报 `column "AssignedMemberId" does not exist`。

### 4.4 应用结果

✅ 已执行（2026-09-13，生产环境手动执行 `database update` 应用待迁移）

## 5. 为什么最近的枚举重命名不需要迁移

提交 `2bc05dd`（`Redeemed → Revoked`）只改了 `InvitationCodeStatus` 枚举成员名，整数值仍是 3；存储配置为 `HasConversion<int>()`（整数列），DB 无 schema 变化，故无需新增迁移。

## 6. 注意事项

- 输出中的 `Model.Validation[20601]`（`FamilyStatus` / `DisplayMode` sentinel value）是既有 EF 校验**警告**，非错误，与迁移无关，可忽略。
- 迁移命令会**写生产库**，执行前确认连接串密码正确、库名为 `agenda`。
- 生产迁移可回滚的前提是迁移含正确的 `Down` 方法（`RenameAssignedChildIdToAssignedMemberId` 具备）。
- **密钥不进仓库**：连接串密码用 `<DB密码>` 占位；真实值见服务器 `~/api.env` 或本地 `deploy/api/api.env`（已 gitignore）。