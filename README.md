# 旅光 Travel Glow

旅光 Travel Glow 是一个从静态前端 Demo 改造成的全栈练手项目。前端保留原来的 `HTML + Tailwind CDN + Lucide CDN + 原生 JavaScript`，后端使用 `Node.js + Express + SQLite + Prisma`，支持登录、真实打卡、图片上传、相册、统计和刷新后数据持久化。

## 技术栈

- 前端：HTML、Tailwind CDN、Lucide Icons CDN、原生 JavaScript
- 后端：Node.js、Express
- 数据库：SQLite
- ORM：Prisma
- 上传：Multer
- 登录鉴权：JWT
- 密码加密：bcryptjs
- 环境变量：dotenv
- 跨域：cors
- 开发重启：nodemon

## 目录结构

```text
travel-glow/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── data/
│   └── seed-data.js
├── public/
│   └── index.html
└── server/
    ├── app.js
    ├── db.js
    ├── middleware/
    │   └── auth.js
    ├── routes/
    │   ├── auth.js
    │   ├── user.js
    │   ├── regions.js
    │   ├── checkins.js
    │   ├── photos.js
    │   ├── stats.js
    │   └── map.js
    └── uploads/
```

## 安装和初始化

第一次运行请依次执行：

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

然后打开：

```text
http://localhost:3000
```

也可以使用一键脚本：

```bash
npm run setup
npm run dev
```

## 测试账号

```text
账号名: demo
手机号: 13800000000
email: demo@travelglow.local
password: 123456
```

也保留了原始练习账号：

```text
email: 321167759@qq.com
账号名: qyf
手机号: 13900000000
password: 123456
```

前端会把 JWT token 存到 `localStorage`。未登录时进入「我的」页，可以选择账号密码登录、手机号验证码登录、注册，或点击「Demo 登录」快速体验。

本地开发环境使用模拟短信服务。点击“发送验证码”后，接口会返回 `devCode`，前端按钮会临时显示验证码，方便练习完整流程。生产环境可在 `server/sms.js` 中接入真实短信服务商。

## 主要功能

- 用户注册、登录、自动登录
- 自定义账号名登录
- 手机号验证码注册
- 手机号验证码登录
- 绑定手机号和邮箱
- 用户资料读取和修改
- 头像上传
- 修改密码
- 隐私设置、地图主题、点亮颜色、照片显示模式、通知偏好
- 照片存储统计
- 导出个人数据 JSON
- 注销账号入口
- 中国省份、城市/地区点亮
- 世界国家、特殊地区点亮
- 中国和世界搜索
- 添加真实打卡
- 编辑和删除打卡
- 上传和删除照片
- 相册从数据库读取
- 首页和我的页统计从数据库实时计算
- SQLite 持久化，刷新页面后数据保留

## 主要 API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/login/phone`
- `POST /api/auth/sms/send`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `DELETE /api/auth/sessions/:id`
- `DELETE /api/auth/sessions/others`
- `GET /api/health`
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/avatar`
- `PUT /api/user/phone`
- `PUT /api/user/password`
- `GET /api/user/settings`
- `PUT /api/user/settings`
- `GET /api/user/storage`
- `POST /api/user/export`
- `DELETE /api/user/cache`
- `DELETE /api/user/account`
- `GET /api/regions/china/provinces`
- `GET /api/regions/provinces/:id/cities`
- `GET /api/regions/continents`
- `GET /api/regions/continents/:id/countries`
- `GET /api/regions/search?keyword=`
- `GET /api/regions/:id/checkins`
- `POST /api/checkins`
- `GET /api/checkins`
- `GET /api/checkins/:id`
- `PUT /api/checkins/:id`
- `DELETE /api/checkins/:id`
- `POST /api/photos/upload`
- `GET /api/photos`
- `GET /api/photos/:id`
- `DELETE /api/photos/:id`
- `GET /api/stats/overview`
- `GET /api/stats/china`
- `GET /api/stats/world`
- `GET /api/map/china/lit-regions`
- `GET /api/map/world/lit-regions`

## 个人中心使用说明

1. 打开「我的」页，未登录时会看到登录、注册和 Demo 登录入口。
2. 注册新账号需要填写自定义账号名、昵称、手机号、短信验证码和密码，邮箱可以后续绑定。
3. 登录支持账号名/手机号/邮箱 + 密码，也支持手机号验证码登录。
4. 点击右上角编辑按钮可以修改账号名、昵称、邮箱、签名，也可以上传头像和绑定新手机号。
5. 点击「隐私设置」「地图主题」「点亮颜色」「照片显示模式」「通知偏好」可以修改设置，保存后写入数据库，刷新页面仍然保留。
6. 点击「登录与安全」可以修改密码或退出登录。
7. 点击「照片存储」可以查看照片数量、打卡数量和上传目录占用，并清除本地缓存。
8. 点击「导出我的数据」会下载 `travel-glow-export.json`。
9. 页面底部的「注销账号」需要输入密码和 `DELETE` 二次确认。

## GitHub 提交建议

提交前确认：

```bash
npm run prisma:seed
npm run dev
```

不要提交：

- `node_modules/`
- `.env`
- `prisma/dev.db`
- `server/uploads/` 里的用户上传图片

建议提交：

- `package.json`
- `.env.example`
- `README.md`
- `prisma/schema.prisma`
- `prisma/seed.js`
- `data/seed-data.js`
- `public/index.html`
- `server/` 源码
- `server/uploads/.gitkeep`

## 企业级打磨能力

本项目现在补充了更接近真实企业项目的基础能力：

- 请求限流：登录、注册、验证码、修改密码、注销账号、资料/设置写入都有基础限流。
- 统一错误格式：后端错误统一返回 `{ message, code, details }`，方便前端展示。
- 请求体验证：使用 `zod` 校验登录、注册、验证码、资料、设置、密码、注销账号等接口。
- 服务端会话：JWT 内包含 `sessionId`，退出登录会撤销服务端会话，旧 token 不能继续访问。
- 设备管理：登录与安全页可以查看最近登录设备，并支持退出其他设备。
- 审计日志：登录、注册、退出、修改资料、修改密码、修改设置等安全动作会写入 `AuditLog`。
- 健康检查：`GET /api/health` 可用于部署或本地 smoke test。
- 自动化检查：`npm run check` 会执行 Prisma 校验、JS 语法检查、后端 API 测试和 smoke test。

开发验证码说明：

- 本地开发默认使用 mock 短信，`POST /api/auth/sms/send` 会返回 `devCode`。
- 生产环境不要返回验证码。设置 `NODE_ENV=production` 后，除非显式 mock，否则接口不会返回 `devCode`。
- 将来接入真实短信服务商时，只需要替换 `server/sms.js` 中的发送逻辑。

常用质量命令：

```bash
npm run check
npm test
npm run check:syntax
npm run check:smoke
```
