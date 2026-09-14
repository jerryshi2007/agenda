# Agenda API 部署操作指引（compose 方式）

> 本文档描述 **agenda-api 容器的发布与重部署**，采用 Docker Compose（[`docker-compose.prod.yml`](./docker-compose.prod.yml)）。postgres 与 nginx 仍为独立容器、不进本 compose（原因见 compose 文件头注释）。整体拓扑、nginx 反代、建库迁移、小程序域名见 [`../README.md`](../README.md)。

## 职责边界

| 组件 | 管理方式 | 说明 |
|---|---|---|
| nginx | 独立 `docker run`（`--network host`） | 唯一对外入口，反代到 API 8080 |
| **agenda-api** | **本 compose** | 发布 8080，仅由 nginx 反代触达 |
| postgres | 独立容器 | 库 `agenda`，端口 5432 |

## 文件清单

```
deploy/api/
├── docker-compose.prod.yml   # 仅托管 agenda-api（已入库）
└── api.env                   # 环境变量 + 密钥（已被 .gitignore 排除，只放服务器）
```

## 前置准备

- 服务器已装 Docker ≥ 26（含 compose v2 插件）
- 本地（Windows）已装 Docker Desktop + .NET SDK 10
- postgres / nginx 容器已在服务器运行（首次准备见 [`../README.md`](../README.md)）

## 首次部署

### 1. 本地构建镜像（Windows，仓库根目录）

```bash
docker build -t agenda-api:1.0.0 -f api/Agenda.Api/Dockerfile api/Agenda.Api/
```

> 镜像用 [api/Agenda.Api/Dockerfile](../../api/Agenda.Api/Dockerfile)，环境由运行时注入（不硬编码 Development）。

### 2. 打包传输

```bash
docker save agenda-api:1.0.0 | gzip > /tmp/agenda-api.tar.gz   # 约 123MB
scp /tmp/agenda-api.tar.gz root@115.159.206.106:/tmp/
```

> PowerShell 里 scp 要用 Windows 绝对路径：`C:\Users\<user>\AppData\Local\Temp\agenda-api.tar.gz`。

### 3. 服务器导入镜像

```bash
gunzip -c /tmp/agenda-api.tar.gz | sudo docker load
sudo docker images | grep agenda-api
```

> 服务器上 docker 命令需 `sudo`，或一次性 `sudo usermod -aG docker $USER` 后重登。

### 4. 准备 compose 目录与 api.env

准备头像目录并设权限（镜像内 app 用户 UID=1654）：

```bash
sudo mkdir -p /opt/agenda/uploads
sudo chown -R 1654:1654 /opt/agenda/uploads
```

准备 compose 目录：

```bash
sudo mkdir -p /opt/agenda/deploy/api
scp deploy/api/docker-compose.prod.yml root@115.159.206.106:/opt/agenda/deploy/api/
```

生成 JWT 密钥：

```bash
openssl rand -base64 48
```

创建 `/opt/agenda/deploy/api/api.env`（**与 compose 文件同目录**，含密钥，不进 git）：

```dotenv
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=10.0.0.15;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>
JWT_SECRET_KEY=<JWT密钥>
WeChat__AppId=wxbf3f337f41dfef10
WeChat__AppSecret=<AppSecret>
Storage__AvatarBaseUrl=https://paiban.live/uploads/avatars
```

> `env_file: ./api.env` 相对 compose 文件所在目录解析，故 `api.env` 必须与 `docker-compose.prod.yml` 放在同一目录。

### 5. 启动

```bash
cd /opt/agenda/deploy/api
sudo docker compose -f docker-compose.prod.yml up -d
```

> 从旧 `docker run` 迁到 compose 时，先 `sudo docker rm -f agenda-api`（compose 的 `container_name` 同名会冲突）。

### 6. 验证

```bash
sudo docker compose -f docker-compose.prod.yml ps           # api 状态 Up (healthy)
sudo docker compose -f docker-compose.prod.yml logs -f api   # 无异常（最常见：JWT 密钥为空 / DB 连不上）
curl http://127.0.0.1:8080/health                           # 服务器内直连 8080
```

---

## 日常重部署（改代码后）

```bash
# 1. 本地构建（tag 不变）
docker build -t agenda-api:1.0.0 -f api/Agenda.Api/Dockerfile api/Agenda.Api/

# 2. 打包传输
docker save agenda-api:1.0.0 | gzip > /tmp/agenda-api.tar.gz
scp /tmp/agenda-api.tar.gz root@115.159.206.106:/tmp/

# 3. 服务器导入 + 重建容器
gunzip -c /tmp/agenda-api.tar.gz | sudo docker load
cd /opt/agenda/deploy/api
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
```

> **tag 不变时 compose 认为无变化、不会重建，必须加 `--force-recreate`**；或每次构建换新 tag（`1.0.1`…）并同步改 compose 的 `image:`。

> 只改环境变量（api.env）不动镜像时：改完 `api.env` 直接 `sudo docker compose -f docker-compose.prod.yml up -d --force-recreate`，无需重传镜像。nginx 容器不随 API 代码变动，无需重建。

---

## 环境变量与密钥清单

| 环境变量 | 说明 | 来源 |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | 固定 |
| `ConnectionStrings__DefaultConnection` | 连库串，走内网 `10.0.0.15` | 含 DB 密码 |
| `JWT_SECRET_KEY` | JWT 签名密钥（`openssl rand -base64 48` 生成） | 机密 |
| `WeChat__AppId` | `wxbf3f337f41dfef10` | 半公开 |
| `WeChat__AppSecret` | 微信小程序 AppSecret | **机密**（已随 git 泄露，上线前重置） |
| `Storage__AvatarBaseUrl` | `https://paiban.live/uploads/avatars` | 配置 |

> ⚠️ 变量名是 **`JWT_SECRET_KEY`（扁平）**，不是 `Jwt__SecretKey`——`Program.cs` 专门读该扁平变量覆盖 `Jwt:SecretKey`，写错会导致密钥为空、启动即抛异常。
>
> ⚠️ **密钥管理**：AppSecret、JWT 密钥、DB 密码均经 `api.env` 注入，**不要**写进 git（`api.env` 已在 `.gitignore` 中）。

---

## 回滚

```bash
# 保留旧镜像即可回滚。查看可用镜像：
sudo docker images agenda-api

# 回滚到旧版本：把 compose 的 image: 改为 agenda-api:<旧tag> 后重建
cd /opt/agenda/deploy/api
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
```

> 数据（postgres 库 + `/opt/agenda/uploads`）独立于容器，重建容器不影响数据。

---

## 常见问题排查

| 现象 | 排查 |
|---|---|
| 容器 `CrashLoop` | `docker compose logs api`；最常见是 `JWT_SECRET_KEY` 为空或 DB 连不上 |
| `up -d` 后镜像没更新 | tag 不变需加 `--force-recreate` |
| 头像 404 | 检查 `Storage__AvatarBaseUrl` 是否为绝对 URL、nginx `/uploads/` 的 `alias` 是否指向 `/opt/agenda/uploads/`（nginx 配置见 [`../README.md`](../README.md)） |
| 本机连不上内网 IP | 迁移等从本机直连操作，DB 地址用**公网** `115.159.206.106`，不是 `10.0.0.15` |
