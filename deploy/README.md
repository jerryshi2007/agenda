# Agenda API 部署操作指引

> 本文档是本次发布（2026-08-20）的部署记录 + 可复用的操作手册。实际采用 **docker run 单容器**方案（非 k8s、非 compose），API 与 PostgreSQL **分署为两个独立容器**。

## 发布记录摘要

| 项 | 值 |
|---|---|
| 发布时间 | 2026-08-20 |
| 服务器 | 腾讯云轻量应用服务器，Ubuntu 22.04（4 核 / 3.3G / 40G） |
| 公网 / 内网 IP | `115.159.206.106` / `10.0.0.15` |
| 域名 | `www.paiban.live`（A 记录 → `115.159.206.106`） |
| nginx | 容器 `nginx`（`--network host`），唯一对外入口（80），反代 API + 伺服头像静态文件 |
| API | 容器 `agenda-api`，镜像 `agenda-api:1.0.0`，发布 8080（`-p 8080:8080`） |
| 数据库 | 独立容器 `postgres`，库 `agenda`（14 张表），端口 5432 |
| 环境 | `ASPNETCORE_ENVIRONMENT=Production` |
| SSL | 无（HTTP 80），仅开发/体验调试用 |
| 头像文件 | bind mount `/opt/agenda/uploads`（API 读写 + nginx 只读） |

---

## 1. 部署拓扑

```
                    ┌──────────────────────────────────────────┐
 小程序/浏览器       │  腾讯云轻量服务器 (Ubuntu 22.04)          │
  ──HTTP 80──▶      │                                          │
                    │  Docker 容器 nginx (--network host)       │
                    │    listen 80（唯一对外入口）               │
                    │    /uploads/ 直接伺服头像（只读挂载）        │
                    │    其余 / → proxy_pass 127.0.0.1:8080    │
                    │         │                                │
                    │         ▼                                │
                    │  Docker 容器 agenda-api (-p 8080:8080)    │
                    │    Production 环境                        │
                    │    volume: /opt/agenda/uploads (读写)      │
                    │         │                                │
                    │         │ 经内网 10.0.0.15:5432          │
                    │         ▼                                │
                    │  Docker 容器 postgres (库 agenda)          │
                    └──────────────────────────────────────────┘
```

- nginx / API / postgres 三个容器**同机、分署**，不 compose、不进 pod。
- nginx 用 `--network host` 直接占用宿主 80，是唯一对外入口；API 发布 8080 仅由 nginx 反代触达。
- API 连库走**内网 IP**（`10.0.0.15`），避免绕公网 hairpin NAT。

---

## 2. 前置准备

- 服务器已装 Docker（`docker --version` ≥ 26）
- 拉取 nginx 镜像：`docker pull nginx:1.27-alpine`
- 本地（Windows）已装 Docker Desktop + `.NET SDK 10` + `dotnet-ef`
- 轻量控制台**防火墙放行 TCP 80**（正式上线后还需 443）
- 域名已解析：`www.paiban.live` A 记录 → `115.159.206.106`

---

## 3. 首次部署步骤

### 3.1 本地构建镜像（Windows，在仓库根目录）

```bash
docker build -t agenda-api:1.0.0 -f api/Dockerfile api/
```

> 镜像用 [api/Dockerfile](../../api/Dockerfile)，环境由运行时注入（不硬编码 Development）。

### 3.2 打包并传输镜像到服务器

```bash
docker save agenda-api:1.0.0 | gzip > /tmp/agenda-api.tar.gz   # 约 123MB
scp /tmp/agenda-api.tar.gz root@115.159.206.106:/tmp/
```

> PowerShell 里 scp 要用 Windows 绝对路径：`C:\Users\<user>\AppData\Local\Temp\agenda-api.tar.gz`。

### 3.3 服务器导入镜像

```bash
gunzip -c /tmp/agenda-api.tar.gz | sudo docker load
sudo docker images | grep agenda-api
```

> 服务器上 docker 命令需 `sudo`，或一次性 `sudo usermod -aG docker $USER` 后重登。

### 3.4 建库 + 迁移

**建库**（服务器，postgres 容器名为 `postgres`）：

```bash
sudo docker exec postgres psql -U postgres -c "CREATE DATABASE agenda;"
```

**跑迁移**（本地 Windows，直连公网库；首次迁移日志里会出现一行 `fail ... SELECT "__EFMigrationsHistory"`，是「表不存在」的正常日志，可忽略）：

```bash
dotnet ef database update --project api/ --startup-project api/ \
  --connection "Host=115.159.206.106;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>"
```

验证表已建：

```bash
sudo docker exec postgres psql -U postgres -d agenda -c "\dt"
```

### 3.5 启动容器

先准备头像目录并设权限（镜像内 app 用户 UID=1654）：

```bash
sudo mkdir -p /opt/agenda/uploads
sudo chown -R 1654:1654 /opt/agenda/uploads
```

准备 nginx 配置目录：

```bash
sudo mkdir -p /opt/agenda/nginx
```

nginx 配置文件 `/opt/agenda/nginx/nginx.conf` 内容如下（`alias` 指向头像共享目录，其余反代 API）：

```nginx
events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name www.paiban.live;

        # 头像静态资源：nginx 直接从共享挂载目录伺服（只读）
        location /uploads/ {
            alias /opt/agenda/uploads/;
            expires 7d;
            access_log off;
        }

        # 其余一律反代到 API 的 8080
        location / {
            proxy_pass http://127.0.0.1:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

生成 JWT 密钥：

```bash
openssl rand -base64 48
```

启动 API（发布 8080，头像 URL 走 nginx）：

```bash
sudo docker run -d \
  --name agenda-api \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /opt/agenda/uploads:/app/uploads \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e Storage__AvatarBaseUrl='http://www.paiban.live/uploads/avatars' \
  -e JWT_SECRET_KEY='<JWT密钥>' \
  -e WeChat__AppId='wxbf3f337f41dfef10' \
  -e WeChat__AppSecret='<AppSecret>' \
  -e ConnectionStrings__DefaultConnection='Host=10.0.0.15;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>' \
  agenda-api:1.0.0
```

启动 nginx（宿主网络，唯一对外入口）：

```bash
sudo docker run -d \
  --name nginx \
  --restart unless-stopped \
  --network host \
  -v /opt/agenda/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /opt/agenda/uploads:/opt/agenda/uploads:ro \
  nginx:1.27-alpine
```

> `--network host` 让 nginx 直接占用宿主 80，`proxy_pass http://127.0.0.1:8080` 打到 API 发布的 8080；Linux（Ubuntu）上为标准用法。

### 3.6 验证

```bash
sudo docker ps                       # nginx / agenda-api 状态 Up
sudo docker logs agenda-api          # 看 API 启动日志有无异常
sudo docker logs nginx               # 看 nginx 启动日志有无异常
curl http://127.0.0.1/health         # 服务器内（绕过 nginx 直连 8080：curl http://127.0.0.1:8080/health）
curl http://www.paiban.live/health   # 公网，应返回 {"status":"healthy",...}
# 上传头像后，curl -I http://www.paiban.live/uploads/avatars/<userId>.png 应返回 200，而非 404
```

---

## 4. 小程序配置

[app/services/api.js](../../app/services/api.js) 的 `BASE_URL` 按微信环境自动切换：

```js
const BASE_URL = ENV_VERSION === 'release'
  ? 'https://www.paiban.live'   // 生产（须 HTTPS + 备案 + 合法域名）
  : 'http://www.paiban.live';   // 开发/体验版（HTTP，工具勾「不校验合法域名」）
```

开发调试时，微信开发者工具 →「详情」→「本地设置」→ 勾选 **「不校验合法域名…」**。

---

## 5. 日常重部署（改代码后）

```bash
# 1. 本地构建（换新 tag 或用 :latest + Always）
docker build -t agenda-api:1.0.0 -f api/Dockerfile api/

# 2. 打包传输
docker save agenda-api:1.0.0 | gzip > /tmp/agenda-api.tar.gz
scp /tmp/agenda-api.tar.gz root@115.159.206.106:/tmp/

# 3. 服务器导入 + 重启容器
gunzip -c /tmp/agenda-api.tar.gz | sudo docker load
sudo docker rm -f agenda-api
# 重新执行 3.5 的 docker run（或把启动命令存成脚本/别名）
```

> 只改环境变量、不动镜像时，直接 `docker rm -f agenda-api` 后重 `docker run` 即可，无需重传镜像。nginx 容器不随 API 代码变动，无需重建。

---

## 6. 环境变量与密钥清单

| 环境变量 | 说明 | 来源 |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | 固定 |
| `JWT_SECRET_KEY` | JWT 签名密钥（`openssl rand -base64 48` 生成） | 机密 |
| `WeChat__AppId` | `wxbf3f337f41dfef10` | 半公开 |
| `WeChat__AppSecret` | 微信小程序 AppSecret | **机密**（已随 git 泄露，上线前重置） |
| `Storage__AvatarBaseUrl` | `http://www.paiban.live/uploads/avatars`（SSL 后改 https） | 配置 |
| `ConnectionStrings__DefaultConnection` | `Host=10.0.0.15;...;Database=agenda` | 含 DB 密码 |

⚠️ **密钥管理**：AppSecret、JWT 密钥、DB 密码均经 `docker run -e` 注入，**不要**写进 git。`appsettings.Development.json` 里的 AppSecret 已泄露，正式上线前去微信公众平台重置。

---

## 7. 回滚

```bash
# 保留旧镜像即可回滚。查看可用镜像：
sudo docker images agenda-api

# 回滚到旧版本：用旧 tag 重新 docker run
sudo docker rm -f agenda-api
sudo docker run -d --name agenda-api --restart unless-stopped -p 8080:8080 \
  -v /opt/agenda/uploads:/app/uploads \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e Storage__AvatarBaseUrl='http://www.paiban.live/uploads/avatars' \
  -e JWT_SECRET_KEY='<原密钥>' -e WeChat__AppId='...' -e WeChat__AppSecret='...' \
  -e ConnectionStrings__DefaultConnection='Host=10.0.0.15;...' \
  agenda-api:<旧tag>
```

> 数据（库 + `/opt/agenda/uploads`）独立于容器，删容器重建不影响数据。

---

## 8. 生产上线前必做（TODO）

1. **SSL + 备案**：微信小程序 `release` 强制 HTTPS + ICP 备案 + 后台「request 合法域名」配置。届时在 nginx 加 443 server + 证书终结，并把 `Storage__AvatarBaseUrl` 与小程序 `BASE_URL` 切到 `https://www.paiban.live`。
2. **重置 AppSecret**（已泄露）。
3. **postgres 容器重启策略**：`sudo docker update --restart unless-stopped postgres`，确保重启后数据库自动拉起。
4. **备份**：`/opt/agenda/uploads`（头像）+ `postgres` 库，轻量本地盘无冗余，需定期备份。

---

## 9. 常见问题排查

| 现象 | 排查 |
|---|---|
| `curl /health` 不通 | 轻量防火墙是否放行 80；`docker ps` 看容器是否 Up |
| Pod/容器 `CrashLoop` | `docker logs agenda-api`；最常见是 JWT 密钥为空或 DB 连不上 |
| 迁移 `fail` 报错 | 看 `ORDER BY` 之后的 Npgsql 异常：`28P01` 密码错 / `3D000` 库不存在 / `42P01` 首次正常 |
| 头像 404 | 检查 nginx `location /uploads/` 的 `alias` 是否指向 `/opt/agenda/uploads/`、`Storage__AvatarBaseUrl` 是否为绝对 URL |
| 小程序提示域名不合法 | 开发勾「不校验合法域名」；生产须 HTTPS + 备案 + 合法域名 |
| 本机连不上内网 IP | 迁移等从本机直连操作，DB 地址用**公网** `115.159.206.106`，不是 `10.0.0.15` |

---

## 附：docker run 启动命令模板

```bash
sudo docker run -d --name agenda-api --restart unless-stopped \
  -p 8080:8080 \
  -v /opt/agenda/uploads:/app/uploads \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e Storage__AvatarBaseUrl='http://www.paiban.live/uploads/avatars' \
  -e JWT_SECRET_KEY='<JWT密钥>' \
  -e WeChat__AppId='wxbf3f337f41dfef10' \
  -e WeChat__AppSecret='<AppSecret>' \
  -e ConnectionStrings__DefaultConnection='Host=10.0.0.15;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>' \
  agenda-api:1.0.0
```

> 另见 [`deploy/k8s/`](./k8s/) —— 备选的 k3s/pod 部署清单（本次未采用，留作将来多副本/正式容器化时启用）。
