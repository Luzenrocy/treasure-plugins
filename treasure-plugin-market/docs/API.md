# Treasure Plugin Market · API 文档

服务地址：`http://127.0.0.1:8787`（生产环境替换为部署域名）。所有接口经 `/api` 前缀暴露（服务入口 `index.ts` 剥离前缀后进入业务路由）。

统一响应包装：

```json
{ "code": 0, "message": "success", "data": { } }
```

失败响应：`code` 为 `"REQUEST_FAILED"`，`data` 为 `null`，`message` 为可读原因（HTTP 状态码 400/401/403/404/500 等）。

---

## 一、公开查询接口（无需任何认证）

> 只返回 `status='published'` 且未逻辑删除（`deleted_at is null`）的数据。
> 待审核、已下线、已删除的插件/版本不会出现在公开接口中。

### 1.1 插件列表

```
GET /api/plugins
```

返回全部已发布插件（按名称排序）。

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "plugin_code": "text-diff",
        "alias": "Text Diff",
        "description": "文本差异对比工具",
        "author": "Luzenrocy",
        "categories": [],
        "permissions": []
      }
    ]
  }
}
```

```bash
curl 'http://127.0.0.1:8787/api/plugins'
```

### 1.2 插件详情

```
GET /api/plugins/{pluginCode}
```

单个已发布插件元信息。插件不存在或未发布返回 `404 插件不存在`。

```bash
curl 'http://127.0.0.1:8787/api/plugins/text-diff'
```

### 1.3 插件已发布版本列表

```
GET /api/plugins/{pluginCode}/releases
```

该插件已发布且未删除的版本（按发布时间倒序）。

响应 `items[]` 字段：

| 字段 | 说明 |
|---|---|
| `version` | 语义化版本号 |
| `download_url` | 插件包下载地址（https）|
| `sha256` | 64 位十六进制校验和 |
| `size_bytes` | 包大小（字节）|
| `manifest_json` | 清单对象 `{ name, version, ... }` |
| `min_platform_version` | 最低平台版本（可空）|
| `changelog` | 变更说明（可空）|
| `published_at` | 发布时间（ISO 8601）|

无已发布版本时返回空数组：

```json
{ "code": 0, "message": "success", "data": { "items": [] } }
```

```bash
curl 'http://127.0.0.1:8787/api/plugins/text-diff/releases'
```

---

## 二、开发者登记接口（需开发者 Token）

面向插件作者与 CI（GitHub Actions 等）：**提交插件包版本进入市场审核**。

```
POST /api/plugins/with-release
Authorization: Bearer <developer token>
Content-Type: application/json
```

- **认证**：`Authorization` 头携带开发者 Token（形如 `tpm_...`）。Token 在管理控制台右上角"重置 Token"获取，哈希存库、带有效期（默认 600 秒，可经安全设置调整）。
- **行为**：插件不存在 → 创建插件并登记首个版本；插件已存在（未删除）→ 追加版本。登记结果均为 `status=pending_review`，进入管理台"待办中心"审核，通过后市场公开可见。
- **字段约束**：`pluginCode` 匹配 `^[a-z][a-z0-9-]*$`；`version` 匹配 `^\d+\.\d+\.\d+$`；`downloadUrl` 必须 `https://` 开头；`sha256` 为 64 位十六进制；`sizeBytes` > 0。

请求体：

```json
{
  "plugin": {
    "pluginCode": "text-diff",
    "alias": "Text Diff",
    "description": "文本差异对比工具",
    "author": "Luzenrocy",
    "categories": [],
    "permissions": []
  },
  "release": {
    "version": "1.0.0",
    "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/text-diff/v1.0.0/text-diff.zip",
    "sha256": "049fb3aec026e1c9e73eeaf2836ba9cfd1da6617cf80023a6bfd8dc1a3cbcb13",
    "sizeBytes": 395093,
    "manifest": { "name": "text-diff", "version": "1.0.0" },
    "minPlatformVersion": null,
    "changelog": null
  }
}
```

成功响应（`201`）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "plugin": { "id": "...", "plugin_code": "text-diff", "status": "pending_review", "...": "..." },
    "release": { "id": "...", "version": "1.0.0", "status": "pending_review", "...": "..." }
  }
}
```

```bash
curl -X POST 'http://127.0.0.1:8787/api/plugins/with-release' \
  -H 'Authorization: Bearer tpm_xxxxxxxx' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "text-diff", "alias": "Text Diff", "description": "文本差异对比工具", "author": "Luzenrocy" }, "release": { "version": "1.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/text-diff/v1.0.0/text-diff.zip", "sha256": "049fb3aec026e1c9e73eeaf2836ba9cfd1da6617cf80023a6bfd8dc1a3cbcb13", "sizeBytes": 395093, "manifest": { "name": "text-diff", "version": "1.0.0" } } }'
```

错误场景：

| HTTP | 场景 |
|---|---|
| 401 | Token 无效/已过期/已撤销 |
| 400 | 缺少 `pluginCode` 或字段校验失败 |
| 500 | 同插件同版本重复提交（唯一约束）等服务错误 |

> 提示：同（插件, 版本）在版本被下线/删除前不可重复提交；重复提交请换用新版本号。

---

## 三、管理接口概览（内部角色认证）

管理接口均要求 Bearer 登录 JWT（`POST /api/admin/login` 获取），并按角色鉴权；**用户已开启 MFA 时**，敏感操作会要求先完成验证码（令牌升级 `aal2`）。

角色：`admin`（管理员）/ `operator`（运营）/ `user`（用户）。

| 接口 | 方法 | 最低角色 | 说明 |
|---|---|---|---|
| `/api/admin/login` | POST | 公开 | 登录（MFA 已开启则返回 `mfaRequired`）|
| `/api/admin/mfa/verify` | POST | 登录 | 提交验证码，令牌升级 aal2 |
| `/api/admin/dashboard` | GET | user | 概览统计 |
| `/api/admin/todos` | GET | admin | 待办中心（待审核插件/版本）|
| `/api/admin/todos/releases/{id}/review` | POST | admin | 版本审核（approve/reject）|
| `/api/admin/users` | GET/POST | admin | 用户列表/新增 |
| `/api/admin/users/{id}` | PATCH/DELETE | admin | 用户停用/启用、MFA、删除 |
| `/api/admin/users/{id}/reset-password` | POST | admin | 重置用户密码 |
| `/api/admin/users/{id}/reset-token` | POST | user（仅自己；admin 任意）| 重置开发者 Token |
| `/api/admin/plugins` | GET | user | 插件列表（含 `createdBy`）|
| `/api/admin/plugins/with-release` | POST | user（operator 除外）| 控制台登记插件 |
| `/api/admin/plugins/{code}/releases` | GET | user | 版本列表 |
| `/api/admin/plugins/{code}/releases` | POST | user（own）/ admin | 新增版本 |
| `/api/admin/plugins/{code}/review` | POST | admin | 插件审核（approve/reject/restore）|
| `/api/admin/plugins/{code}/disable` | POST | user（own）/ admin | 插件下线 |
| `/api/admin/plugins/{code}` | DELETE | user（own）/ admin | 插件删除（须先下线）|
| `/api/admin/releases/{id}/revoke` | POST | user（own）/ admin | 版本下线 |
| `/api/admin/releases/{id}` | DELETE | user（own）/ admin | 版本删除（须先下线）|
| `/api/admin/settings` | GET | user | 本人安全设置 |
| `/api/admin/settings` | PUT | admin | 全局 Token 有效期 |
| `/api/admin/me/password` | POST | user | 修改本人密码 |
| `/api/admin/mfa/enroll` | POST | user（target=自己；admin 任意）| 生成绑定二维码物料 |
| `/api/admin/mfa/verify-bind` | POST | user（target=自己；admin 任意）| 绑定确认（校验验证码并启用）|
| `/api/admin/mfa/disable` | POST | user | 关闭本人 MFA（清空绑定）|
| `/api/admin/audits` | GET | admin | 审计日志 |

> 说明：
> - `user（own）`：仅当目标插件 `created_by` 为当前用户时可操作，否则 403；
> - `operator`：拥有概览与插件管理只读页，无任何写按钮/写权限（后端一并拦截）；
> - 审核（通过/驳回）统一收敛在"待办中心"，仅 admin 可操作；
> - 插件删除/版本删除遵循"先下线、再删除"的状态机。
