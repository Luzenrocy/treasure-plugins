# Implementation Plan: Treasure Excalidraw 绘图插件

**Branch**: `004-excalidraw-plugin` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/Volumes/MacExtend/FrontProjects/treasure-plugins/specs/004-excalidraw-plugin/spec.md`

## Summary

本计划把已确认的 Treasure Excalidraw 插件规格落成一个独立的 `excalidraw-plugin/` Vue 插件。插件由 Vue 外壳承载界面和状态，由一个小型 React 挂载适配层承载官方 `@excalidraw/excalidraw@0.18.1` 编辑器；目录、文件、设置、权限、私有素材存储和导出目标全部通过 `treasure-sdk` 2.1.1 的引用与 `Result<T>` 接口处理。绘图文件只保存为 `.excalidraw`，素材库数据验证为 `.excalidrawlib` 后写入插件私有 storage；PNG/SVG 导出使用官方导出工具并通过一次性保存引用写入用户选定位置。

设计重点是把 React 生命周期、Excalidraw 场景序列化、Treasure 文件边界和 Vue 状态反馈隔离开。显式保存通过打开时的字节哈希和保存前的再次读取提供最佳努力的外部修改检测；SDK 返回的 `CONFLICT`、取消、权限、过期引用和 32 MiB 超限都转换成可恢复的 UI 状态。计划不引入数据库或绝对路径，不扩展实时协作、账户、分享和云端同步。

## Technical Context

**Language/Version**: TypeScript 5.6、Vue 3.5、React 19.0、Node.js 20+（版本以仓库当前 Vite 工具链和 Treasure 宿主要求为准）

**Primary Dependencies**: `treasure-sdk` `^2.1.1`、`vue` `^3.5.13`、Element Plus `^2.11.9`、Vite 6、Vitest 2、`@excalidraw/excalidraw` `0.18.1`（精确锁定）、`react`/`react-dom` `19.0.0`；React 通过 `React.createElement` 挂载，首版不增加 `@vitejs/plugin-react`

**Storage**: 用户配置的 `DirectoryReference` 中的 `.excalidraw` 文件；`settings` 保存目录授权摘要；`storage` 保存已验证的 `.excalidrawlib` 字节和相对键索引；不使用数据库，不持久化绝对路径、子文件引用或导出目标引用

**Testing**: Vitest 领域与适配层测试、`vue-tsc --noEmit`、Vite 生产构建、`npm run build:plugin` 和 `npm run build:plugin:zip`；Treasure 开发注册、目录授权撤销、目录包/ZIP 导入、系统保存窗口和卸载由宿主手工验证

**Target Platform**: Treasure 桌面宿主中的 Vue iframe 页面，最低宿主版本 2.1.0；现代浏览器 WebView 支持 ESM、React 19 和 Excalidraw 0.18.1，画布容器提供非零宽高

**Project Type**: 独立桌面 Web 插件（Vue 页面 + React 子树 + Treasure SDK 适配服务）

**Performance Goals**: 遵循 Excalidraw 官方编辑器的交互模型，不新增未经测量的数值门槛；画布状态更新、文件保存和导出不得因为状态通知阻塞 Vue 主线程，超过 32 MiB 的场景/素材/导出在写入前立即给出可恢复错误

**Constraints**: SDK 是唯一宿主入口；所有 SDK 调用检查 `Result<T>`；单文件和私有 storage 读写上限 32 MiB，SDK 无流式读写和文件 mtime/stat；单一绘图目录、显式保存、冲突确认；`.excalidraw` 仅为绘图格式，`.excalidrawlib` 仅为素材导入格式；不使用远程 iframe、Tauri API、手写桥接消息或绝对路径；页面滚动边界、键盘焦点和图标无障碍名称遵循研发指南

**Scale/Scope**: 单用户、一个配置目录、目录内非递归 `.excalidraw` 文件列表和一个插件私有素材集合；覆盖 FR-001..FR-016、SC-001..SC-006；首版不包含协作、账户、云同步、分享、JPEG/WebP、剪贴板和倍率调整

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SDK-First Host Integration**: PASS WITH IMPLEMENTATION GATE — 计划要求先运行 `npx treasure-sdk create excalidraw-plugin` 生成 Vue/Vite/manifest/生命周期基线；运行时只引用公开 `treasure-sdk`，并以 `/Volumes/MacExtend/FrontProjects/treasure-sdk` 的 API、类型和桥接文档为准。React 子树是插件内部依赖，不替代宿主 SDK。
- **II. Explicit, Safe Data and Permission Boundaries**: PASS — 目录和文件只使用 SDK 返回的引用；settings 只保存授权摘要；私有素材使用相对 storage key；保存前检查大小、授权、引用有效性和冲突；不构造或持久化绝对路径，不拼接 SQL，也不绕过 32 MiB 限制。
- **III. Simple, Reusable, Maintainable Code**: PASS — Vue 外壳、React 生命周期适配、SDK 边界、场景/素材序列化和导出服务分别承担单一职责；增加 React 依赖是官方编辑器的必要依赖，未引入第二套画布或状态框架。
- **IV. Platform-Native, Accessible Vue Experience**: PASS — 页面使用 Vue、Element Plus、Vite 和宿主滚动边界；空、加载、保存、冲突、错误和导出状态有语义化提示；工具按钮、文件列表、素材入口和确认弹窗提供键盘操作与无障碍名称。
- **V. Evidence-Based Quality and Release Readiness**: PASS WITH MANUAL GATE — 自动化覆盖领域状态、序列化、错误映射、大小守卫和导出参数；类型检查与两种插件构建为发布门槛；Treasure 开发目录、目录授权、宿主重启、目录包/ZIP 导入和卸载证据必须手工记录。
- **VI. Chinese Project Documentation**: PASS — `plan.md`、`research.md`、`data-model.md`、`contracts/` 和 `quickstart.md` 使用简体中文；标准模板标题、API、命令、文件名和协议字段保留原文并在中文句子中说明。

## Project Structure

### Documentation (this feature)

```text
specs/004-excalidraw-plugin/
├── spec.md
├── plan.md                         # 本文件
├── research.md                     # Phase 0 决策与证据
├── data-model.md                   # Phase 1 实体、状态和限制
├── quickstart.md                   # Phase 1 自动化与宿主验证路径
├── contracts/
│   ├── treasure-sdk-boundary.md
│   ├── excalidraw-scene.md
│   ├── export.md
│   └── ui-lifecycle.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
excalidraw-plugin/                  # npx treasure-sdk create excalidraw-plugin 生成的独立插件
├── manifest.json                   # name、alias、入口、dir 设置、最低宿主版本 2.1.0
├── index.html                      # treasure-plugin-code 与入口页面
├── package.json                    # Vue/Vite/SDK/React/Excalidraw 依赖和脚本
├── vite.config.ts                  # Vue 插件、相对 base、宿主调试 manifest 端点
├── public/
│   └── excalidraw/fonts/           # 构建时从 Excalidraw 包复制的字体资源
├── scripts/
│   ├── build-plugin.mjs            # 目录包/ZIP 构建
│   └── copy-excalidraw-assets.mjs  # 复制版本锁定的字体资源
├── src/
│   ├── main.ts                     # initTreasure() 后挂载 Vue
│   ├── App.vue                     # 页面布局、文件列表、素材入口、导出入口
│   ├── components/
│   │   ├── ExcalidrawCanvas.vue    # 画布容器、状态和无障碍名称
│   │   ├── DrawingDirectoryPanel.vue
│   │   ├── LibraryPanel.vue
│   │   ├── ExportDialog.vue
│   │   └── StatusNotice.vue
│   ├── adapters/
│   │   ├── excalidraw-react.ts     # createRoot/render/unmount 和 callback 转换
│   │   └── treasure-sdk.ts          # 公开 SDK 类型与 Result<T> 错误映射
│   ├── domain/
│   │   ├── drawing.ts               # 场景、脏状态、保存冲突状态
│   │   ├── library.ts               # LibraryBundle 与 storage 索引
│   │   ├── export.ts                # ExportRequest/ExportTarget 领域类型
│   │   └── errors.ts                # 可恢复错误分类
│   ├── services/
│   │   ├── directory-service.ts     # settings/permissions/directories
│   │   ├── drawing-file-service.ts  # list/read/write/delete/hash
│   │   ├── library-service.ts       # 下载校验、loadLibrary、storage 回滚
│   │   ├── export-service.ts        # PNG/SVG + saveDialog/writeFile
│   │   └── size-guard.ts            # 32 MiB 预检
│   └── styles/
│       ├── host.css                 # iframe 高度、滚动边界、焦点
│       └── tokens.css               # 插件视觉角色
└── test/
    ├── domain/
    ├── services/
    ├── adapters/
    └── contracts/
```

**Structure Decision**: 保持插件为仓库根目录的独立直接子目录，先用 SDK scaffold 生成入口、manifest 和打包脚本，再在插件内分离 Vue UI、React 挂载、SDK 文件边界和 Excalidraw 领域适配。首版没有关系型数据，因此不创建 `scripts/init/*.sql` 或 `scripts/destroy.sql`；素材二进制和索引由插件私有 storage 管理。字体复制脚本和锁文件使 ESM 资源与离线宿主构建可重复。

## Phase 0: Research

研究结果已写入 [research.md](research.md)，每个技术未知均有 Decision、Rationale 和 Alternatives considered：

1. 固定 `@excalidraw/excalidraw@0.18.1`、React 19.0.0 和 ReactDOM 19.0.0，使用 ESM 根导入和 CSS，锁定 lockfile，并在安装时以类型检查验证导出签名。
2. 在 Vue `onMounted` 中通过 `createRoot` 挂载 `React.createElement(Excalidraw, ...)`，在 `onBeforeUnmount` 中卸载；用 callback 将场景、appState、BinaryFiles 和 library 状态送回 Vue，避免 Vue 直接渲染 React。
3. 使用官方场景/素材恢复与序列化及 PNG/SVG 导出工具；关闭 `loadScene`、`saveToActiveFile`、`export.saveFileToDisk` 和 `saveAsImage` 等会调用浏览器文件 API 的默认动作，所有保存/导出由 Treasure 工具栏接管。适配层以安装包的实际类型签名为准，避免复制会随版本变化的文档示例。
4. 用 `settings` + `permissions.verifyDirectoryGrant` 恢复单一目录，用父目录引用和文件名读写 `.excalidraw`；打开和保存前计算字节 SHA-256，变化时要求覆盖、另存或取消，同时处理 SDK `CONFLICT`。
5. 用官方 library hash/return 流程或明确用户触发的素材下载，验证 `.excalidrawlib` 后写入 storage 相对键和索引；网络输入视为不可信，旧的有效版本在更新失败时保留。若 iframe/CORS 阻断远程回跳，提供用户选择本地 `.excalidrawlib` 文件的 SDK 导入回退。
6. 以 32 MiB 为统一写入守卫；图片二进制随场景序列化，超限时拒绝保存/导出并保留脏场景，不通过 Base64、路径或拆分绕过限制。
7. 测试分为 Vitest/类型/构建自动化和 Treasure 宿主人工验证，人工范围包含授权撤销、重启、冲突、目录包/ZIP 导入和卸载。

## Phase 1: Design & Contracts

[数据模型](data-model.md) 定义 `DrawingDirectorySetting`、`DrawingFileSession`、`LibraryBundle`、`ExportRequest` 和 `ExportTarget`，并规定状态转换、引用生命周期、`.excalidraw`/`.excalidrawlib` 边界和 32 MiB 守卫。

[treasure-sdk-boundary.md](contracts/treasure-sdk-boundary.md) 规定公开 SDK 调用、目录授权恢复、Result<T> 错误映射、引用不持久化和写入回滚；[excalidraw-scene.md](contracts/excalidraw-scene.md) 规定场景/素材 JSON、加载校验、二进制文件与大小限制；[export.md](contracts/export.md) 规定 PNG/SVG、全画布/选区、透明背景、保存窗口和取消/覆盖行为；[ui-lifecycle.md](contracts/ui-lifecycle.md) 规定 Vue↔React 生命周期、状态展示、键盘焦点和滚动边界。

[quickstart.md](quickstart.md) 提供 scaffold、安装、类型/测试/构建命令和 Treasure 宿主手测步骤；它只描述验证路径，不替代 `speckit-tasks` 生成的实现任务，也不包含完整实现代码。

### 规格追踪

| 规格范围 | 设计落点 | 验证落点 |
| --- | --- | --- |
| FR-001..FR-004 | `App.vue`、`ExcalidrawCanvas.vue`、`ui-lifecycle.md`、`UIOptions.canvasActions` | quickstart 自动化第 6 项和宿主步骤 3 |
| FR-005..FR-009 | `directory-service.ts`、`drawing-file-service.ts`、`DrawingDirectorySetting`/`DrawingFileSession`、`treasure-sdk-boundary.md` | quickstart 自动化第 1/2/3 项和宿主步骤 2/3/4 |
| FR-010..FR-012 | `library-service.ts`、`LibraryBundle`、`excalidraw-scene.md` | quickstart 自动化第 4 项和宿主步骤 5 |
| FR-013..FR-016 | `export-service.ts`、`ExportRequest`/`ExportTarget`、`export.md` | quickstart 自动化第 5 项和宿主步骤 6 |
| SC-001..SC-006 | 四份契约、错误映射和构建验证 | quickstart 自动化命令及宿主步骤 2-7 |

## Post-Design Constitution Check

- **I** PASS — Phase 1 将所有宿主能力收敛到 `treasure-sdk` adapter，明确 scaffold 和 SDK 2.1.1/宿主 2.1.0 基线；React 只负责编辑器子树。
- **II** PASS — 数据模型只保存授权摘要、相对 storage key、场景字节和运行时引用；契约覆盖 Result<T> 错误、32 MiB、冲突和回滚，未引入路径或内部桥接。
- **III** PASS — 服务边界、序列化和导出接口均有独立契约；没有数据库、第二画布或无必要共享抽象；React 依赖的增加有官方集成理由。
- **IV** PASS — UI 契约覆盖空/加载/保存/冲突/错误/导出状态、键盘操作、ARIA 名称和唯一主要滚动区；画布容器的高度约束已记录。
- **V** PASS WITH MANUAL GATE — 自动化契约可验证核心逻辑，quickstart 明确宿主人工验证和发布命令；真实 SDK 权限、插件导入和卸载仍需在 Treasure 中留证。
- **VI** PASS — Phase 1 工件和源代码注释约定使用简体中文，英文仅用于模板标题、API、路径和标识符。

## Complexity Tracking

无宪章违规，无需复杂度例外记录。
