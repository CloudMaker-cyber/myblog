# MyBlog

多用户博客平台。第一版范围见 [PRD.md](PRD.md)，技术方案见 [TECH_DESIGN.md](TECH_DESIGN.md)，开发规范见 [AGENTS.md](AGENTS.md)。

接口清单见 [docs/API.md](docs/API.md)，开发进度见 [docs/PROGRESS.md](docs/PROGRESS.md)。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS v4（`client/`）
- 后端：Node.js + Express 5 + TypeScript（`server/`）
- 数据库：MySQL 8（库名 `myblog`）

## 目录结构

```
client/          前端
  src/           页面、组件与接口封装
  vite.config.ts 开发服务器；/api 请求代理到 3000 端口
server/          后端
  src/           服务代码（按业务模块分目录）
  sql/           建表与种子数据脚本
  .env           本机真实配置（不入库）
  .env.example   变量清单（可入库）
docs/            接口文档与开发进度
```

## 首次安装

前端和后端各装一次依赖。**在哪个目录装，就决定依赖装到哪个项目里**——所以下面每条命令都从仓库根目录出发，先 `cd` 进对应子目录。

### 1. 前端

```powershell
cd client
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals
```

正常输出结尾大致是：`added N packages, and audited N+4 packages in Xs`，没有 `npm error`。

### 2. 后端

```powershell
cd server
npm install express mysql2 zod dotenv helmet
npm install -D typescript tsx @types/node @types/express eslint @eslint/js typescript-eslint globals
```

### 3. 配置 `.env`

`server/.env` 已生成，`JWT_SECRET` 已随机填好，只剩一项需要你填：

```
DB_PASSWORD=你在 Workbench 里给 myblog_app 设置的密码
```

### 4. 建表

打开 MySQL Workbench 连本地实例，打开 `server/sql/001_init.sql`，点 ⚡ 执行。

预期：左侧 `myblog` 库下出现 5 张表——`users`、`categories`、`articles`、`tags`、`article_tags`。

## 日常启动

开**两个** PowerShell 窗口，各跑一条，都要保持开着：

```powershell
# 窗口 1：后端
cd server
npm run dev
```

```powershell
# 窗口 2：前端
cd client
npm run dev
```

后端正常输出：`[server] API 已启动：http://127.0.0.1:3000/api/health`
前端正常输出：`Local: http://localhost:5173/`

浏览器打开 <http://localhost:5173>，点页面上的「检测后端与数据库」，出现绿色 JSON 即表示前端、后端、数据库三层都通了。

## 常用命令

| 位置 | 命令 | 作用 |
|---|---|---|
| `client` | `npm run dev` | 启动前端开发服务器（5173） |
| `client` | `npm run build` | 类型检查 + 打包 |
| `client` | `npm run lint` | ESLint 检查 |
| `server` | `npm run dev` | 启动后端（tsx 热重载） |
| `server` | `npm run typecheck` | 只做类型检查 |
| `server` | `npm run build` | 编译到 `dist/` |
| `server` | `npm start` | 运行编译后的代码 |
| `server` | `npm run seed:demo` | 生成演示账号与文章（可重复执行，已存在会跳过） |
| `server` | `npm run seed:admin -- 用户名 邮箱 密码` | 创建或提权管理员账号 |
| `server` | `npm run db:probe` | 检测目标数据库兼容性（外键、ENUM、排序规则等），读 `.env.tidb` |
| `server` | `npm run db:init` | 在目标数据库建库并执行 `sql/` 迁移，读 `.env.tidb` |

## 常见报错

| 报错 | 原因与处理 |
|---|---|
| `EADDRINUSE :::3000` | 3000 端口被占用。看是旧的后端进程没关，还是别的程序占了 |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL 服务没启动。Win+R 输入 `services.msc`，找 `MySQL80` 确认是"正在运行" |
| `Access denied for user 'myblog_app'@'localhost'` | `.env` 里的 `DB_PASSWORD` 与数据库账号密码不一致 |
| `Unknown database 'myblog'` | 库还没建，或 `.env` 的 `DB_NAME` 写错了 |
| 前端报 `接口返回 HTTP 500` | 后端起来了但连库失败，看后端那个窗口的 `[error]` 输出 |

## 安全约定

- `.env` 只存在于本机，已在 `.gitignore` 中排除。
- 数据库账号 `myblog_app` 只授权 `myblog` 一个库，不是 root。
- 密码只存 bcrypt 哈希，任何日志、接口、错误信息都不得出现明文密码。
