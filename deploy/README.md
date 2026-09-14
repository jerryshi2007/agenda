# Agenda 部署操作指引

> 本文档是服务器整体部署的顶层手册：**nginx 反代 + postgres 数据库 + agenda-api** 三个容器同机分署。API 容器的发布/重部署已拆到 [`deploy/api/README.md`](./api/README.md)（compose 方式），本文档只保留服务器侧一次性准备（建库迁移、nginx、小程序域名）与整体拓扑。

## 发布记录摘要

| 项 | 值 |
|---|---|
| 发布时间 | 2026-08-20 |
| 服务器 | 腾讯云轻量应用服务器，Ubuntu 22.04（4 核 / 3.3G / 40G） |
| 公网 / 内网 IP | `115.159.206.106` / `10.0.0.15` |
| 域名 | `www.paiban.live`（A 记录 → `115.159.206.106`） |
| nginx | 容器 `nginx`（`--network host`），唯一对外入口（80），反代 API + 伺服头像静态文件 |
| API | 容器 `agenda-api`，镜像 `agenda-api:1.0.0`，发布 8080（compose 管理，见 [`deploy/api/README.md`](./api/README.md)） |
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

- nginx / postgres 两个容器为独立 `docker run`；**agenda-api 由 compose 托管**（[`deploy/api/README.md`](./api/README.md)），三者同机、分署。
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

### 3.1 建库 + 迁移

**建库**（服务器，postgres 容器名为 `postgres`）：

```bash
sudo docker exec postgres psql -U postgres -c "CREATE DATABASE agenda;"
```

**跑迁移**（本地 Windows，直连公网库；首次迁移日志里会出现一行 `fail ... SELECT "__EFMigrationsHistory"`，是「表不存在」的正常日志，可忽略）：

```bash
dotnet ef database update --project api/Agenda.Api/ --startup-project api/Agenda.Api/ \
  --connection "Host=115.159.206.106;Port=5432;Database=agenda;Username=postgres;Password=<DB密码>"
```

验证表已建：

```bash
sudo docker exec postgres psql -U postgres -d agenda -c "\dt"
```

### 3.2 部署 API（compose）

API 容器的构建、传输、导入、`api.env` 准备、启动见 [`deploy/api/README.md`](./api/README.md)。

### 3.3 准备并启动 nginx

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

启动 nginx（宿主网络，唯一对外入口）：

```bash
sudo docker run -d \
  --name nginx \
  --restart unless-stopped \
  --network host \
  -v /opt/agenda/nginx/config/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /opt/agenda/nginx/ssl:/etc/nginx/ssl:ro \
  -v /opt/agenda/uploads:/etc/agenda/uploads:ro \
  -v /opt/agenda/web:/etc/agenda/web:ro \
  nginx:latest
```

> `--network host` 让 nginx 直接占用宿主 80，`proxy_pass http://127.0.0.1:8080` 打到 API 发布的 8080；Linux（Ubuntu）上为标准用法。

### 3.4 验证

```bash
sudo docker ps                       # nginx / agenda-api 状态 Up
sudo docker logs nginx               # 看 nginx 启动日志有无异常
curl http://www.paiban.live/health   # 公网经 nginx，应返回 {"status":"healthy",...}
# 上传头像后，curl -I https://paiban.live/uploads/avatars/<userId>.png 应返回 200，而非 404
```

---

## 4. 小程序配置

[app/miniapp/services/api.js](../../app/miniapp/services/api.js) 的 `BASE_URL` 统一指向 HTTPS 根地址：

```js
const BASE_URL = 'https://paiban.live';
```

开发调试时，微信开发者工具 →「详情」→「本地设置」→ 勾选 **「不校验合法域名…」**，或在小程序后台配置「request 合法域名」为 `https://paiban.live`。

---

## 5. 日常重部署

- **API 重部署**（改后端代码）：见 [`deploy/api/README.md`](./api/README.md)。
- **nginx 容器**：不随 API 代码变动，无需重建；改 nginx 配置后 `sudo docker exec nginx nginx -s reload`（或 `sudo docker restart nginx`）。

---

## 6. 生产上线前必做（TODO）

1. **SSL + 备案**：微信小程序 `release` 强制 HTTPS + ICP 备案 + 后台「request 合法域名」配置。届时在 nginx 加 443 server + 证书终结，并把 `Storage__AvatarBaseUrl` 与小程序 `BASE_URL` 切到 `https://www.paiban.live`。
2. **重置 AppSecret**（已泄露）。
3. **postgres 容器重启策略**：`sudo docker update --restart unless-stopped postgres`，确保重启后数据库自动拉起。
4. **备份**：`/opt/agenda/uploads`（头像）+ `postgres` 库，轻量本地盘无冗余，需定期备份。

---

## 7. 常见问题排查

| 现象 | 排查 |
|---|---|
| `curl /health` 不通 | 轻量防火墙是否放行 80；`docker ps` 看容器是否 Up |
| 头像 404 | 检查 nginx `location /uploads/` 的 `alias` 是否指向 `/opt/agenda/uploads/`、`Storage__AvatarBaseUrl` 是否为绝对 URL |
| 小程序提示域名不合法 | 开发勾「不校验合法域名」；生产须 HTTPS + 备案 + 合法域名 |
| 本机连不上内网 IP | 迁移等从本机直连操作，DB 地址用**公网** `115.159.206.106`，不是 `10.0.0.15` |

> API 容器自身的启动失败 / 回滚 / 环境变量问题，见 [`deploy/api/README.md`](./api/README.md)。

---

## 附：目录结构

- [`deploy/api/`](./api/) —— agenda-api 的 compose 部署（`docker-compose.prod.yml` + `api.env` + 操作手册）
- [`deploy/db/`](./db/) —— 数据库迁移指引
- [`deploy/nginx/`](./nginx/) —— nginx 配置
- [`deploy/k8s/`](./k8s/) —— 备选的 k3s/pod 部署清单（本次未采用，留作将来多副本/正式容器化时启用）
