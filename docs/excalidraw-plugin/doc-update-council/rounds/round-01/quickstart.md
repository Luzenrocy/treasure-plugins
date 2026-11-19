# Quickstart：Treasure Excalidraw 插件验证

## 前置条件

- Node.js 20+、npm、Treasure 宿主和本仓库可用。
- 已能访问本地 `/Volumes/MacExtend/FrontProjects/treasure-sdk` SDK 工作区或经验证的 npm 包。
- 已在实现分支按宪章先执行 `npx treasure-sdk create excalidraw`，并在该目录安装锁定的依赖。
- 能启动 Treasure 桌面宿主，或在 Treasure 源码目录执行 `npm run tauri -- dev`。

## 自动化检查

在 `excalidraw/` 执行：

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run build:plugin
npm run build:plugin:zip
```

自动化应覆盖：

1. 目录授权状态机、`Array.isArray` 类型收窄、settings/permissions 恢复和 Result<T> 错误映射；
2. `.excalidraw` 加载/序列化、BinaryFiles、空场景和 32 MiB 边界；
3. 显式保存、重复文件名、哈希冲突、`CONFLICT`、取消和权限撤销；
4. `.excalidrawlib` 校验、storage 写入/索引回滚、重复安装、旧版保留和离线读取；
5. PNG/SVG 全画布/选区、透明背景、图片缺失、保存窗口取消和超限；
6. React root mount/unmount、Vue 状态 callback、键盘/ARIA 契约和唯一主要滚动区。

## Treasure 宿主手工验证（用户执行）

以下步骤由用户在 Treasure 宿主中手工执行，不属于 `tasks.md` 的代理实施任务。用户完成后可将版本、宿主、系统、错误码和截图写入 `excalidraw/docs/host-validation.md`，代理只维护自动化检查和该证据文件的链接。

1. 运行 `npm run dev`，在 Treasure 插件中心注册开发地址；确认 `manifest.name` 与入口 meta 的 kebab-case 编码一致。
2. 首次选择一个目录，确认 settings 只保存授权摘要；重启插件后 `verifyDirectoryGrant` 成功并列出目录中的 `.excalidraw`，其他扩展名不显示。
3. 新建文件、插入基本图形和文字、撤销/重做、缩放/平移，显式保存后关闭并重新打开；保存取消、目录权限撤销或解析失败时确认内存场景仍可恢复。
4. 在目录外部修改同名文件后保存，确认出现覆盖/另存/取消选择；模拟 SDK `CONFLICT`、过期引用和 `FILE_TOO_LARGE`，确认不静默丢失脏场景。
5. 从官方素材库（`libraries.excalidraw.com`）触发一次 `.excalidrawlib` 安装，确认 hash/回跳处理、来源和格式校验；若 iframe/CORS 阻断回跳，使用系统文件选择回退导入同一素材；重启并断网后仍能从私有素材库插入；损坏或网络失败保留上一有效版本。确认页面没有协作、账户、分享、云端同步或 Excalidraw+ 入口。
6. 分别导出 PNG、SVG 的全画布和选区，验证透明背景开关、图片资源、保存窗口取消、目标覆盖确认和写入失败；导出失败不改变画布脏状态。
7. 执行 `npm run build:plugin` 和 `npm run build:plugin:zip`，分别导入目录包和 ZIP，验证安装、重启、升级、卸载、私有 storage 清理和错误提示。

## 证据记录

每个场景记录插件版本、宿主版本、系统、窗口尺寸、输入文件/素材、操作结果、SDK 错误码和必要截图。自动化日志与宿主手工证据分开保存；任何实现探针发现的 Excalidraw 0.18.1 类型差异要记录在实现变更和任务验收中。

### 导出字体风险记录

导出验收至少包含中文文字、嵌入图片和窄窗口。若导出文字与画布预览度量不同，记录 Excalidraw 锁定版本、字体资源路径、宿主 WebView 和截图，不以静默降级或浏览器下载替代 SDK 导出。
