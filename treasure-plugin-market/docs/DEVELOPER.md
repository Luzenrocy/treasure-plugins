# Treasure Plugin Market · 开发者研发指南

面向维护者与插件开发者：如何跑起来、数据库如何设计、角色权限如何工作、如何接入登记插件。

## 一、技术栈与架构

- **单一 Node 进程**（无前后端分离）：`index.ts` 同时托管 Vue 构建产物（`dist/`）与 `/api` 业务接口。
- **数据访问**：`@supabase/supabase-js` 纯 REST（PostgREST 单表 CRUD），业务逻辑全部在 TS 层（`src/db/`），不建 RPC、不依赖 Supabase Auth。
- **前端**：Vue 3 + Element Plus + Pinia，构建产物由同一 Node 进程输出（`VITE_API_BASE_URL=/api`，同源无 CORS）。

```
Node 进程
├── /      dist/（Vue 构建产物）
├── /api   handler.ts 业务路由
└── src/db supabase-js REST ──► Supabase PostgREST / PostgreSQL
```

## 二、本地开发

```bash
npm install
cp .env.example .env    # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / AUTH_JWT_SECRET（均为运行时读取）
```

| 命令 | 说明 |
|---|---|
| `npm run dev:api` | Node API 服务（端口 7860，含静态页）|
| `npm run dev` | Vite 热更新（`/api` 代理到 7860）|
| `npm run build` | `vite build` + `tsc` Node 编译 |
| `npm start` | 运行 `dist-node/index.js`（单进程）|
| `npm test` | `node --test` 单元测试（`test/*.test.ts`）|
| `npm run typecheck:node` | Node 侧类型检查 |

## 三、数据库

### 初始化 / 重置

```sql
-- 在 Supabase SQL Editor 整体执行（可重复执行；会 DROP 并重建全部表，数据清空）
-- 文件：migrations/202610010001_plugin_market_full.sql
```

脚本会重建：`users`、`user_settings`、`plugins`、`plugin_releases`、`developer_tokens`、`audit_logs` + 索引 + `set_updated_at` 触发器 + 初始管理员（`treasure / 123456`）。

### 设计要点（维护者必读）

1. **逻辑删除**：插件/版本/用户删除为 `deleted_at` 标记（保留行以维持审计与归属引用）。
2. **部分唯一索引**：唯一性只约束未删除记录（`where deleted_at is null`）——插件/版本删除后可重新登记同名编码/同版本：
   ```sql
   create unique index plugins_active_code_idx on plugins(plugin_code) where deleted_at is null;
   create unique index plugin_releases_active_version_idx on plugin_releases(plugin_id, version) where deleted_at is null;
   ```
3. **RLS 关闭**：表重建后默认关闭；应用以 anon key 全权读写（`grant` 已授）。
4. **触发器注意**：`set_updated_at` 触发器仅挂在含 `updated_at` 列的表上。`developer_tokens` 无 `updated_at` 列，**不要**给它挂该触发器（否则 update 报 `record "new" has no field "updated_at"`；迁移已显式 drop）。
5. **种子管理员**：`on conflict (username) do nothing` 幂等；密码为 PBKDF2-SHA256(210000) 哈希。

## 四、认证与权限模型

- **登录**：`users.byLogin`（归一化）→ `verifyPassword`（PBKDF2）→ 签发 HMAC-SHA256 JWT（`aal1`，TTL 由 `user_settings.token_ttl_seconds` 控制，默认 600s）。
- **MFA**：开启（扫码绑定，验证码确认后才启用）后登录需走 `/admin/mfa/verify` 升级 `aal2`。策略统一为：**开启时验证、关闭时不验证**（`needsMfaVerification`）。
- **开发者 Token**：`tpm_...`，哈希存 `developer_tokens`，带有效期；用于登记接口与 CI。
- **角色**（`users.role`）：`admin` > `operator` > `user`。鉴权纯函数见 `src/db/query-utils.ts`（`roleAtLeast` / `canManagePlugin`），测试在 `test/query-utils.test.ts`。

### 角色-能力矩阵

| 能力 | admin | operator | user |
|---|---|---|---|
| 概览 | ✅ | ✅ 只读 | ✅ 只读 |
| 待办中心 / 用户管理 / 审计 | ✅ | — | — |
| 插件管理 | ✅ 全部操作 | ✅ 只读（无按钮）| ✅ 查看；登记按钮；**仅自有插件可操作** |
| 安全设置 | ✅ MFA + 全局 Token 有效期 + 修改密码 | — | ✅ 本人 MFA + 修改密码 |
| 审核（通过/驳回）| ✅（待办中心）| — | — |
| 重置 Token | ✅ | ✅ 自己 | ✅ 自己 |

- **user 插件写权限**：目标插件 `created_by` == 本人（后端 `assertPluginWrite` 兜底，前端按 `canOperate` 隐藏按钮）。
- **operator**：无任何写权限（后端对写接口一律 403）。
- **状态机**：插件/版本删除前必须先下线（published → disabled / revoked → 才可删除）。

## 五、代码导航（维护者）

| 文件 | 职责 |
|---|---|
| `src/index.ts` | HTTP 入口：静态托管 + `/api` 剥离前缀转发 `handle()` |
| `src/handler.ts` | 业务路由 + `currentUser` 角色/MFA 鉴权 + 错误透传 |
| `src/security.ts` | PBKDF2 / JWT / TOTP / AES-GCM / 绑定物料 |
| `src/supabase.ts` | supabase-js 客户端（含网络异常重试包装）|
| `src/db/query-utils.ts` | 纯逻辑：登录归一化、最新版本、审核状态机、角色判定、请求体解析 |
| `src/db/*.ts` | 各资源数据访问（唯一碰数据库的地方）|
| `test/*.test.ts` | 纯函数单元测试（TDD 先行）|

约定：
- 数据库只做单表 CRUD；跨表/业务规则（最新版本、两步写入+补偿、状态流转）全部在 TS。
- 不在 REST 层对嵌入表列排序（PostgREST 会报 PGRST100），嵌入排序在业务层做。
- 新增接口先写测试（红灯）→ 实现（绿灯）→ 端到端验证。

## 六、插件开发者接入（CI 自动化）

登记接口：`POST /api/plugins/with-release`（详见 `docs/API.md` 第二节）。

**GitHub Actions 工作流思路**：

```yaml
# .github/workflows/release-plugin.yml（片段）
on:
  push:
    tags: ['plugin/*/v*']
jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - name: 获取 release 资产信息
        run: |
          curl -s https://api.github.com/repos/OWNER/REPO/releases/tags/${{ github.ref_name }} > release.json
          # 从 assets 取 name / browser_download_url / digest(sha256) / size
      - name: 调用市场登记接口
        env:
          MARKET_TOKEN: ${{ secrets.MARKET_TOKEN }}
        run: |
          curl -X POST "https://<market-host>/api/plugins/with-release?token=$MARKET_TOKEN" \
            -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
            -H "Content-Type: application/json" \
            -d "$(jq -c '{plugin:{...},release:{...}}' release.json)"
```

要点：
- Token 存 GitHub Secrets，勿提交仓库；
- 插件编码/版本/下载 URL/SHA-256 必须与 release 资产一致；
- 登记后状态为待审核，需管理员在"待办中心"通过后市场可见；
- 同（插件, 版本）不可重复提交（换版本号即可）；
- **认证只走 `?token=` 查询参数单通道**：任何头通道（`Authorization`/`X-Access-Token`）与旧 `?access_token=` 参数后端一律不读；ModelScope（`*.ms.show`）等托管平台网关拦截/注入鉴权头对本接口无影响。
- **ModelScope（`*.ms.show`）必须携带浏览器 UA**（示例中 `-A ...Mozilla/5.0...`）：该平台网关按 User-Agent 判定，curl 默认 UA 的请求返回 `{"Code":10010101007,...}`（"当前接口不支持通过SDK Token直接访问"）且到不了应用；自建部署（非 ms.show）可去掉 `-A`。
- 若登记时报 `10010101007`，先确认是否加上了浏览器 UA 且 Token 未过期（`?token=` 在 URL 中）。

## 七、常见问题

| 问题 | 处理 |
|---|---|
| 登录报"没有管理员权限" | 角色门槛未满足：确认该账号角色（admin/operator/user）与目标接口要求 |
| MFA 开启后敏感操作报"该操作必须完成 MFA 验证" | 属预期：先完成验证码（前端会自动弹出并重放请求）|
| 删除插件/版本被拒 | 需先下线（先下线、再删除状态机）|
| 重新登记同名插件报唯一约束冲突 | 旧记录须已逻辑删除；部分唯一索引已保证删除后可重建 |
| `record "new" has no field "updated_at"` | `developer_tokens` 不应挂 `set_updated_at` 触发器（迁移已处理）|
| 重置 Token 报瞬时 `fetch failed` | 已内置网络重试；频繁出现请检查到 Supabase 的链路 |

## 八、相关文档

- `docs/API.md` —— 全部接口（公开查询 / 开发者登记 / 管理接口概览）
- `migrations/202610010001_plugin_market_full.sql` —— 全量数据库初始化（可重复执行）
