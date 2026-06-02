# 旅光 Travel Glow

Travel Glow 是一个 Express + Prisma + 原生前端的旅行打卡练习项目。当前版本加入了更接近企业级后端的基础能力：安全响应头、生产配置校验、结构化日志、服务端 session 校验、审计日志、软删除、分页、健康检查、Docker 部署配置和自动化测试。

## 技术栈

- 前端：HTML、Tailwind CDN、Lucide CDN、原生 JavaScript
- 后端：Node.js、Express
- ORM：Prisma
- 本地数据库：SQLite
- 生产数据库准备：PostgreSQL compose 服务和连接配置
- 鉴权：JWT + 服务端 LoginSession
- 安全：Helmet、CORS 白名单、bcrypt、Zod、上传文件校验、登录失败锁定
- 日志：pino / pino-http
- 测试：node:test

## 快速开始

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

打开：

```text
http://localhost:3000
```

本地演示账号仅用于开发环境。不要在文档或生产环境中保留真实账号、真实邮箱或固定弱密码；需要演示数据时，请运行 seed 后按本地输出或通过注册入口创建临时账号。

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改：

```text
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-secret-before-production"
JWT_EXPIRES_IN="30d"
PORT=3000
CORS_ORIGINS="http://localhost:3000"
LOG_LEVEL="debug"
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-smtp-account@example.com"
SMTP_PASSWORD="your-smtp-password-or-app-password"
SMTP_FROM="your-smtp-account@example.com"
EXPOSE_DEV_EMAIL_CODE=false
```

生产环境必须提供强随机 `JWT_SECRET`。如果 `NODE_ENV=production` 但仍使用默认弱密钥，服务会拒绝启动。
邮箱验证码要真实发送到用户邮箱，必须配置可用的 SMTP 服务。仅本地调试时可以把 `EMAIL_PROVIDER` 改为 `mock` 并临时设置 `EXPOSE_DEV_EMAIL_CODE=true`。

## 常用脚本

```bash
npm run dev
npm start
npm run start:prod
npm test
npm run test:coverage
npm run check
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed
```

## 企业级加固点

- 安全：Helmet、CORS 白名单、强制生产 JWT 密钥、强密码策略、登录失败锁定、文件扩展名/MIME/文件头校验。
- 数据：Checkin 和 Photo 软删除，User 注销软删除，用户维度组合索引，列表分页。
- 架构：新增配置、日志、错误、分页、密码策略和 service helper 模块，路由层只保留请求编排。
- 日志和监控：结构化请求日志、request id、基础健康检查 `/api/health`、数据库就绪检查 `/api/ready`。
- 部署：`Dockerfile`、`docker-compose.yml`、graceful shutdown、compose healthcheck。
- 测试：覆盖鉴权失败、弱密码、登录锁定、分页、软删除、上传安全和 ready 检查。

## Docker

```bash
$env:JWT_SECRET="replace-with-a-long-random-secret"
docker compose up --build
```

Compose 当前保持应用使用 SQLite 数据文件以兼容现有 Prisma schema，同时启动 PostgreSQL 服务用于迁移准备。真正切换到 PostgreSQL 时，需要把 Prisma datasource provider 从 `sqlite` 切到 `postgresql`，并基于 PostgreSQL 重新生成迁移。

## API 文档

详见 [docs/API.md](docs/API.md)。

## 提交前检查

```bash
npm run check
```

不要提交：

- `node_modules/`
- `.env`
- `coverage/`
- `prisma/*.db`
- 用户上传图片
