-- Docker 初始化脚本
-- 仅在数据库首次创建时执行（通过 docker-entrypoint-initdb.d）

-- 确保 postgres 用户有足够权限
GRANT ALL PRIVILEGES ON DATABASE agenda_dev TO postgres;
