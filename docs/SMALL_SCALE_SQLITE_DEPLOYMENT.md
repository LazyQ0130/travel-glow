# 小规模 SQLite 上线清单

这份清单适合初期只向少量用户开放测试。当前阶段先保留 SQLite，不购买 PostgreSQL。

## 你需要准备

1. 一台中国大陆云服务器，推荐 Ubuntu 22.04。
2. 一个已完成 ICP 备案的域名。
3. 一个可以发送验证码的 SMTP 邮箱。
4. Docker 和 Docker Compose。
5. Nginx 和 HTTPS 证书。

## 当前项目已经配置好的部分

1. 生产数据库使用 SQLite 文件：`/data/travel-glow.db`。
2. Docker volume `travel_glow_data` 持久化数据库。
3. Docker volume `travel_glow_uploads` 持久化用户上传文件。
4. Docker volume `travel_glow_backups` 保存备份文件。
5. Docker volume `travel_glow_logs` 保存日志文件。
6. App 端口只绑定到 `127.0.0.1:3000`，不要直接暴露到公网。
7. Redis 只在 Docker 内部网络使用，不映射公网端口。

## 服务器 .env 必填项

在服务器项目目录创建 `.env`，至少填写：

```env
APP_URL="https://你的域名"
JWT_SECRET="换成至少32位以上的随机强密钥"
CORS_ORIGINS="https://你的域名"
TRUST_PROXY=true

EMAIL_PROVIDER=smtp
SMTP_HOST="你的SMTP服务器"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="你的邮箱账号"
SMTP_PASSWORD="你的SMTP授权码"
SMTP_FROM="你的发件邮箱"
```

不要把 `JWT_SECRET`、`SMTP_PASSWORD`、`.env` 发给别人，也不要提交到 Git。

## 启动项目

```sh
docker compose up --build -d
```

查看状态：

```sh
docker compose ps
```

查看日志：

```sh
docker compose logs -f app
```

## Nginx 转发方式

公网只开放 Nginx 的 80 和 443。Nginx 转发到本机 Node 服务：

```text
https://你的域名 -> http://127.0.0.1:3000
```

不要开放这些端口到公网：

```text
3000
6379
```

## 备份

手动执行一次备份：

```sh
docker compose exec app npm run backup
```

备份内容包括：

1. SQLite 数据库文件。
2. 用户上传目录 `server/uploads` 的压缩包。

备份会保存在容器内的 `/app/backups`，对应 Docker volume `travel_glow_backups`。

建议每天执行一次备份。更稳妥的做法是定期把备份复制到服务器外部，例如你的电脑、腾讯云 COS 或阿里云 OSS。

## 每次上线前检查

1. 域名可以 HTTPS 访问。
2. `http://服务器IP:3000` 不能从公网直接访问。
3. Redis 端口 `6379` 不能从公网访问。
4. 可以注册账号。
5. 可以收到邮箱验证码。
6. 可以登录。
7. 可以上传头像或图片。
8. 重启 Docker 后数据还在。
9. 执行 `npm run backup` 后能看到数据库和上传目录备份。

## 以后什么时候换数据库

出现这些情况再考虑从 SQLite 迁移到 MySQL 或 PostgreSQL：

1. 真实用户明显增加。
2. 打卡和上传操作变得频繁。
3. 需要多台服务器同时运行。
4. 数据恢复时间要求更高。
5. 开始有收入或长期运营预算。
