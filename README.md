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
email: 321167759@qq.com
password: 123456
```

前端会自动用这个账号登录，并把 JWT token 存到 `localStorage`。

## 主要功能

- 用户注册、登录、自动登录
- 用户资料读取和修改
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
- `GET /api/user/profile`
- `PUT /api/user/profile`
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
