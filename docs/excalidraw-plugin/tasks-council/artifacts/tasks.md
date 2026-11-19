---

description: "Treasure Excalidraw 插件实施任务清单"
---

# 任务清单：Treasure Excalidraw 绘图插件

**输入**：`specs/004-excalidraw-plugin/` 中的 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/` 和 `quickstart.md`

**前置条件**：`plan.md` 与 `spec.md` 已发布；SDK/宿主窗口菜单公开能力、Excalidraw React 适配、文件、素材和导出契约已完成设计。

**测试说明**：领域逻辑、SDK mock、协议契约、组件和构建检查列入自动化任务；Treasure 宿主的权限、系统窗口、插件导入、重启和卸载验证由用户按 `quickstart.md` 手工执行，不列为代理测试任务。

**状态说明**：本稿是待实施清单，所有任务均从 `[ ]` 开始；旧清单中标记为 `[x]` 的历史任务不代表本轮实现已完成。

## 阶段 1：Setup（项目初始化）

**目的**：确认 scaffold、依赖、入口身份和自动化基线。

- [ ] T001 使用 `npx treasure-sdk create excalidraw` 生成或校验仓库根目录下的 `excalidraw/` scaffold，保留生成的基础入口和打包文件
- [ ] T002 [P] 在 `excalidraw/package.json` 中锁定 Vue/Vite/Element Plus/treasure-sdk、React/ReactDOM、`@excalidraw/excalidraw@0.18.1` 与 Vitest，并声明 `dev`、`typecheck`、`test`、`build`、`build:plugin`、`build:plugin:zip` 脚本
- [ ] T003 [P] 在 `excalidraw/manifest.json`、`excalidraw/index.html` 中统一插件编码 `excalidraw`、入口 meta、`minPlatformVersion: 2.1.0` 和 `workspace_dir` 目录设置
- [ ] T004 [P] 在 `excalidraw/vite.config.ts`、`excalidraw/tsconfig.json` 中配置 Vue 插件、相对 `base`、ESM/bundler 模块解析和 Treasure 调试 manifest 端点
- [ ] T005 [P] 在 `excalidraw/scripts/copy-excalidraw-assets.mjs`、`excalidraw/public/excalidraw/fonts/` 建立锁定 Excalidraw 版本的字体资源复制流程
- [ ] T006 [P] 在 `excalidraw/vitest.config.ts`、`excalidraw/test/setup.ts` 建立 Vue、React、SDK mock、`window.matchMedia` 和 Blob/文件 API 测试环境

---

## 阶段 2：Foundational（阻塞性基础能力）

**目的**：建立所有用户故事共享的领域、SDK、React、菜单和页面基础。该阶段完成前不得开始故事集成。

- [ ] T007 在 `excalidraw/src/domain/drawing.ts`、`excalidraw/src/domain/library.ts`、`excalidraw/src/domain/export.ts` 定义 `DrawingDirectorySetting`、`DrawingFileSession`、`LibraryBundle`、`ExportRequest`、`ExportTarget` 和状态枚举
- [ ] T008 在 `excalidraw/src/domain/errors.ts`、`excalidraw/src/services/size-guard.ts` 实现 `Result<T>` 错误分类和 32 MiB 字节预检，覆盖取消、未授权、过期引用、冲突、无效数据和文件过大
- [ ] T009 在 `excalidraw/src/adapters/treasure-sdk.ts`、`excalidraw/src/main.ts` 封装公开 Treasure SDK 调用、错误映射和 `initTreasure()` 先于 Vue mount 的初始化边界，禁止持久化绝对路径、运行时引用和浏览器文件 API
- [ ] T010 在 `excalidraw/src/adapters/excalidraw-react.ts`、`excalidraw/test/adapters/excalidraw-api-probe.ts` 实现 `createRoot`/`render`/`unmount`、`React.createElement` 挂载、中文 `langCode`、场景/素材回调、0.18.1 实际导出类型探针和默认浏览器文件动作关闭
- [ ] T011 [P] 在 `excalidraw/src/styles/host.css`、`excalidraw/src/styles/tokens.css` 建立 iframe 高度、唯一主要滚动区、焦点可见性、状态颜色和中文界面基础样式
- [ ] T012 在 `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/client.ts` 增加公开菜单类型及 `menus.register`、`menus.update`、`menus.subscribe`、`menus.unsubscribe`、`menus.unregister` API，定义类型化点击事件和订阅句柄
- [ ] T013 在 `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/bridge.ts`、`/Volumes/MacExtend/FrontProjects/treasure-sdk/src/bridge-impl/production.ts` 增加菜单订阅的本地 listener registry、token 生命周期和 bridge payload 适配；不得把函数序列化到 `postMessage`
- [ ] T014 [P] 在 `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/index.ts`、`/Volumes/MacExtend/FrontProjects/treasure-sdk/docs/API-REFERENCE.md`、`/Volumes/MacExtend/FrontProjects/treasure-sdk/docs/BRIDGE-PROTOCOL.md` 导出并记录菜单公开 API、事件字段、来源校验、`capabilityVersion/minCapabilityVersion` 和 `UNSUPPORTED` 兼容语义
- [ ] T015 在 `/Volumes/MacExtend/FrontProjects/treasure/src/store/menuRegistry.ts` 增加菜单更新、订阅路由所需的宿主注册状态、插件身份索引和重复注册清理语义，保持宿主既有全局菜单视觉结构
- [ ] T016 在 `/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts` 扩展 `capabilityRegistry` 与菜单 action，校验 iframe source/origin 和插件身份，路由注册、更新、订阅、取消订阅、注销请求及菜单点击事件；内部 `treasure-menu-event` 只作为宿主内部实现，不暴露给插件
- [ ] T017 在 `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/client.ts` 与 `/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts` 对齐 capability 版本协商、能力缺失错误归一化和生命周期清理；平台 `minPlatformVersion` 保持 2.1.0，菜单能力使用独立 capability 版本
- [ ] T018 [P] 在 `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/client.test.ts`、`/Volumes/MacExtend/FrontProjects/treasure-sdk/src/bridge.test.ts` 建立菜单类型、listener registry、重复注销、事件字段和不支持能力的 SDK contract tests
- [ ] T019 [P] 在 `/Volumes/MacExtend/FrontProjects/treasure/src/store/menuRegistry.test.ts`、`/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.test.ts` 建立来源校验、重复注册、宿主路由、能力版本和错误归一化测试；不把真实宿主运行测试委托给代理
- [ ] T020 [P] 在 `excalidraw/src/adapters/menu-actions.ts`、`excalidraw/test/adapters/menu-actions.test.ts` 定义 File 菜单保存/导出注册、更新、类型化订阅、注销、重试和 `UNSUPPORTED` 映射边界；禁止读取 `window`、监听 `postMessage` 或匹配 `treasure-menu-event`
- [ ] T021 在 `excalidraw/src/App.vue`、`excalidraw/src/components/StatusNotice.vue` 建立页面根布局、统一状态区域和面板挂载槽位，为无标题行、侧边导航和菜单失败状态预留可访问入口

**检查点**：插件、SDK 和宿主的公开菜单契约已形成；SDK mock 与静态边界测试可运行，故事任务可以开始。宿主真实运行验证仍由用户执行。

---

## 阶段 3：用户故事 1——通过 File 菜单保存和导出（优先级：P1，MVP）

**目标**：移除插件自有标题行，用户通过 Treasure `File` 窗口菜单保存和启动导出，并在菜单不可用时获得明确状态。

**独立验收**：在 SDK mock 中注册 File 菜单，完成保存和 PNG/SVG 导出；验证无目录、无内容、菜单拒绝、取消和注销场景均不丢失画布内容。真实 Treasure 菜单行为由用户按 `quickstart.md` 手工验证。

### US1 测试

- [ ] T022 [P] [US1] 在 `excalidraw/test/contracts/menu-actions.contract.test.ts` 定义菜单注册、点击订阅、保存/导出禁用、失败重试、生命周期注销和重复加载契约
- [ ] T023 [P] [US1] 在 `excalidraw/test/contracts/us1-acceptance.test.ts` 建立无标题行、File 菜单保存、PNG/SVG 导出、取消/失败保留场景和菜单不可用提示的独立验收映射

### US1 实现

- [ ] T024 [P] [US1] 在 `excalidraw/src/domain/drawing.ts` 实现 `new/loading/ready/dirty/saving/saved/conflict/error` 状态转换以及切换、关闭、删除前的未保存确认决策
- [ ] T025 [P] [US1] 在 `excalidraw/src/services/directory-service.ts` 实现 `openDialog`、`settings.get/set`、`grantDirectory`、`verifyDirectoryGrant` 和 `directories.list`，将授权撤销映射到 `needs-reselect`
- [ ] T026 [US1] 在 `excalidraw/src/services/drawing-file-service.ts` 实现 `.excalidraw` 过滤、官方场景读取/序列化、UTF-8/32 MiB 预检、SHA-256 基线、`writeFile` 保存和删除
- [ ] T027 [US1] 在 `excalidraw/src/adapters/menu-actions.ts` 接入公开 SDK 菜单 API，注册 `File/保存` 与 `File/导出`，订阅类型化点击事件，更新 enabled 状态，并在卸载、停用、重载时注销
- [ ] T028 [US1] 在 `excalidraw/src/components/ExcalidrawCanvas.vue` 接入 React 画布容器，保留空态、加载态、保存态和错误态，确保父容器有非零宽高且不渲染自有标题行
- [ ] T029 [US1] 在 `excalidraw/src/components/DrawingDirectoryPanel.vue`、`excalidraw/src/components/StatusNotice.vue` 实现文件列表、新建/打开/删除、确认弹窗、保存状态、菜单能力失败原因和“重试注册”入口
- [ ] T030 [US1] 在 `excalidraw/src/App.vue` 连接目录服务、绘图文件服务、React 回调和菜单动作，关闭 Excalidraw 默认浏览器文件动作及协作、账户、分享、云端同步入口
- [ ] T031 [US1] 在 `excalidraw/test/services/directory-service.test.ts`、`excalidraw/test/services/drawing-file-service.test.ts`、`excalidraw/test/components/drawing-lifecycle.test.ts` 覆盖授权撤销、损坏文件、重复名称、外部修改、`CONFLICT`、取消、权限错误和 32 MiB 边界
- [ ] T032 [US1] 在 `excalidraw/test/components/file-menu-flow.test.ts` 覆盖 File 菜单保存/导出点击、动作禁用、注册失败重试、注销后无重复入口和页面无标题行

**检查点**：US1 可以独立完成 File 菜单保存和导出入口验证，并保留当前编辑内容；宿主菜单实际显示、点击和卸载证据由用户补充。

---

## 阶段 4：用户故事 2——统一可折叠侧边导航（优先级：P1）

**目标**：将绘图目录、素材库、设置和帮助纳入同一视觉层级的可折叠侧边导航，移除画布左上角设置和右下角帮助浮动按钮。

**独立验收**：在组件测试和窄窗口视口中使用鼠标、键盘展开/收起四个入口，验证焦点、面板滚动、选中状态和画布空间恢复。

### US2 测试

- [ ] T033 [P] [US2] 在 `excalidraw/test/contracts/sidebar-navigation.contract.test.ts` 定义四入口统一层级、折叠状态、面板恢复、键盘焦点、ARIA 名称、窄窗口滚动和无横向溢出契约

### US2 实现

- [ ] T034 [P] [US2] 在 `excalidraw/src/components/SidebarNav.vue` 建立绘图目录、素材库、设置、帮助入口、当前选中状态、展开/收起按钮和面板关闭行为
- [ ] T035 [US2] 在 `excalidraw/src/App.vue` 重排页面布局，将 `SidebarNav.vue` 与 `DrawingDirectoryPanel.vue`、`LibraryPanel.vue`、设置/帮助内容统一接入，删除旧侧边卡片和标题行残留
- [ ] T036 [US2] 在 `excalidraw/src/components/ExcalidrawCanvas.vue` 移除左上角设置浮动按钮、右下角帮助浮动按钮，保留画布工具栏和状态提示不受侧边折叠破坏
- [ ] T037 [US2] 在 `excalidraw/src/styles/host.css`、`excalidraw/src/styles/tokens.css` 实现紧凑现代视觉、折叠宽度、焦点环、面板内滚动、窄窗口断点和宿主边界内的横向溢出保护
- [ ] T038 [US2] 在 `excalidraw/test/components/sidebar-nav.test.ts`、`excalidraw/test/components/layout-accessibility.test.ts` 覆盖入口切换、折叠恢复、键盘导航、焦点不进入隐藏内容、ARIA 名称、滚动隔离和旧浮动按钮不存在
- [ ] T039 [US2] 在 `excalidraw/test/contracts/us2-acceptance.test.ts` 建立统一侧边导航、窄窗口和设置/帮助可达性的独立验收映射

**检查点**：US2 不依赖真实素材接口即可独立验证导航、焦点和布局；画布核心编辑能力保持可用。

---

## 阶段 5：用户故事 3——插件内查询并安装官方素材（优先级：P1）

**目标**：只使用预配置的官方查询/下载接口，在插件内完成查询、下载、校验、写入、清理和离线使用，禁止第三方页面跳转和任意 URL。

**独立验收**：使用 mock 官方接口、storage 和网络故障注入，验证各阶段状态、取消/重试、校验失败、残留清理、重复安装和上一有效版本保留。

### US3 测试

- [ ] T040 [P] [US3] 在 `excalidraw/test/contracts/library.contract.test.ts` 定义预配置官方来源、无任意 URL、查询结果、下载包校验、稳定素材标识、私有 storage、清理和离线恢复契约

### US3 实现

- [ ] T041 [P] [US3] 在 `excalidraw/src/domain/library.ts` 定义 `LibraryQuery`、`LibraryItem`、`LibraryInstallSession` 阶段状态和稳定标识/checksum 规则
- [ ] T042 [US3] 在 `excalidraw/src/services/official-library-client.ts` 封装插件预配置的官方查询/下载接口，校验来源配置和响应结构，拒绝用户输入 URL、未配置来源和第三方页面跳转
- [ ] T043 [US3] 在 `excalidraw/src/services/library-service.ts` 实现查询、下载、校验 `.excalidrawlib`、写入私有 storage、索引更新、重复安装幂等、更新失败回滚和临时包清理
- [ ] T044 [US3] 在 `excalidraw/src/components/LibraryPanel.vue` 实现插件内搜索/浏览、素材详情、阶段进度、取消、重试、已安装/更新状态、清理失败残留和离线可用提示
- [ ] T045 [US3] 在 `excalidraw/src/adapters/excalidraw-react.ts`、`excalidraw/src/App.vue` 接入 library persistence、`onLibraryChange`/插入回调和重启后的离线素材恢复，不改变当前画布或上一有效素材
- [ ] T046 [US3] 在 `excalidraw/test/services/official-library-client.test.ts`、`excalidraw/test/services/library-service.test.ts`、`excalidraw/test/components/library-panel.test.ts` 覆盖查询失败、下载取消、超限、格式/校验失败、写入失败、清理失败、重复安装、回滚和离线读取
- [ ] T047 [US3] 在 `excalidraw/test/contracts/us3-acceptance.test.ts` 建立插件内查询、五阶段安装、临时包删除、失败残留、幂等安装和素材插入的独立验收映射

**检查点**：US3 的服务和 UI 可在 mock 官方接口下独立验收；真实接口可达性和宿主网络策略由用户按 quickstart 手工确认。

---

## 阶段 6：用户故事 4——继续使用首版本地绘图与导出（优先级：P1）

**目标**：在入口和布局调整后继续支持基本图形、文字、图片、撤销/重做、缩放/平移、显式保存、重新打开以及 PNG/SVG 全画布/选区透明背景导出。

**独立验收**：使用固定场景和 mock SDK 完成创建、编辑、保存、重新打开和两种格式导出；取消、失败、空选区和资源缺失均保留当前场景。

### US4 测试

- [ ] T048 [P] [US4] 在 `excalidraw/test/contracts/export.contract.test.ts` 定义 PNG/SVG、全画布/选区、透明背景默认值、空选区、保存窗口引用、取消、覆盖和失败保留场景契约

### US4 实现

- [ ] T049 [P] [US4] 在 `excalidraw/src/services/export-service.ts` 实现非删除元素/选区过滤、实际 `exportToBlob`/`exportToSvg` 类型适配、`exportBackground`、32 MiB 预检和错误映射
- [ ] T050 [US4] 在 `excalidraw/src/components/ExportDialog.vue` 实现 PNG/SVG、全画布/选区、透明背景、空选区提示、目标覆盖确认和无障碍焦点顺序
- [ ] T051 [US4] 在 `excalidraw/src/App.vue`、`excalidraw/src/components/ExcalidrawCanvas.vue` 连接导出服务和 Treasure `files.saveDialog`/`files.writeFile`，关闭浏览器下载路径并同步 File 菜单状态
- [ ] T052 [US4] 在 `excalidraw/test/services/export-service.test.ts`、`excalidraw/test/components/export-dialog.test.ts` 覆盖 PNG/SVG、全画布/选区、透明背景、空选区、图片缺失、取消、冲突和超限
- [ ] T053 [US4] 在 `excalidraw/test/contracts/us4-acceptance.test.ts` 建立基本绘图工具、撤销/重做、缩放/平移、显式保存/重开、导出目标可读和失败不破坏画布的独立验收映射

**检查点**：US4 可在 mock SDK 中独立验证核心绘图和导出边界；真实系统选择窗口、字体度量和目标文件打开由用户手工验证。

---

## 阶段 7：Polish 与跨故事收尾

**目的**：完成无障碍、来源边界、身份一致性、文档和自动化构建，保留用户宿主验收记录入口。

- [ ] T054 [P] 在 `excalidraw/src/components/`、`excalidraw/src/styles/host.css` 完成中文文案、键盘焦点、ARIA 名称、窄窗口、唯一主要滚动区和加载/错误状态审查
- [ ] T055 [P] 在 `excalidraw/test/contracts/manifest-consistency.test.ts` 检查 `manifest.json`、入口 meta、构建包身份、`minPlatformVersion`、`workspace_dir` 和目录名称一致
- [ ] T056 [P] 在 `excalidraw/test/contracts/release-boundaries.test.ts` 检查绝对路径不持久化、默认浏览器文件动作关闭、`Result<T>` 错误映射、32 MiB 守卫、官方来源限制和非目标入口不注册
- [ ] T057 [P] 在 `excalidraw/test/contracts/menu-source-boundary.test.ts` 扫描插件源码，确认不读取 `window` 菜单事件、不调用 `postMessage`、不匹配 `treasure-menu-event`，仅经公开 SDK 菜单 API 交互
- [ ] T058 [P] 在 `excalidraw/README.md` 记录插件定位、页面流程、SDK/React 架构、菜单 capability 前置条件、侧边导航、官方素材安装、离线素材、构建命令和已知限制
- [ ] T059 在 `specs/004-excalidraw-plugin/quickstart.md`、`excalidraw/docs/host-validation.md` 回填自动化命令和用户手工验收路径；明确宿主启动、权限、菜单点击、系统窗口、目录包/ZIP 导入、重启和卸载证据由用户维护
- [ ] T060 在 `excalidraw/` 执行 `npm run typecheck`、`npm run test`、`npm run build`、`npm run build:plugin`、`npm run build:plugin:zip`，记录失败、限制和兼容性假设
- [ ] T061 在 `/Volumes/MacExtend/FrontProjects/treasure-sdk/` 执行 SDK 类型检查和菜单 contract tests，在 `/Volumes/MacExtend/FrontProjects/treasure/` 执行静态/单元 contract tests；不执行宿主 GUI 运行验证
- [ ] T062 对照 `spec.md`、`plan.md`、`contracts/` 和本清单完成 FR-001..FR-028、SC-001..SC-011 覆盖审查，确认不新增协作、账户、云端同步、分享、JPEG/WebP、剪贴板或倍率调整范围

---

## 依赖与执行顺序

### 阶段依赖

- **Setup（阶段 1）**：T001 完成后，T002-T006 可按文件分工并行；所有故事依赖本阶段。
- **Foundational（阶段 2）**：依赖 Setup；T012-T019 是 US1 菜单集成的跨仓库阻塞前置，T020-T021 可在公开契约稳定后准备插件适配。
- **US1（阶段 3）**：依赖 Foundational，先完成 File 菜单与文件生命周期；它是 MVP。
- **US2（阶段 4）**：依赖 Foundational，可与 US1 的服务任务并行；T035 需要 US1 的 App 外壳稳定。
- **US3（阶段 5）**：依赖 Foundational，可与 US1/US2 的非集成服务并行；T044-T045 需要侧边导航和画布/App 槽位。
- **US4（阶段 6）**：依赖 Foundational 和 US1 的画布/App 集成；导出服务本身可提前并行开发。
- **Polish（阶段 7）**：依赖所有目标故事和 SDK/宿主 contract tests；T059 的宿主手工验证不由代理执行。

### 用户故事依赖

- **US1（P1）**：依赖 Foundational；无其他故事依赖，可独立交付 MVP。
- **US2（P1）**：依赖 Foundational；与 US1 共享 App 外壳，但可独立验证导航和无障碍。
- **US3（P1）**：依赖 Foundational；与 US1/US2 共享素材面板槽位，服务可独立验证。
- **US4（P1）**：依赖 Foundational；导出界面与 File 菜单和画布状态集成，核心服务可独立验证。

### 并行机会

- T002-T006：脚手架完成后，依赖、manifest、Vite、字体和 Vitest 基线修改不同文件。
- T012-T014 与 T015-T017：SDK 公共 API/文档和宿主菜单注册/桥接可按仓库分工并行，合并前以能力版本和错误语义为接口门槛。
- T018-T020：SDK、宿主、插件菜单 contract tests 可并行编写。
- T022-T026、T033-T037、T040-T043、T048-T050：各故事的契约、领域和服务任务可在 Foundational 后并行。
- T054-T058：无障碍、边界、源码扫描和文档分别修改不同文件，可并行。

## 并行示例：US1

```text
Foundational 完成后可并行启动：
Task: T022 在 test/contracts/menu-actions.contract.test.ts 编写菜单契约测试
Task: T024 在 src/domain/drawing.ts 完成状态转换
Task: T025 在 src/services/directory-service.ts 实现目录授权
Task: T026 在 src/services/drawing-file-service.ts 实现绘图文件读写/冲突

完成公开菜单契约后串行启动：
Task: T027 在 src/adapters/menu-actions.ts 接入注册、订阅和注销
Task: T028-T030 完成画布、文件面板和 App 集成
Task: T031-T032 完成服务与 File 菜单验收测试
```

## 实施策略

### MVP（US1）

1. 完成 Setup。
2. 完成 SDK/宿主公开菜单 capability、插件 SDK adapter、React bridge 和错误边界。
3. 完成 US1，独立验证无标题行、File 菜单保存/导出和本地 `.excalidraw` 生命周期。
4. 执行插件与 SDK/宿主的自动化检查；Treasure 宿主菜单显示、点击、权限和卸载由用户按 quickstart 手工验证。

### 增量交付

1. Setup + Foundational → 可运行的插件和公开菜单能力基线。
2. US1 → File 菜单与本地绘图 MVP。
3. US2 → 统一可折叠侧边导航。
4. US3 → 官方素材库查询、安装清理和离线素材。
5. US4 → 首版 PNG/SVG 导出和核心绘图回归。
6. Polish → 无障碍、来源边界、文档和自动化构建；宿主证据由用户维护。

## 说明

- `[P]` 表示不同文件、没有未完成依赖的任务可以并行。
- `[USn]` 将任务映射到对应用户故事；Setup、Foundational 和 Polish 不使用故事标签。
- 宿主启动、权限、系统窗口、菜单点击、插件导入、重启和卸载验证由用户执行，不属于代理任务清单。
- 旧清单中的完成标记不继承到本轮；实施者应在实际完成后维护 `[x]` 状态。
- 本清单不包含完整实现代码，不改变宿主全局菜单视觉或信息架构，不新增协作、账户、云端同步、分享、JPEG/WebP、剪贴板或倍率调整范围。
