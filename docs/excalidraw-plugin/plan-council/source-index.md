# Source index

| ID | Source | Version/date | Used for |
| --- | --- | --- | --- |
| S-001 | `specs/004-excalidraw-plugin/spec.md` | 2026-10-16 | 已确认的范围、FR-001..FR-016、SC-001..SC-006、非目标与澄清 |
| S-002 | `.specify/memory/constitution.md` | v1.3.0, 2026-10-15 | SDK-first、权限/路径、Vue/Vite、质量门槛和中文文档原则 |
| S-003 | `docs/PLUGIN-DEVELOPMENT-GUIDE.md` | 当前仓库版本 | SDK 文件/目录/存储流程、32 MiB 限制、构建和宿主验证 |
| S-004 | `/Volumes/MacExtend/FrontProjects/treasure-sdk/docs/API-REFERENCE.md` | SDK 2.1.1 | Result<T>、目录授权、文件读写、storage 与 saveDialog 类型边界 |
| S-005 | `json-formatter/`, `text-diff/`, `shi-yu-lu/` | 当前仓库版本 | Vue + Vite + TypeScript + Vitest 插件结构、目录授权实践和打包脚本 |
| S-006 | [Excalidraw 官方集成文档](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration) | 访问 2026-10-16 | React 挂载、initialData、excalidrawAPI 和 CSS/容器要求 |
| S-007 | [Excalidraw 官方 Utils](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils) 与 [Export Utilities](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export) | 访问 2026-10-16 | 场景/素材序列化、恢复和 PNG/SVG 导出 API |
| S-008 | [Excalidraw v0.18.1 release](https://github.com/excalidraw/excalidraw/releases) 与 [package README](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/README.md) | 访问 2026-10-16 | ESM 迁移、React peer 版本和 Mermaid XSS 修复版本基线 |
| S-009 | `docs/excalidraw-plugin/council/rounds/round-03/{research.md,data-model.md,quickstart.md}` | 2026-10-16 | 先前研究线索；本轮重新核对并纳入正式 Phase 0/1 输出 |
| S-010 | 用户早期反馈中的 Excalidraw 官方素材库页面（历史证据） | 记录 2026-10-16；当前实现不依赖 | 仅说明为何改为预配置官方 API；不得作为页面跳转、任意 URL 或回跳协议的实现来源 |
| S-011 | `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/client.ts`、`docs/API-REFERENCE.md`、`docs/BRIDGE-PROTOCOL.md` | 2026-10-18 | 当前仅公开菜单注册/注销；确认缺少类型化点击订阅，并约束 SDK 公共 API 设计 |
| S-012 | `/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts` | 2026-10-18 | 当前宿主内部菜单事件发送路径；用于定义 SDK/宿主同步改造边界，不作为插件可依赖契约 |
