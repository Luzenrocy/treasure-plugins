# Treasure Plugin Market

单一 Node 应用的插件市场管理台。**无前后端划分、无独立后端服务、无 Nginx**：一个 Node 进程同时托管页面、提供 `/api` 接口、通过 Supabase REST（PostgREST）访问数据库。Vue 构建产物作为静态资源由同一个 Node 进程输出，无需部署第二套服务。

## 文档导航

- [API 文档（公开查询 / 开发者登记 / 管理接口）](docs/API.md)
- [开发者研发指南（开发/架构/权限/接入）](docs/DEVELOPER.md)

## 功能特性

- **插件市场管理**：插件登记、版本管理、待办审核（通过/驳回）、下线/恢复/删除（先下线再删除状态机）、公开市场查询。
- **角色化权限**：`admin`（管理员）/ `operator`（运营只读）/ `user`（用户：登记 + 自有插件管理 + 安全设置）；插件写操作按 `created_by` 归属判定，后端兜底。
- **统一安全**：PBKDF2 密码、HMAC JWT（无状态）、TOTP MFA（开启时验证、关闭时不验证）、开发者 Token（哈希+有效期）、审计日志。
- **开发者接入**：`POST /api/plugins/with-release` 供 CI（GitHub Actions）自动登记插件，进入待审后管理员发布。
- **逻辑删除**：插件/版本/用户采用 `deleted_at` 逻辑删除 + 部分唯一索引，删除后可重建同名/同版本，同时保留审计与归属引用。

## 架构

```
Node 进程（一个容器 / 一个进程）
├── /        Vue 构建产物（dist/）
├── /api     业务处理器（handler.ts）
└── db       @supabase/supabase-js（src/supabase.ts）
              ├── REST /rest/v1（单表 CRUD）
 └── REST /rest/v1（单表 CRUD，业务逻辑全部在 TS 层）
                     │
                     ▼
              Supabase PostgREST / PostgreSQL
```

页面与接口同源（`VITE_API_BASE_URL=/api`），无 CORS。
凭证、JWT/MFA 密钥与 Supabase 访问密钥只存在于服务端环境变量，不进入前端 bundle。
认证/安全逻辑（PBKDF2、HMAC-SHA256 JWT、TOTP、AES-GCM）位于 `security.ts`。
数据库访问集中在`src/db/`，使用`@supabase/supabase-js` 纯 REST（单表 CRUD），业务逻辑（登录归一化、最新版本、两步写入+补偿）全部在 TS 层实现，环境变量为`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`（仅服务端读取）。
数据库 schema 在`migrations/202610010001_plugin_market_full.sql`（含种子管理员与权限 grant），直接对目标 PostgreSQL 执行（幂等，可重复执行）。

## 源码结构（全部在 `src/`）

```
src/
├── index.ts         Node 入口：托管页面 + /api
├── handler.ts       业务路由（登录、MFA、插件、用户、审计）
├── security.ts      认证/加密：PBKDF2 / JWT / TOTP / AES-GCM
├── supabase.ts      supabase-js 客户端（读 VITE_SUPABASE_*）
├── db/              数据库访问层（按功能分文件）
│ ├── users.ts 用户（REST，登录归一化在 TS）
│   ├── settings.ts          用户设置 / MFA（REST upsert）
│ ├── plugins.ts 插件与版本（REST + TS 两步写入补偿）
│   ├── developer-tokens.ts  开发者 token（REST）
│   ├── audit-logs.ts        审计日志（REST）
│   └── dashboard.ts         管理台统计（REST count）
├── main.ts           Vue 前端入口
├── App.vue
├── components/       前端组件
├── router/           前端路由
├── services/         API 客户端
├── stores/           Pinia
└── views/            前端页面
```

数据库 DDL 在根目录`migrations/`。`src/db/`是唯一访问数据的地方，业务路由`handler.ts`只调用它们，不直接碰数据库。

## 本地开发

```bash
npm install
cp .env.example .env   # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 与密钥

# A：Node 应用（页面 + API + 数据库，端口 8787）
npm run dev:api
# B：Vite 热更新（/api 代理到 8787）
npm run dev
```

## 构建与运行

```bash
npm run build          # vite build + tsc Node 代码
npm start              # node dist-node/index.js（单进程：页面 + API + 数据库）
```

Docker：

```bash
docker build -t treasure-plugin-market .
docker run -p 8787:8787 \
  -e VITE_SUPABASE_URL=https://<ref>.supabase.co \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=<anon key> \
  -e AUTH_JWT_SECRET=<随机 32+ 字符> \
  treasure-plugin-market
```

容器内只有一个 Node 进程，仅暴露 8787 端口（镜像内已设 `HOST=0.0.0.0`，可被容器/平台反向代理访问）。

> 运行时必需环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`（服务端 `supabase.ts` 以 `process.env` 读取）、`AUTH_JWT_SECRET`（JWT 签名）。这三个在部署平台注入即可生效，**无需重新构建**。
> `VITE_API_BASE_URL` 是构建期变量，默认 `/api`（同源部署无需设置）。

### Hugging Face Space 部署

1. 新建 **Docker Space**，关联本仓库（或上传 Dockerfile + `src` + `package*.json`）；
2. 打开 Space 的 **Settings → Variables and secrets**，添加以下 **Secrets**（运行时注入容器）：

   | Secret 名称 | 值 |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<你的项目>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase 项目 anon key |
   | `AUTH_JWT_SECRET` | 任意随机长字符串（≥32 字符）|

   > 这两个 `VITE_` 参数是**服务端运行时读取**（`process.env`，非构建期），以 Secrets 注入即可生效，改值无需重建 Space。
3. 端口：Dockerfile `EXPOSE 8787`，Hugging Face 会自动读取该端口并把 `PORT` 环境变量设为 `8787`（应用监听 `0.0.0.0:8787`），无需其它配置；
4. 首次启动后，管理员账号为迁移脚本种子 `treasure / 123456`，**请立即在"安全设置"修改密码**；
5. 若后续前端需要构建期变量（如 `VITE_API_BASE_URL` 自定义域名），请在 HF Space 的 **Variables**（构建期变量）中设置并重启构建。

## 认证设计（统一基于用户表）

所有登录认证与授权都只读取 `users` 表（MFA/TTL 存 `user_settings` 表），无其它认证来源、无独立会话表：

1. `POST /admin/login`：`users.byLogin()` 归一化后 REST 查用户（大小写不敏感在 TS 层处理）→`verifyPassword()`（PBKDF2 210k 迭代）→校验`status='active'`
2. MFA 启用者需再走 `/admin/mfa/verify`（TOTP 验证码），令牌升级为 `aal2`
3. 令牌是 HMAC-SHA256 JWT（无状态，`AUTH_JWT_SECRET` 签名，TTL 10 分钟，可经 `user_settings.token_ttl_seconds` 调整）
4. 每个请求由 `handler.ts` 的 `currentUser()` 统一验签、查用户、校验角色与 AAL 等级

### 角色权限摘要

| 能力 | admin | operator | user |
|---|---|---|---|
| 概览 | ✅ | ✅ 只读 | ✅ 只读 |
| 待办中心 / 用户管理 / 审计日志 | ✅ | — | — |
| 插件管理 | ✅ 全部操作 | ✅ 只读（无按钮）| ✅ 查看 + 登记；**仅自有插件可操作** |
| 安全设置 | ✅ MFA + 全局 Token 有效期 + 修改密码 | — | ✅ 本人 MFA + 修改密码 |
| 审核（通过/驳回）| ✅（待办中心）| — | — |
| 重置 Token | ✅ | ✅ 自己 | ✅ 自己 |

插件写操作规则：`admin` 任意；`operator` 一律拒绝；`user` 仅当插件 `created_by` 为本人。审核仅 admin（待办中心）。详见 `docs/DEVELOPER.md`。

## 测试

```bash
npm test            # node --test 单元测试（纯函数：登录归一化/最新版本/审核状态机/角色权限）
npm run typecheck:node
```

## 安全边界

- 公开数据只返回未逻辑删除的 published 插件和 release。
- token 只保存 hash 并具有有效期；密码使用 PBKDF2 哈希，MFA TOTP。
- 管理员发布、下线、删除、token 重置等高风险操作要求 AAL2。
- Supabase 访问密钥仅存服务端环境变量，绝不进入前端 bundle。
