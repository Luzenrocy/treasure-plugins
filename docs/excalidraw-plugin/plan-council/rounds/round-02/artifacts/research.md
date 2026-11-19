# Phase 0 研究记录：Treasure Excalidraw 绘图插件

## 决策 1：固定安全可复现的 Excalidraw ESM 版本

- **Decision**：将 `@excalidraw/excalidraw` 固定为 `0.18.1`，同时固定 `react`/`react-dom` `19.0.0`，提交 lockfile；从包根导入 ESM 和 `index.css`，不使用旧的 `types/` 深层路径。
- **Rationale**：0.18 系列已转为 ESM，官方 peer dependencies 支持 React 17/18/19；0.18.1 修复 Mermaid 转换链的已知 XSS 并更新相关依赖。固定版本可以让类型、导出函数和字体资源在 Treasure 构建中可复现。
- **Alternatives considered**：使用 `>=0.18.1` 会让构建和导出签名随安装时间漂移；使用远程 `excalidraw.com` 或旧 UMD 包会破坏本地 SDK 边界和当前 Vite ESM 构建。
- **Evidence**：S-006、S-007、S-008；安装时以 lockfile 和 `vue-tsc` 再验证实际包导出。

## 决策 2：用 Vue 外壳包裹 React 子树

- **Decision**：`ExcalidrawCanvas.vue` 只提供稳定且有明确高度的容器；`onMounted` 中调用 `createRoot(container).render(React.createElement(Excalidraw, props))`，`onBeforeUnmount` 调用 `root.unmount()`。React callback 通过适配器发送场景、appState、BinaryFiles、library 和错误给 Vue 状态。
- **Rationale**：官方编辑器是 React 组件，官方集成要求 CSS 已导入且父容器有非零尺寸。单一挂载点能隔离 React context、避免 Vue 直接渲染 React，并在插件卸载时释放监听器。
- **Alternatives considered**：iframe 不能稳定访问 Treasure SDK；在 Vue 中重写画布会失去官方序列化、素材和导出兼容性；把 React 组件混入 Vue 模板会让生命周期和状态边界不可测试。
- **Evidence**：S-006、S-008；通过 `test/adapters` 验证 mount/unmount 和 callback 转换。

## 决策 3：官方工具负责场景、素材和导出格式，SDK 接管所有文件动作

- **Decision**：场景保存/恢复使用安装版本导出的 `serializeAsJSON`、`loadFromBlob` 及恢复辅助函数；素材使用 `loadLibraryFromBlob`、`serializeLibraryAsJSON` 或官方 library persistence adapter；PNG 使用 `exportToBlob`，SVG 使用 `exportToSvg`。通过 `UIOptions.canvasActions` 关闭 `loadScene`、`saveToActiveFile`、`export.saveFileToDisk` 和 `saveAsImage`，避免 Excalidraw 内置浏览器文件 API 绕过 SDK。适配器从已安装类型读取真实参数，而不是复制不稳定的文档示例签名。
- **Rationale**：官方工具处理删除元素、appState 清理、图片 BinaryFiles、素材库校验和字体/尺寸细节。导出时用当前 `elements`/`appState`/`files`，选区通过元素过滤，透明背景通过 `appState.exportBackground = false`。
- **Alternatives considered**：手写 JSON、SVG 或 canvas 渲染会产生格式和图片兼容差异；依赖未锁定的文档示例可能在安装时出现类型不匹配；保留内置保存/下载动作会绕过 Treasure 权限和路径边界。
- **Evidence**：S-006、S-007、S-008；`test/contracts` 固定语义而不是固定内部函数实现。

## 决策 4：目录使用单一授权引用，保存采用最佳努力冲突保护

- **Decision**：首启通过 `files.openDialog({kind:'directory'})`、`settings.set` 和 `permissions.grantDirectory` 建立固定 `WORKSPACE_KEY`；启动时用保存的 `accessGrantId` 与 `pathHash` 调用 `verifyDirectoryGrant`，再用 `directories.list` 筛选 `.excalidraw`。打开文件后保存原始字节 SHA-256，保存前重新读取并比较；不同则提示覆盖、另存或取消，写入仍处理 SDK `CONFLICT`。
- **Rationale**：SDK 没有公开 mtime/stat，哈希是可复现且不泄露路径的最佳努力检测；父目录引用加文件名适合当前会话，跨会话不保存子文件引用。显式保存满足规格的未保存和冲突确认。
- **Alternatives considered**：静默覆盖会丢失外部修改；保存绝对路径或复用过期子文件引用违反 SDK 边界；声称强一致检测超出 SDK 能力。
- **Evidence**：S-002、S-003、S-004、S-005。

## 决策 5：素材库采用显式下载、官方校验和私有 storage 版本保留

官方入口为 [libraries.excalidraw.com](https://libraries.excalidraw.com/?target=_excalidraw&referrer=https%3A%2F%2Fexcalidraw.com%2F&useHash=true&token=aKaNGhqrPk7bmf-DlTTXc&theme=light&version=2&sort=default)。入口页面生成的 URL/hash、清单和下载内容都只在用户明确操作后使用。

- **Decision**：素材入口使用官方 library 的用户触发安装/返回 hash 流程；下载结果在进入编辑器前交给 `loadLibraryFromBlob` 校验。有效的序列化 `.excalidrawlib` 写入 `storage` 的相对键（例如 `libraries/<stableId>.excalidrawlib`），索引记录来源、版本、checksum 和状态；写入索引失败时删除新 blob 并保留上一有效版本。若 iframe/CORS 阻断远程回跳，入口提供 `files.openDialog({kind:"file"})` 选择本地 `.excalidrawlib` 的回退路径。
- **Rationale**：官方 library 处理 `.excalidrawlib` 结构和合并语义；storage 适合插件私有二进制且支持重启后离线使用。远端 URL、hash 和内容都视为不可信输入，用户取消、网络错误、格式错误或重复安装不修改当前画布。
- **Alternatives considered**：把素材写入用户绘图目录会混淆文件生命周期；只放内存无法离线；直接信任远端 JSON 会绕过格式校验；静默切换到远程 iframe 会绕过 Treasure 的网络与权限边界。
- **Evidence**：S-003、S-006、S-007；远端域名、CORS、iframe 回跳和 hash 清理列入宿主人工验证。

## 决策 6：统一执行 32 MiB 预检，不拆分用户文件

- **Decision**：在 `files.writeFile` 或 `storage.write` 前计算 `Blob`/UTF-8 字节长度；场景（含 BinaryFiles）、素材 blob、PNG/SVG 超过 32 MiB 时返回可理解的 `FILE_TOO_LARGE` 状态，保留当前脏场景和旧素材版本。
- **Rationale**：Treasure SDK 没有流式文件接口，Base64、路径或隐式拆分会改变用户格式或绕过宿主限制。用户可以缩减图片或选择较小范围后重试。
- **Alternatives considered**：自动压缩、切片或把内容写入数据库都会增加恢复复杂度并违反文件/私有 storage 边界。
- **Evidence**：S-002、S-003、S-004；尺寸边界和错误恢复由自动化测试与宿主手测分别验证。

## 决策 7：自动化覆盖适配逻辑，宿主覆盖真实权限和包生命周期

- **Decision**：Vitest 覆盖目录状态机、Result<T> 映射、场景/素材验证、hash 冲突、size guard、导出参数和 React mount/unmount；`vue-tsc`、`build`、`build:plugin`、`build:plugin:zip` 是自动门槛。Treasure 宿主手工覆盖首次授权、撤销/重选、重启离线素材、文件冲突、保存窗口取消、目录包/ZIP 导入、升级和卸载。
- **Rationale**：SDK 权限、WebView、系统窗口和插件安装流程无法由普通单元测试可靠替代；自动化仍能在不启动宿主时锁定可重复的业务边界。
- **Alternatives considered**：只做单元测试会漏掉 iframe/权限/打包问题；只做手测会让序列化和错误映射回归难以定位。
- **Evidence**：S-002、S-003、S-005；完整步骤见 `quickstart.md`。

## 仍需在实现探针中确认的接口细节

这些不是规格范围上的未决事项，而是锁定依赖后由类型检查确认的实现细节：Excalidraw 0.18.1 的 `serializeAsJSON` 参数形态、`exportToSvg` 返回值和 Vite 多插件配置。计划通过“以已安装包导出类型为准”的适配器和构建门槛吸收版本差异；若探针失败，只能在不扩大范围的前提下调整内部调用。

## 集成风险：iframe 字体和导出尺寸

当前公开 issue 报告某些导出路径在 iframe 中使用全局 `document` 获取字体，可能造成文字度量与编辑器预览不一致。计划已要求自带锁定版本的字体资源并在 PNG/SVG 手测中包含中文文字、窄窗口和重启场景；若发现差异，记录实际版本、截图和可复现步骤，在不绕过 SDK 的前提下再决定是否升级 Excalidraw 版本。该风险不改变首版范围，也不声称官方导出具有强一致像素结果。

## 决策 8：窗口菜单点击必须通过 SDK 公共 API

- **Decision**：插件只调用公开 `menus.register`、`menus.update`、`menus.subscribe`、`menus.unsubscribe` 和 `menus.unregister`。推荐事件字段为 `eventId`、`menuId`、`itemId`、宿主派生的 `pluginCode`、固定 `source: 'treasure.window-menu'`、`occurredAt` 和 `platformVersion`。订阅返回当前会话的 opaque `subscriptionId`；注销和销毁幂等。
- **Rationale**：当前 SDK 2.1.1 只有菜单注册/注销，宿主 `dispatchMenuEvent` 发送的 `treasure-menu-event` 是内部事实；直接依赖会绕过 SDK 的来源验证、生命周期和版本边界。类型化 API 可让插件获得明确的 `Result<T>` 错误和可测试的兼容分支。
- **Alternatives considered**：插件直接监听 `window.message`（违反 SDK-first 和来源边界）；在插件内复制桥接协议（与宿主实现耦合）；仅注册菜单不订阅（无法完成保存/导出动作）。
- **Current fact**：`/Volumes/MacExtend/FrontProjects/treasure-sdk/src/client.ts` 当前 `menus` 仅有 `register/unregister`；`/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts` 当前由 `dispatchMenuEvent` 投递内部消息。两者均需同步修改后才能实现本决策。
- **Compatibility**：`[Decision]` 把事件订阅、来源校验、状态更新和生命周期作为独立 capability 版本发布，建议首个 `capabilityVersion/minCapabilityVersion` 为 `1.0`；插件平台 `manifest.minPlatformVersion` 保持 2.1.0。当前 2.1.x 加载插件但菜单保持不可用；当前 bridge 对未知 operation 返回 `VALIDATION_FAILED`，SDK adapter 对已知能力缺失统一映射为 `UNSUPPORTED`，同步后的宿主应直接返回该结构化码。
- **Lifecycle**：活动 tab 切换只暂停事件投递并保留订阅，切回自动恢复；只有 iframe 销毁、卸载或 bridge 销毁才撤销。bridge 重建后的 `REFERENCE_EXPIRED` 走幂等重订阅。
- **Implementation probes**：SDK mock 覆盖订阅注册/取消、事件字段校验、重复事件去重、销毁清理；宿主手测覆盖伪造来源、错误 origin、后台 tab、重载/卸载、重复点击和版本不兼容。插件源码门禁不得出现 `treasure-menu-event`、裸 `postMessage` 或裸 `window` 监听。
