# treasure-plugin-icons

插件图标静态资源发布站：收集仓库内**已发布插件**的 `public/icon.svg`（无则按 `manifest.icon` 兜底），提供稳定 URL 与元数据清单，供第三方加载展示插件图标。

## URL 约定

| 路径 | 说明 |
|------|------|
| `https://<host>/` | 图标墙页面（浏览 / 搜索 / 复制 URL / 复制 SVG 源码） |
| `https://<host>/icons/<plugin-code>.svg` | 图标稳定 URL（始终最新版，`plugin-code` 即插件目录名） |
| `https://<host>/icons.json` | 元数据清单（`generatedAt` / `count` / `icons[]`，含 `code/name/alias/version/url`） |

> 稳定 URL 不做版本化：URL 不变、内容随插件更新；服务端以 `max-age=3600` + `ETag` 协商保证部署后自动取新图。非 SVG 图标（`manifest.icon` 指向 png 等）保留原扩展名，如 `/icons/google-authenticator.png`。

## 本地开发

```bash
npm install
npm run collect     # 收集图标 → public/icons/ + public/icons.json（构建产物，不提交）
npm run dev         # collect + vite dev（5175）
npm run build       # collect + vite build + tsc server（产出 dist/ 与 dist-server/）
npm start           # 启动静态服务（默认 0.0.0.0:7860，STATIC_DIR 默认 dist）
```

环境变量：`PORT`（默认 7860）、`HOST`（默认 0.0.0.0）、`STATIC_DIR`（默认 dist）。

## Docker

```bash
# 构建上下文必须是仓库根（collect 脚本需读取兄弟插件目录）
docker build -f treasure-plugin-icons/Dockerfile -t treasure-plugin-icons .
docker run -p 7860:7860 treasure-plugin-icons
```

CI：`.github/workflows/icons-image.yml` 在插件图标/manifest 或图标墙代码变更时自动构建并推送 `ghcr.io/<owner>/treasure-plugin-icons`（分支推 `latest`+sha+分支名；tag 推送 `treasure-plugin-icons/v*` → 版本号）。

## ModelScope Space 部署

部署配置不属于本仓库代码，按以下步骤操作：

1. 新建 ModelScope **Space**，SDK 选 **Docker**（与 Hugging Face Space 同规范；入口以平台最新界面为准）；
2. 接入镜像二选一：
   - **A（推荐）**：Space 仓库内放置 `treasure-plugin-icons/Dockerfile` 等由平台构建；
   - **B**：Space 配置直接引用 GHCR 镜像 `ghcr.io/<owner>/treasure-plugin-icons:latest`（需 GitHub 包读取凭据时按平台指引配置）；
3. 端口：应用监听 `0.0.0.0:7860`，Space `app_port` 设为 `7860`；
4. **零环境变量**——纯静态项目，无需 Secrets/Variables；
5. 首次部署后验证：
   - `https://<space-domain>/` 图标墙可访问
   - `https://<space-domain>/icons/<code>.svg` 返回 `image/svg+xml`
   - `https://<space-domain>/icons.json` 返回元数据

## 验证

| 步骤 | 命令/操作 | 期望 |
|------|-----------|------|
| 收集 | `npm run collect` | `public/icons/` 文件数 = 判定通过的插件数；`icons.json` 字段完整 |
| 构建 | `npm run build` | `dist/` 含 `index.html` + `assets/` + `icons/*.svg` + `icons.json`；`dist-server/index.js` 产出 |
| 本地冒烟 | `npm start` 后 curl | 图标 200 `image/svg+xml`；`icons.json` 200 JSON；路径穿越 400 |
| 缓存头 | `curl -I` | `/icons/*` 带 `ETag` 且 `max-age=3600`；`/assets/*` 带 `immutable`；`/icons.json` 为 `no-cache` |
| 图标墙 | 浏览器 `http://localhost:7860/` | 网格展示、搜索过滤、复制 URL/SVG 正常 |