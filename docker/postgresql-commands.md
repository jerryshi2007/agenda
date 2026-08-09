# Docker PostgreSQL 常用命令速查

## 基本信息

| 项目 | 值 |
|------|-----|
| 容器名 | `agenda-postgres` |
| 镜像 | `postgres:16-alpine` |
| 数据库 | `agenda_dev` |
| 用户名 | `postgres` |
| 密码 | `postgres` |
| 端口 | `localhost:5432` |

## 容器生命周期

```bash
# 启动（项目根目录下）
cd d:/GitCode/Github/agenda
docker compose up -d postgres

# 停止
docker compose stop postgres

# 重启
docker compose restart postgres

# 停止并删除容器（数据不丢，存在 volume 里）
docker compose down postgres

# 停止并删除容器 + 清空数据（⚠️ 不可恢复）
docker compose down -v postgres
```

## 查看状态

```bash
# 容器状态
docker compose ps postgres

# 查看日志
docker compose logs postgres

# 实时日志（Ctrl+C 退出）
docker compose logs -f postgres

# 最近 50 行日志
docker compose logs --tail=50 postgres
```

## 进入数据库

```bash
# psql 交互式命令行
docker compose exec postgres psql -U postgres -d agenda_dev

# 执行单条 SQL（不进入交互模式）
docker compose exec postgres psql -U postgres -d agenda_dev -c "SELECT * FROM \"Schedules\";"

# 执行 SQL 文件
docker compose exec -T postgres psql -U postgres -d agenda_dev < /path/to/query.sql
```

## psql 常用命令

```sql
-- 查看所有表
\dt

-- 查看某表结构
\d "Schedules"

-- 查看索引
\di

-- 查看数据库大小
SELECT pg_database_size('agenda_dev') / 1024 / 1024 AS size_mb;

-- 查看表大小（含索引）
SELECT relname, pg_total_relation_size(relid) / 1024 / 1024 AS size_mb
FROM pg_catalog.pg_statio_user_tables ORDER BY size_mb DESC;

-- 退出
\q
```

## 常见操作

```bash
# 查看所有日程
docker compose exec postgres psql -U postgres -d agenda_dev -c \
  'SELECT "Id", "Name", "ScheduleType", "AssignedChildId", "IsDeleted" FROM "Schedules";'

# 查看日程时间槽
docker compose exec postgres psql -U postgres -d agenda_dev -c \
  'SELECT * FROM "TimeSlots";'

# 查看取消记录
docker compose exec postgres psql -U postgres -d agenda_dev -c \
  'SELECT * FROM "Cancellations";'

# 清空某表（⚠️ 谨慎）
docker compose exec postgres psql -U postgres -d agenda_dev -c \
  'DELETE FROM "TimeSlots";'

# 重置整个数据库（⚠️ 删除所有数据）
docker compose down -v postgres
docker compose up -d postgres
```

## 备份与恢复

```bash
# 导出（备份到本地文件）
docker compose exec postgres pg_dump -U postgres agenda_dev > backup.sql

# 仅导出结构（不含数据）
docker compose exec postgres pg_dump -U postgres --schema-only agenda_dev > schema.sql

# 仅导出数据
docker compose exec postgres pg_dump -U postgres --data-only agenda_dev > data.sql

# 恢复
docker compose exec -T postgres psql -U postgres -d agenda_dev < backup.sql
```

## 故障排查

```bash
# 检查容器是否运行
docker compose ps postgres

# 检查 PostgreSQL 是否接受连接
docker compose exec postgres pg_isready -U postgres

# 查看已建立的连接
docker compose exec postgres psql -U postgres -d agenda_dev -c \
  'SELECT pid, usename, application_name, state FROM pg_stat_activity;'

# 杀掉空闲连接
docker compose exec postgres psql -U postgres -d agenda_dev -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND pid <> pg_backend_pid();"

# 查看 PostgreSQL 配置
docker compose exec postgres psql -U postgres -c 'SHOW max_connections;'
docker compose exec postgres psql -U postgres -c 'SHOW shared_buffers;'
```
