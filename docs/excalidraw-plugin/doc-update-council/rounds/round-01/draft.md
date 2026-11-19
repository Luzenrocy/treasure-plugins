---

description: "Treasure Excalidraw 插件实施任务清单"
---

# 任务清单：Treasure Excalidraw 绘图插件

**输入**：`/Volumes/MacExtend/FrontProjects/treasure-plugins/specs/004-excalidraw-plugin/` 中的 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/` 和 `quickstart.md`

**前置条件**：已发布的 `plan.md` 和 `spec.md`；设计工件中的 SDK、Excalidraw、文件、素材和导出边界已确认。

**测试说明**：计划和宪章要求业务逻辑、SDK 边界和回归检查具备自动化验证，因此本清单包含 Vitest、类型检查和构建任务；Treasure 宿主权限、系统窗口和包导入仍单独手工验证。

**组织方式**：任务按依赖阶段和用户故事排列。规格没有显式给出 P1/P2 排序，以下把用户场景 1 与 2 合并为 P1 的 US1、素材库设为 P2 的 US2、图片导出设为 P2 的 US3，这是基于已发布计划 MVP 范围的 `[Assumption]`；如果产品排序改变，只调整阶段优先级，不减少任务覆盖。

**本轮职责修订**：I1、U1、A1、I2、L1 已按用户确认关闭。Treasure 宿主测试由用户自行执行，不作为代理任务；宿主验收路径保留在 `quickstart.md`，任务清单只维护自动化检查和用户证据索引。

## 阶段 1：Setup（项目初始化）

**目的**：创建独立插件、锁定依赖和建立可运行的工程基线。

- [x] T001 使用 `npx treasure-sdk create excalidraw` 在仓库根目录创建独立插件目录 `excalidraw/`
- [x] T002 [P] 在 `excalidraw/package.json` 中锁定 Vue/Vite/Element Plus/treasure-sdk、React/ReactDOM、`@excalidraw/excalidraw@0.18.1` 和 Vitest 依赖，并声明 `dev`、`typecheck`、`test`、`build`、`build:plugin`、`build:plugin:zip` 脚本
- [x] T003 [P] 在 `excalidraw/manifest.json` 和 `excalidraw/index.html` 中配置插件编码 `excalidraw`、入口 meta、最低宿主版本 2.1.0 和 `workspace_dir` 目录设置，并确保构建包身份一致
- [x] T004 [P] 在 `excalidraw/vite.config.ts`、`excalidraw/tsconfig.json` 中配置 Vue 插件、相对 `base`、ESM/bundler 模块解析和 Treasure 调试 manifest 端点
- [x] T005 [P] 在 `excalidraw/scripts/copy-excalidraw-assets.mjs` 和 `excalidraw/public/excalidraw/fonts/` 中建立锁定版本字体资源复制流程
- [x] T006 [P] 在 `excalidraw/vitest.config.ts` 和 `excalidraw/test/setup.ts` 中建立 Vue/React/SDK mock 测试环境

---

## 阶段 2：Foundational（阻塞性基础能力）

**目的**：建立所有用户故事共享的领域类型、SDK 边界、React 生命周期和页面基础。此阶段完成前不得开始故事集成任务。

- [x] T007 在 `excalidraw/src/domain/drawing.ts`、`excalidraw/src/domain/library.ts`、`excalidraw/src/domain/export.ts` 中定义 `DrawingDirectorySetting`、`DrawingFileSession`、`LibraryBundle`、`ExportRequest` 和 `ExportTarget` 类型及状态枚举
- [x] T008 在 `excalidraw/src/domain/errors.ts`、`excalidraw/src/services/size-guard.ts` 中实现 SDK 错误分类和 32 MiB 字节预检，覆盖取消、权限、过期引用、冲突、无效数据和文件过大
- [x] T009 在 `excalidraw/src/adapters/treasure-sdk.ts` 和 `excalidraw/src/main.ts` 中封装公开 Treasure SDK 调用、`Result<T>` 映射和 `initTreasure()` 先于 Vue mount 的初始化边界，禁止绝对路径、持久化运行时引用和浏览器文件 API
- [x] T010 在 `excalidraw/src/adapters/excalidraw-react.ts` 和 `excalidraw/test/adapters/excalidraw-api-probe.ts` 中实现 `createRoot`/`render`/`unmount` 生命周期、`React.createElement` 挂载、中文 `langCode`、`onChange`/`onLibraryChange` 回调、锁定 0.18.1 的实际导出类型探针和关闭默认浏览器文件动作及非目标入口的 `UIOptions.canvasActions`
- [x] T011 [P] 在 `excalidraw/src/styles/host.css`、`excalidraw/src/styles/tokens.css` 中建立 iframe 高度、唯一主要滚动区、焦点可见性、状态颜色和中文界面基础样式
- [x] T012 在 `excalidraw/test/domain/`、`excalidraw/test/adapters/`、`excalidraw/test/contracts/treasure-sdk-boundary.test.ts` 中为领域类型、错误映射、大小守卫、React 卸载和 SDK 路径边界建立基础测试

**检查点**：基础类型、错误边界、React 挂载和测试环境可独立通过 `npm run typecheck` 与基础 Vitest 检查。

---

## 阶段 3：用户故事 1——本地绘图与文件生命周期（优先级：P1，MVP）

**目标**：用户能配置一个受授权的绘图目录，创建/打开/编辑/显式保存/删除 `.excalidraw` 文件，并在取消、冲突和失败时保留内容。

**独立验收**：在 mock SDK 中完成目录授权、文件列表、核心画布编辑、显式保存、外部修改确认、删除确认和重新打开；所有非成功分支都保留当前内存场景。Treasure 宿主对应验证由用户按 quickstart 执行。

### US1 测试

- [x] T013 [P] [US1] 在 `excalidraw/test/contracts/drawing-lifecycle.contract.test.ts` 中定义目录授权、`.excalidraw` 过滤、显式保存、删除确认、冲突和错误恢复的需求契约测试

### US1 实现

- [x] T014 [P] [US1] 在 `excalidraw/src/services/directory-service.ts` 中实现 `openDialog`、`settings.set/get`、`grantDirectory`、`verifyDirectoryGrant` 和 `directories.list` 流程，并将授权撤销映射到 `needs-reselect`
- [x] T015 [P] [US1] 在 `excalidraw/src/services/drawing-file-service.ts` 中实现 `.excalidraw` 列表、官方 `loadFromBlob` 读取、按 `test/adapters/excalidraw-api-probe.ts` 锁定的实际序列化类型、UTF-8/32 MiB 预检、SHA-256 基线比较、`writeFile` 保存和删除流程
- [x] T016 [US1] 在 `excalidraw/src/domain/drawing.ts` 中实现 `new/loading/ready/dirty/saving/saved/conflict/error` 状态转换以及切换、关闭、删除前的未保存确认决策
- [x] T017 [US1] 在 `excalidraw/src/components/ExcalidrawCanvas.vue` 中接入 React 画布容器，保留空态/加载态/保存态/错误态，并确保父容器有非零宽高
- [x] T018 [US1] 在 `excalidraw/src/components/DrawingDirectoryPanel.vue`、`excalidraw/src/components/StatusNotice.vue` 中实现文件列表、新建/打开/删除、确认弹窗、可恢复错误和无障碍名称
- [x] T019 [US1] 在 `excalidraw/src/App.vue` 中连接目录服务、绘图文件服务、React 回调和显式保存工具栏，确保默认浏览器加载/保存/下载动作及协作、账户、分享、云端同步、Excalidraw+ 入口不暴露给用户
- [x] T020 [US1] 在 `excalidraw/test/services/directory-service.test.ts`、`excalidraw/test/services/drawing-file-service.test.ts`、`excalidraw/test/components/drawing-lifecycle.test.ts` 中覆盖授权撤销、损坏文件、重复名称、外部修改、`CONFLICT`、取消、权限错误和 32 MiB 边界
- [x] T021 [US1] 在 `excalidraw/test/contracts/us1-acceptance.test.ts` 中建立核心图形、文字、图片、撤销/重做、缩放/平移、显式保存和重新打开的独立验收映射

**检查点**：US1 可以不依赖素材库和导出功能独立完成 SC-001、SC-002，并保留当前编辑内容。

---

## 阶段 4：用户故事 2——官方素材库与离线素材（优先级：P2）

**目标**：用户能从官方素材库或本地 `.excalidrawlib` 回退入口导入合法素材，持久保存到插件私有 storage，重启后离线插入，并在失败时保留上一有效版本。

**独立验收**：使用 mock 编辑器回调和 SDK storage 完成有效库导入、重复安装、格式/网络/取消错误、索引回滚和离线恢复；与 US1 的画布连接在集成阶段验证。

### US2 测试

- [x] T022 [P] [US2] 在 `excalidraw/test/contracts/library.contract.test.ts` 中定义官方 hash/来源不可信、本地文件回退、库版本校验、私有 storage 相对键和旧版本保留契约

### US2 实现

- [x] T023 [US2] 在 `excalidraw/src/services/library-service.ts` 中实现官方 library URL/hash 触发、本地 `.excalidrawlib` 文件回退、按 `test/adapters/excalidraw-api-probe.ts` 锁定的实际 library 类型、`loadLibraryFromBlob` 校验、重复库识别和错误恢复
- [x] T024 [US2] 在 `excalidraw/src/services/library-service.ts`、`excalidraw/src/domain/library.ts` 中实现 `LibraryBundle` 序列化、checksum、storage blob/index 分步写入、索引失败回滚和旧版本保留
- [x] T025 [US2] 在 `excalidraw/src/components/LibraryPanel.vue` 中实现素材入口、来源/版本/状态展示、安装/删除/重试和网络不可达提示，不显示协作或云端功能
- [x] T026 [US2] 在 `excalidraw/src/adapters/excalidraw-react.ts`、`excalidraw/src/App.vue` 中接入 library persistence、`onLibraryChange`/插入回调和重启后的离线素材恢复
- [x] T027 [US2] 在 `excalidraw/test/services/library-service.test.ts`、`excalidraw/test/components/library-panel.test.ts` 中覆盖有效/损坏/重复/取消/网络失败、版本不兼容、storage 回滚、删除和离线读取
- [x] T028 [US2] 在 `excalidraw/test/contracts/us2-acceptance.test.ts` 中建立官方素材安装、素材插入、格式错误恢复和离线使用的独立验收映射

**检查点**：US2 的服务和契约可以独立通过 mock storage 验收；与真实官方入口的 iframe/CORS 回跳在 Polish 阶段手工确认。

---

## 阶段 5：用户故事 3——PNG/SVG 图片导出（优先级：P2）

**目标**：用户能把当前场景导出为 PNG 或 SVG 的全画布/选区图片，选择透明背景和目标位置，并在取消、超限或失败时保持画布。

**独立验收**：使用 mock 场景、BinaryFiles 和 `saveDialog` 验证两种格式、两种范围、透明背景、空选区、目标覆盖、取消、资源缺失和 32 MiB 错误。

### US3 测试

- [x] T029 [P] [US3] 在 `excalidraw/test/contracts/export.contract.test.ts` 中定义格式、范围、透明背景默认值、空选区、保存窗口引用和失败保留场景契约

### US3 实现

- [x] T030 [US3] 在 `excalidraw/src/services/export-service.ts` 中实现非删除元素/选区过滤、按 `test/adapters/excalidraw-api-probe.ts` 锁定的实际 `exportToBlob`/`exportToSvg` 类型、派生 `exportBackground`、32 MiB 预检和错误映射
- [x] T031 [US3] 在 `excalidraw/src/components/ExportDialog.vue` 中实现 PNG/SVG、全画布/选区、透明背景、空选区提示、覆盖确认和无障碍焦点顺序
- [x] T032 [US3] 在 `excalidraw/src/App.vue`、`excalidraw/src/components/ExcalidrawCanvas.vue` 中连接导出服务和 Treasure `files.saveDialog`/`files.writeFile`，关闭 Excalidraw 浏览器下载路径
- [x] T033 [US3] 在 `excalidraw/test/services/export-service.test.ts`、`excalidraw/test/components/export-dialog.test.ts` 中覆盖 PNG/SVG、全画布/选区、透明背景、空选区、图片缺失、取消、冲突和超限
- [x] T034 [US3] 在 `excalidraw/test/contracts/us3-acceptance.test.ts` 中建立导出格式、范围、透明背景、目标文件可读和失败不破坏画布的独立验收映射

**检查点**：US3 可使用固定场景和 mock SDK 独立验收；真实 WebView 字体度量、保存窗口和目标文件打开在 Polish 阶段确认。

---

## 阶段 6：Polish 与跨故事收尾

**目的**：完成跨故事的无障碍、文档、身份一致性、自动化构建和用户宿主验证记录链接。

- [x] T035 [P] 在 `excalidraw/src/components/`、`excalidraw/src/styles/host.css` 中完成键盘焦点、ARIA 名称、中文文案、窄窗口和唯一主要滚动区审查
- [x] T036 [P] 在 `excalidraw/README.md` 中记录产品定位、核心页面/流程、SDK/React 架构、视觉角色、离线素材、构建命令和已知限制
- [x] T037 [P] 在 `excalidraw/test/contracts/manifest-consistency.test.ts` 中声明并检查 `manifest.json`、入口 meta、构建包身份、最低宿主版本和目录设置一致性
- [x] T038 [P] 在 `excalidraw/test/contracts/release-boundaries.test.ts` 中覆盖绝对路径不持久化、默认浏览器文件动作关闭、Result<T> 错误映射、32 MiB 守卫和非目标入口不注册
- [x] T039 在 `excalidraw/` 执行 `npm run typecheck`、`npm run test`、`npm run build`、`npm run build:plugin` 和 `npm run build:plugin:zip`，记录失败、限制和兼容性假设
- [x] T040 在 `specs/004-excalidraw-plugin/quickstart.md` 和 `excalidraw/README.md` 中回填自动化验证结果，并链接用户维护的 `excalidraw/docs/host-validation.md`；不执行 Treasure 宿主测试，不修改 reviewer-owned `checklists/requirements-quality.md` 的勾选状态

---

## 依赖与执行顺序

### 阶段依赖

- **Setup（阶段 1）**：T001 完成后，T002-T006 可按文件分工并行；所有用户故事依赖本阶段。
- **Foundational（阶段 2）**：依赖 T001-T006，阻塞所有用户故事；T007-T010 先于故事服务，T011 可与其并行，T012 在共享边界稳定后执行。
- **US1（阶段 3）**：依赖阶段 2；US1 是 MVP，先建立 App 外壳和绘图生命周期。
- **US2（阶段 4）**：服务/契约可在阶段 2 后与 US1 的非集成部分并行；T025-T026 依赖 T017-T019 的画布/App 集成。
- **US3（阶段 5）**：服务/契约可在阶段 2 后与 US2 并行；T031-T032 依赖 T017-T019 的画布/App 集成。
- **Polish（阶段 6）**：T035-T038 可在故事实现稳定后并行；T039 依赖所有自动化代码；T040 依赖 T039。Treasure 宿主手工验证不属于代理任务，由用户按 quickstart 执行。

### 用户故事依赖

- **US1（P1）**：依赖 Foundational；无其他故事依赖，可独立交付 MVP。
- **US2（P2）**：领域服务可独立于 US1；界面插入与画布回调集成依赖 US1 的 React bridge/App。
- **US3（P2）**：领域服务可独立于 US1；导出界面与画布状态集成依赖 US1 的 React bridge/App。

### 故事内顺序

每个故事先完成契约测试和领域/服务边界，再完成组件集成和故事验收映射；模型/状态先于服务，服务先于组件，组件先于跨组件集成。任务状态由实施阶段维护，已完成项可标记 `[x]`。

## 并行机会

- T002-T006：脚手架完成后，依赖、manifest、Vite、字体和 Vitest 基线分别修改不同文件。
- T013、T022、T029：三个用户故事的契约测试只依赖 Foundational，可由不同开发者并行准备。
- T014 与 T015：US1 的目录授权和绘图文件服务分别修改不同服务文件。
- T023-T025、T030-T031：素材库服务/组件与导出服务/组件可并行开发，合并前通过 App 集成任务串行接入。
- T035-T038：无障碍、README、manifest 一致性和边界契约分别修改不同文件。

## 并行示例：US1

```text
完成阶段 2 后可并行启动：
Task: T013 在 test/contracts/drawing-lifecycle.contract.test.ts 编写 US1 契约测试
Task: T014 在 src/services/directory-service.ts 实现目录授权
Task: T015 在 src/services/drawing-file-service.ts 实现绘图文件读写/冲突

完成 T014/T015 后串行启动：
Task: T016 在 src/domain/drawing.ts 完成状态转换
Task: T017-T019 完成画布、文件面板和 App 集成
Task: T020-T021 完成故事测试和验收映射
```

## 实施策略

### MVP（仅 US1）

1. 完成阶段 1 Setup。
2. 完成阶段 2 Foundational，确保 SDK、React bridge、错误和测试边界稳定。
3. 完成阶段 3 US1，独立验证核心画布、`.excalidraw` 文件生命周期和冲突恢复。
4. 在进入素材库和导出前，执行 `npm run typecheck`、`npm run test`、`npm run build`；US1 宿主验收由用户按 quickstart 手工执行。

### 增量交付

1. Setup + Foundational → 可运行的插件基线。
2. US1 → 本地绘图与文件 MVP。
3. US2 → 官方素材库、私有 storage 和离线使用。
4. US3 → PNG/SVG 导出。
5. Polish → 无障碍、文档和自动化构建；宿主发布证据由用户维护并由文档链接。

## 说明

- `[P]` 仅表示不同文件、没有未完成依赖的任务可以并行。
- Treasure 宿主的启动、权限、系统窗口、目录包/ZIP 导入和卸载验证由用户执行，不属于代理任务清单。
- `[USn]` 将任务映射到对应用户故事；Setup、Foundational 和 Polish 不使用故事标签。
- 所有任务均保留 `- [ ]`，由 `$speckit-implement` 或实施者在实际完成后更新。
- 本清单不包含完整实现代码，不新增协作、账户、云端同步、分享、JPEG/WebP、剪贴板或倍率调整范围。
