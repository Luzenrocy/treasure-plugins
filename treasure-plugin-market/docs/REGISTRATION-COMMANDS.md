# 已发布插件 · 开发者登记接口调用命令清单

> 本文档汇总当前仓库中**已通过 GitHub Actions `Release Plugin` 工作流发布**的插件及其版本，并为每一版本生成调用**开发者登记接口**（`POST /api/plugins/with-release`）的完整 `curl` 命令，供插件作者与 CI 直接复制使用。

## 一、发布清单（数据来源：发布 tag `plugin/**/v*`）

`Release Plugin` 工作流（`.github/workflows/plugins-release.yml`）由推送 `plugin/<目录>/v<版本>` 标签触发，为每个标签创建 GitHub Release，并附可安装插件包 `<目录>.zip`。以下为当前仓库已打出的发布标签：

| 插件目录 | plugin_code（包内冻结值） | 插件名称 | 已发布版本 | 发布标签 | 对应提交 |
|---|---|---|---|---|---|
| google-authenticator | `google-authenticator` | 谷歌验证器 | 1.0.0 | `plugin/google-authenticator/v1.0.0` | `bdc0d56` |
| json-formatter | `json--j9i283` | JSON 格式化 | 1.0.0 | `plugin/json-formatter/v1.0.0` | `2af1a76` |
| kao-cheng-ce | `kao-cheng-ce-nlsooz` | 考成策 | 1.0.0 / 2.0.0 / 2.0.1 | `plugin/kao-cheng-ce/v{1.0.0,2.0.0,2.0.1}` | `7ea06b4` / `32decba` / `2f590a1` |
| shi-yu-lu | `shi-yu-lu-2lglfy` | 石玉录 | 1.0.0 / 2.0.0 / 2.0.1 | `plugin/shi-yu-lu/v{1.0.0,2.0.0,2.0.1}` | `7ea06b4` / `174db30` / `2f590a1` |
| text-diff | `text-diff-vc0eva` | 文本对比 | 1.0.0 | `plugin/text-diff/v1.0.0` | `2af1a76` |

共 **5 个插件、9 个版本**。

## 二、登记接口速览

```
POST /api/plugins/with-release?token=<开发者 Token>
Content-Type: application/json
```

- **认证**：`?token=` 查询参数携带开发者 Token（形如 `tpm_...`），头通道一律不消费；本文档 Token 暂用 `XXXX` 代替。
- **行为**：插件不存在 → 创建插件并登记首个版本；插件已存在（未删除）→ 追加版本。登记结果均为 `status=pending_review`。
- **字段约束**：`pluginCode` 匹配 `^[a-z][a-z0-9-]*$`；`version` 匹配 `^\d+\.\d+\.\d+$`；`downloadUrl` 必须 `https://` 开头；`sha256` 为 64 位十六进制；`sizeBytes` > 0。
- **服务地址**：下面命令使用本地 `http://127.0.0.1:7860`（自建部署）；若部署在 ModelScope（`*.ms.show`），替换为部署域名并**必须**携带浏览器 User-Agent（否则网关返回 `10010101007`）。

## 三、登记命令列表（token=XXXX）

> `downloadUrl` 使用 GitHub Release 资产地址（`https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/<目录>/v<版本>/<目录>.zip`），与 `plugins-release.yml` 生成的资产路径一致。
>
> `sha256` / `sizeBytes` 需以实际 Release 资产计算后填写，见[第四节](#四字段填写说明)。

### 3.1 google-authenticator

```bash
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "google-authenticator", "alias": "谷歌验证器", "description": "离线加密的 TOTP 与 HOTP 验证码管理器，支持 Google Authenticator 转移二维码图片导入。", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "1.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/google-authenticator/v1.0.0/google-authenticator.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "google-authenticator", "version": "1.0.0" }, "minPlatformVersion": "2.1.2", "changelog": null } }'
```

### 3.2 json-formatter

```bash
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "json--j9i283", "alias": "JSON 格式化", "description": "用于本地 JSON 文本格式化、校验、压缩与转义", "author": "OpenAI", "categories": [], "permissions": [] }, "release": { "version": "1.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/json-formatter/v1.0.0/json-formatter.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "json--j9i283", "version": "1.0.0" }, "minPlatformVersion": "2.0.0", "changelog": null } }'
```

### 3.3 kao-cheng-ce

```bash
# 1.0.0
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "kao-cheng-ce-nlsooz", "alias": "考成策", "description": "任务与进度管理插件", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "1.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/kao-cheng-ce/v1.0.0/kao-cheng-ce.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "kao-cheng-ce-nlsooz", "version": "1.0.0" }, "minPlatformVersion": "2.0.0", "changelog": null } }'

# 2.0.0
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "kao-cheng-ce-nlsooz", "alias": "考成策", "description": "任务与进度管理插件", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "2.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/kao-cheng-ce/v2.0.0/kao-cheng-ce.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "kao-cheng-ce-nlsooz", "version": "2.0.0" }, "minPlatformVersion": "2.0.0", "changelog": null } }'

# 2.0.1
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "kao-cheng-ce-nlsooz", "alias": "考成策", "description": "任务与进度管理插件", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "2.0.1", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/kao-cheng-ce/v2.0.1/kao-cheng-ce.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "kao-cheng-ce-nlsooz", "version": "2.0.1" }, "minPlatformVersion": "2.0.0", "changelog": null } }'
```

### 3.4 shi-yu-lu

```bash
# 1.0.0
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "shi-yu-lu-2lglfy", "alias": "石玉录", "description": "Markdown 笔记编辑器", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "1.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/shi-yu-lu/v1.0.0/shi-yu-lu.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "shi-yu-lu-2lglfy", "version": "1.0.0" }, "minPlatformVersion": "2.1.0", "changelog": null } }'

# 2.0.0
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "shi-yu-lu-2lglfy", "alias": "石玉录", "description": "Markdown 笔记编辑器", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "2.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/shi-yu-lu/v2.0.0/shi-yu-lu.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "shi-yu-lu-2lglfy", "version": "2.0.0" }, "minPlatformVersion": "2.1.0", "changelog": null } }'

# 2.0.1
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "shi-yu-lu-2lglfy", "alias": "石玉录", "description": "Markdown 笔记编辑器", "author": "Treasure", "categories": [], "permissions": [] }, "release": { "version": "2.0.1", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/shi-yu-lu/v2.0.1/shi-yu-lu.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "shi-yu-lu-2lglfy", "version": "2.0.1" }, "minPlatformVersion": "2.1.0", "changelog": null } }'
```

### 3.5 text-diff

```bash
curl -X POST 'http://127.0.0.1:7860/api/plugins/with-release?token=XXXX' \
  -H 'Content-Type: application/json' \
  -d '{ "plugin": { "pluginCode": "text-diff-vc0eva", "alias": "文本对比", "description": "用于本地双栏文本差异比较与编辑", "author": "OpenAI", "categories": [], "permissions": [] }, "release": { "version": "1.0.0", "downloadUrl": "https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/text-diff/v1.0.0/text-diff.zip", "sha256": "<SHA256>", "sizeBytes": <SIZE_BYTES>, "manifest": { "name": "text-diff-vc0eva", "version": "1.0.0" }, "minPlatformVersion": "2.0.0", "changelog": null } }'
```

## 四、字段填写说明

1. **`<SHA256>` / `<SIZE_BYTES>`**：必须取自对应 GitHub Release 的实际插件包（`<目录>.zip`），示例：

   ```bash
   # 以 text-diff v1.0.0 为例（下载后计算）
   curl -sL 'https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/text-diff/v1.0.0/text-diff.zip' -o text-diff.zip
   shasum -a 256 text-diff.zip          # 64 位十六进制，填入 sha256
   stat -f '%z' text-diff.zip           # 字节数，填入 sizeBytes
   ```

   > 注意：本地 `build-output/` 中可能存在的 zip 是最近一次构建产物，与各发布 tag 的 CI 资产**不保证一致**，请勿直接套用。

2. **`pluginCode`**：必须与插件包内 `manifest.json` 的 `name`（冻结值）一致，否则宿主安装校验会报「manifest.name 与市场编码不一致」（`pluginMarketInstaller.ts:113`）。发布 tag 使用的目录名仅用于 Release 资产路径。

3. **`downloadUrl`**：与 `plugins-release.yml` 生成的资产路径一致：`https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/<目录>/v<版本>/<目录>.zip`。

## 五、注意事项

- **Token 有效期**：开发者 Token 默认 600 秒（可经安全设置调整），过期需在管理控制台重置后替换 `XXXX`；命令输出会包含 Token 查询参数，注意日志/历史记录脱敏。
- **重复提交**：同（插件, 版本）在版本被下线/删除前不可重复提交；需换新版本号。
- **ModelScope（`*.ms.show`）部署**：必须携带浏览器 User-Agent：

  ```bash
  curl -X POST 'https://<host>.ms.show/api/plugins/with-release?token=XXXX' \
    -H 'Content-Type: application/json' \
    -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' \
    -d '{ ...同上... }'
  ```

- **登记结果**：均为 `status=pending_review`，需管理员在管理台「待办中心」审核通过后才对公开市场可见。
