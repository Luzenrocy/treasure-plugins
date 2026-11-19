# Phase 0 研究记录：Treasure Excalidraw 绘图插件

## 决策 1：直接集成官方 Excalidraw 编辑器

- **决策**：在 Vue 3 插件页面中挂载官方 `@excalidraw/excalidraw` React 子树，由 Vue 适配层负责生命周期、SDK 文件边界和状态同步。
- **理由**：官方集成文档提供 React 挂载、`initialData` 和 `excalidrawAPI`；远程 iframe 无法可靠连接 Treasure SDK，重写画布会失去官方编辑器兼容性。
- **替代方案**：iframe 加载 excalidraw.com；在 Vue 中重写画布。两者分别受远程权限/网络和巨大维护成本限制。
- **来源**：[官方集成文档](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration)、[官方 API 文档](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api)。

## 决策 2：固定经过验证的 ESM 版本并锁定 peer dependencies

- **决策**：使用 `@excalidraw/excalidraw` `>=0.18.1` 的经过验证版本，并在 lockfile 中固定实际版本；补齐 React/ReactDOM peer dependencies、CSS 导入和 Vite/TypeScript ESM 配置。
- **理由**：0.18 系列已切换 ESM，旧的深层类型路径不再稳定；0.18.1 包含后续安全修复。实际兼容版本必须以安装时类型检查和构建结果为准。
- **替代方案**：使用远程网页或旧 UMD 包。前者破坏本地文件边界，后者与当前 ESM 构建不兼容。
- **来源**：[官方包 README](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/README.md)、[官方 releases](https://github.com/excalidraw/excalidraw/releases)。

## 决策 3：场景文件与素材文件分层保存

- **决策**：`.excalidraw` 场景保存到用户选择的目录；`.excalidrawlib` 经过校验后保存到插件私有 `storage` 的相对键，重启后离线可用。目录引用、保存窗口引用和子文件引用均只在运行时使用。
- **理由**：符合 Treasure 文件、目录、设置和私有存储边界，避免持久化绝对路径或失效引用。
- **替代方案**：把素材和场景都写入数据库或绘图目录。前者绕过私有二进制存储边界，后者让用户文件目录承担插件缓存生命周期。
- **来源**：`docs/PLUGIN-DEVELOPMENT-GUIDE.md` §3.3、§3.3.1、§3.3.2；`shi-yu-lu/src/utils/workspace.ts`。

## 决策 4：使用官方序列化、恢复和导出工具

- **决策**：场景使用 `serializeAsJSON`/`loadFromBlob`；素材使用 `loadLibraryFromBlob`/`serializeLibraryAsJSON`；PNG 使用 `exportToBlob`，SVG 使用 `exportToSvg`。全画布使用全部非删除元素，选区使用运行时选中元素过滤；透明背景使用 `exportBackground: false`。
- **理由**：复用官方格式、图片资源和字体处理逻辑，避免自定义 JSON 或 canvas 渲染偏差。`exportToSvg` 的返回类型随版本需以安装类型为准并统一 `await` 处理。
- **替代方案**：手写 SVG/PNG 渲染器或复制 Web 端导出实现，无法稳定覆盖图片、字体和素材状态。
- **来源**：[官方 Utils](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils)、[官方 Export Utilities](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export)、[导出源码](https://github.com/excalidraw/excalidraw/blob/master/packages/utils/src/export.ts)。

## 决策 5：目录保存采用显式保存和最佳努力冲突保护

- **决策**：单一配置目录；打开时计算当前场景文件哈希，保存前重新读取同名文件并比较哈希；变化时要求覆盖、另存或取消，并处理 SDK `CONFLICT`。SDK 不提供 mtime/stat，因此不承诺强一致外部修改检测。
- **理由**：保护用户内容，同时符合现有 SDK 引用模型；保存已打开文件使用父目录引用和文件名，另存/导出使用一次性 `saveDialog` 引用。
- **替代方案**：复用已打开的子文件引用跨会话写入或静默覆盖，会遇到 `REFERENCE_EXPIRED`、权限错误和数据丢失。
- **来源**：`docs/PLUGIN-DEVELOPMENT-GUIDE.md` §3.3、SDK API 参考及现有插件文件网关测试。

## 决策 6：限制与验证

- **决策**：场景/素材/导出字节写入前检查 32 MiB 文件与私有存储上限；自动化测试覆盖适配层和错误路径，真实 Treasure 注册、授权、目录/ZIP 导入和卸载由人工验证。
- **理由**：宿主不提供流式文件接口，不能用 Base64 绕过限制；自动化不能伪造宿主行为。
- **替代方案**：超限后隐式压缩或拆分文件会改变用户文件格式，且无法保证恢复一致性。
- **来源**：`docs/PLUGIN-DEVELOPMENT-GUIDE.md` §3.3、§6、§7、§9。
