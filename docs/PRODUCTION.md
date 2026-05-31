# 生产环境配置说明

本文档记录 Travel Glow 上线前需要配置的环境变量和人工操作。

## 环境变量

以 `.env.example` 为模板创建生产环境 `.env`。生产环境至少需要确认以下变量：

```env
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.example

DATABASE_URL="postgresql://travel_glow:strong-password@db-host:5432/travel_glow?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="30d"
CORS_ORIGINS="https://your-domain.example"
TRUST_PROXY=true

SMS_PROVIDER=aliyun
SMS_ACCESS_KEY=
SMS_ACCESS_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=
SMS_TEMPLATE_PARAM_NAME=code
SMS_TIMEOUT_MS=5000

LOG_LEVEL=info
RUN_MIGRATIONS_ON_START=true
```

腾讯云短信还需要：

```env
SMS_PROVIDER=tencent
SMS_APP_ID=
SMS_REGION=ap-guangzhou
SMS_DEFAULT_COUNTRY_CODE=+86
```

## 短信模板

当前验证码发送逻辑默认把验证码作为模板变量传入：

- 阿里云：`TemplateParam` 为 `{"code":"123456"}`，变量名可通过 `SMS_TEMPLATE_PARAM_NAME` 修改。
- 腾讯云：`TemplateParamSet` 为 `["123456"]`，模板内第一个变量应为验证码。

如果控制台里申请的模板变量名或顺序不同，需要同步调整环境变量或模板内容。

## PostgreSQL 注意事项

当前 `prisma/schema.prisma` 的 datasource provider 仍是 `sqlite`。切换生产 PostgreSQL 时，需要人工完成：

1. 将 `prisma/schema.prisma` 中 datasource provider 从 `sqlite` 改为 `postgresql`。
2. 设置生产 `DATABASE_URL` 为 PostgreSQL 连接串。
3. 基于 PostgreSQL 重新生成并检查迁移。
4. 在生产库执行迁移前做好备份和回滚预案。

## Docker 启动

镜像默认通过 `scripts/start.sh` 启动：

```sh
docker build -t travel-glow .
docker run --env-file .env -p 3000:3000 travel-glow
```

默认会在启动时执行：

```sh
npx prisma migrate deploy
```

如需由 CI/CD 单独执行迁移，可设置：

```env
RUN_MIGRATIONS_ON_START=false
```

## 必须由你手动完成的操作

1. 在阿里云或腾讯云控制台注册账号并完成实名认证。
2. 开通短信服务。
3. 申请短信签名，并等待审核通过。
4. 申请验证码短信模板，并等待审核通过。
5. 获取 API Key 和 Secret，并按最小权限原则配置访问策略。
6. 腾讯云需要额外获取短信应用 ID，并填入 `SMS_APP_ID`。
7. 配置 PostgreSQL 数据库、账号、强密码、备份策略和网络访问规则。
8. 如果从 SQLite 切换到 PostgreSQL，按上文手动调整 Prisma datasource 并重新生成迁移。
9. 配置 Nginx 反向代理，将外部域名转发到应用端口。
10. 配置 HTTPS 证书和自动续期。
11. 配置 PM2 或容器编排平台的进程管理、重启策略和日志采集。
12. 配置防火墙，只开放必要端口。
13. 在真实手机号上完成短信发送验收，并确认模板变量正确。
