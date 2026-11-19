# Treasure SDK 边界契约（round-02）

## 目的

插件所有目录、文件、私有素材、导出目标和窗口菜单操作都通过公开 `treasure-sdk` 完成。Vue/React 组件只调用本插件的 SDK adapter，不直接调用 Treasure 宿主、Tauri、浏览器文件 API、`window.postMessage` 或 `treasure-menu-event`。

## 当前事实与待同步实现

当前事实：SDK 2.1.1 已公开 `files`、`directories`、`storage`、`settings`、`permissions` 及 `menus.register/unregister`，所有调用返回 `Result<T>`；宿主 `pluginBridge.ts` 已校验请求来源并路由菜单注册/注销，但菜单点击仍由内部 `dispatchMenuEvent` 发送 `treasure-menu-event`。SDK 文档明确该反向消息不是第三方稳定 API。

`[Decision]` SDK 与 Treasure 宿主必须同步增加类型化菜单订阅、取消订阅、状态更新、事件来源校验和独立 capabilityVersion。推荐 API 与事件字段见 [menu-actions.md](menu-actions.md)。插件在公共 SDK 发布前不能实现该能力，也不得以内部消息作为临时依赖。插件 `manifest.minPlatformVersion` 继续为 2.1.0 基线；菜单能力以 `capabilityVersion/minCapabilityVersion` 独立协商，当前基线下核心绘图可用但菜单动作不可用。

## 允许调用与错误处理

| 场景 | SDK 顺序 | 结果处理 |
| --- | --- | --- |
| 首次设置目录 | `files.openDialog({kind:'directory'})` → `settings.set` → `permissions.grantDirectory` | 取消回稳定空态；失败保留场景并可重选 |
| 启动恢复目录 | `settings.get` → `permissions.verifyDirectoryGrant` → `directories.list` | 授权失效进入 `needs-reselect`，不读取路径 |
| 绘图 CRUD | `directories.list`、`files.readFile`、`files.writeFile`、`directories.remove` | 仅处理 SDK 引用；检查解析、冲突、权限、取消和大小错误 |
| 素材持久化 | 官方校验 → `storage.write/read/remove` | 使用相对键；写入索引失败时删除新 blob 并保留旧版 |
| 导出 | 官方 PNG/SVG 导出 → `files.saveDialog` → `files.writeFile({file,data})` | 一次性目标引用在成功、取消或失败后丢弃 |
| 窗口菜单 | `menus.register` → `menus.update`/`menus.subscribe` → `menus.unsubscribe` → `menus.unregister` | 失败回滚已完成步骤；`UNSUPPORTED` 显示能力不可用和重试/升级入口 |

每个调用必须检查 `Result<T>`。`CANCELLED` 是可预期结果；`PERMISSION_DENIED`、`GRANT_NOT_FOUND`、`REFERENCE_EXPIRED`、`CONFLICT`、`FILE_TOO_LARGE`、`UNSUPPORTED` 等必须映射为可恢复 UI 状态。当前旧 bridge 对未知 operation 返回 `VALIDATION_FAILED`；SDK adapter 必须依据能力探测/已知缺失情形将其统一映射为 `UNSUPPORTED`，不得把原始码直接暴露成用户提示。

## 引用与持久化不变量

- 仅保存授权摘要（`accessGrantId`、`pathHash`、显示名称）和 storage 相对键；不保存绝对路径、`DirectoryReference`、`FileReference`、菜单订阅 token 或 `ExportTarget`。
- 32 MiB 限制在 SDK 调用前预检；不得以 Base64、路径或拆分绕过。
- 菜单订阅属于当前 iframe 会话；活动 tab 切换只暂停投递并保留 token，切回自动恢复；`destroyTreasure()`、页面卸载、停用、重载和宿主销毁均必须尽力取消订阅和注销菜单。bridge 重建后的 `REFERENCE_EXPIRED` 走幂等重订阅，不得静默永久失效。
- 宿主内部事件格式、`pluginCode` payload、Tauri command 和桥接 operation 名称不是插件契约。

## 跨仓库同步清单

SDK 仓库：新增类型、`menus.subscribe/unsubscribe/update`、本地 listener registry（listener 不进入 structured-clone payload）、入站事件分发器、来源/父窗口校验、活动 tab 暂停/恢复、销毁清理、能力探测和 `VALIDATION_FAILED`→`UNSUPPORTED` 归一化、类型和 API/Bridge 文档、mock/contract tests。

Treasure 仓库：新增独立 `capabilityVersion` 能力注册表和 `minCapabilityVersion` 协商、订阅表生命周期、活动 iframe 与 origin 校验、菜单归属校验、事件去重/路由、切 tab 暂停/恢复、插件卸载清理、旧 operation 的结构化错误码和宿主手工验证证据。内部 `treasure-menu-event` 只能作为 SDK bridge 私有输入。

插件仓库：只依赖 SDK 类型化 API；增加 adapter、菜单状态同步、回调串行化、错误提示和 mock 测试；不得修改 SDK/宿主源码或复制内部桥接逻辑。

## 验收

通过 SDK mock 和类型检查验证公共调用、listener 不跨 structured clone、错误归一化和暂停/恢复；在 Treasure 中验证伪造来源、错误 origin、后台 tab 切换、重载、卸载、2.1.x capability 不可用和重复点击。源码门禁搜索插件代码不得出现 `treasure-menu-event`、裸 `postMessage`、Tauri import 和绝对路径持久化。
