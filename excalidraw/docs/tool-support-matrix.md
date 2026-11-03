# Excalidraw 工具支持矩阵

**版本依据**：`@excalidraw/excalidraw@0.18.1`，插件 manifest `minPlatformVersion=2.3.0`。

| 工具/能力 | 状态 | 用户入口或降级 | 验收依据 |
| --- | --- | --- | --- |
| 基本图形、文字、图片 | 支持 | Excalidraw 画布工具栏 | `ExcalidrawCanvas.vue`、React 适配器测试 |
| 撤销/重做、缩放/平移 | 支持 | Excalidraw 原生工具栏 | US4 验收路径 |
| `.excalidraw` 读取和保存 | 支持 | 绘图目录面板与 Treasure 文件引用 | `drawing-file-service.test.ts` |
| 思维导图导入 | 支持 | File 菜单“导入思维导图”；支持现代 XMind (`content.json`)、旧版 XMind (`content.xml`) 及 simple-mind-map `.smm` / JSON，并转为可编辑节点和连线 | `mind-map-import-service.test.ts` |
| PNG/SVG 全画布导出 | 支持 | 导出对话框；通过 `files.saveDialog` 写入 | `export-service.test.ts` |
| PNG/SVG 选区导出、透明背景 | 支持 | 导出对话框选择范围和背景 | `export.contract.test.ts`、导出服务测试 |
| 官方素材目录 | 支持 | 读取唯一 `libraries.json`，查询/筛选/排序/分页在本地缓存完成 | `official-library-client.test.ts`、A1/A2 契约 |
| 官方 `.excalidrawlib` 直接安装 | 支持 | 选中记录后读取 `source` 并写入私有 storage | `library-service.test.ts`、US3 契约 |
| 本地素材库导入、离线恢复、删除 | 支持 | 素材库面板和私有 storage | `library-panel.test.ts`、服务测试 |
| File 全局菜单保存/导出 | 支持 | 通过 SDK/宿主公开菜单 capability 注册、更新和类型化订阅；页面内入口仍保留 | T012–T020、T027、T066、T070 |
| 系统文件选择、宿主权限和插件导入 | 需人工验证 | 按 `quickstart.md` 在 Treasure 宿主执行 | `docs/host-validation.md` |
| 协作、账户、分享、云端同步、JPEG/WebP、剪贴板 | 不支持 | 不显示入口 | 范围审查 T065 |

插件菜单只通过 SDK 公共 API 交互，不通过内部 `treasure-menu-event` 或裸 `postMessage` 绕过 SDK。
