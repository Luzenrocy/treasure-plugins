# 数据模型：Treasure Excalidraw 绘图插件

## DrawingDirectorySetting

| 字段 | 类型 | 持久位置 | 约束 |
| --- | --- | --- | --- |
| `permissionKey` | 固定字符串 | `manifest.json`/settings | 与 `dir.param_key` 一致，例如 `workspace_dir`；不得包含路径或授权 ID |
| `accessGrantId` | 宿主返回标识 | settings | 仅用于启动时调用 `verifyDirectoryGrant` |
| `pathHash` | 宿主返回摘要 | settings | 与授权验证配对，不还原或展示绝对路径 |
| `directoryName` | 显示名称 | settings | 只用于 UI，不能作为访问凭据 |
| `runtimeDirectory` | `DirectoryReference` | 内存 | 启动验证后取得；插件关闭、授权撤销或切换目录时失效 |

状态：`unconfigured` → `selecting` → `authorizing` → `authorized`；取消回到上一个稳定状态，授权失败或撤销进入 `needs-reselect`，当前内存场景保持不变。

## DrawingFileSession

| 字段 | 类型 | 持久位置 | 约束 |
| --- | --- | --- | --- |
| `fileName` | 文件名 | 内存/UI | 只允许 SDK 接受的安全文件名，扩展名固定 `.excalidraw` |
| `runtimeDirectory` | `DirectoryReference` | 内存 | 当前授权会话的父目录，不跨会话保存 |
| `sceneElements` | Excalidraw elements | 内存 | 由官方编辑器回调提供，保存前交给官方序列化器 |
| `appState` | Excalidraw app state | 内存 | 序列化前由官方工具清理运行态字段；导出时派生透明背景状态 |
| `binaryFiles` | Excalidraw BinaryFiles | 内存 | 与场景一起参与本地保存和大小检查 |
| `baseHash` | SHA-256 字节摘要 | 内存 | 仅用于最佳努力外部修改检测，不表示强一致锁 |
| `dirty` | 布尔值 | 内存 | 用户修改后为 `true`，成功保存后清为 `false` |
| `status` | 状态枚举 | 内存 | `new`/`loading`/`ready`/`dirty`/`saving`/`saved`/`conflict`/`error` |

生命周期：`new` → `dirty` → `saving` → `saved`；读取、保存、解析、权限或大小错误进入 `error`，不丢弃当前内存场景；切换、关闭或删除前的 `dirty` 必须先经过确认；删除文件另有 `confirming-delete` 瞬态。

## LibraryBundle

| 字段 | 类型 | 持久位置 | 约束 |
| --- | --- | --- | --- |
| `stableId` | 字符串 | storage 索引 | 来源或内容派生的稳定 ID，不能含 `/`、空段或 `..` |
| `storageKey` | 相对键 | storage | 例如 `libraries/<stableId>.excalidrawlib`；禁止绝对路径 |
| `sourceUrl` | URL 字符串 | storage 索引 | 仅记录来源和诊断，不作为本地访问路径；显示前按不可信输入处理 |
| `version` | 字符串/数字 | storage 索引 | 用于更新提示，缺失时标为未知 |
| `checksum` | 摘要 | storage 索引 | 写入前校验内容，校验失败不得替换旧版本 |
| `serializedData` | `.excalidrawlib` 字节 | storage blob | 由官方 `serializeLibraryAsJSON` 产生，单次写入不超过 32 MiB |
| `status` | `valid`/`invalid`/`updating` | storage 索引 | 更新失败保留上一有效版本并显示恢复操作 |

状态：`absent` → `downloading` → `validating` → `persisting` → `available`；取消、网络错误或格式错误回到 `absent`/旧版 `available`。

## ExportRequest 与 ExportTarget

`ExportRequest` 仅在当前操作中存在：

- `format`: `png` 或 `svg`；
- `scope`: `canvas`（全画布）或 `selection`（当前选择元素）；
- `transparentBackground`: 布尔值，首版默认 `false`，用户可切换；
- `elements`: 由当前场景派生的非删除元素集合；
- `files`: 当前场景的 BinaryFiles，用于图片资源导出。

`ExportTarget` 是 `files.saveDialog` 返回的一次性只写文件引用。写入成功、取消或失败后立即丢弃，不进入 settings、storage、数据库或运行时缓存。

## 关系和不变量

- 一个 `DrawingDirectorySetting` 在一个会话内提供零个或多个 `DrawingFileSession`，同一时刻只有一个活动编辑会话。
- 一个 `DrawingFileSession` 可以引用零个或多个 `LibraryBundle` 中的元素；素材复制进场景后，删除素材库条目不修改已保存场景。
- `.excalidraw` 是用户目录中的唯一正式绘图文件格式；`.excalidrawlib` 只用于素材导入和私有 storage。
- SDK `Result<T>` 的 `CANCELLED`、`PERMISSION_DENIED`、`GRANT_NOT_FOUND`、`REFERENCE_EXPIRED`、`INVALID_FILE_NAME`、`VALIDATION_FAILED`、`FILE_TOO_LARGE`、`IO_ERROR`、`CONFLICT`、`UNSUPPORTED` 和 `INTERNAL` 必须映射为可恢复的页面状态。
- 任何路径、子文件引用、保存窗口引用或宿主内部对象都不能写入持久化数据；只允许 settings 授权摘要和 storage 相对 key。

## MenuAction 与 MenuClickSubscription（本轮新增）

| 字段 | 类型 | 持久位置 | 约束 |
| --- | --- | --- | --- |
| `menuId` | 字符串 | 内存/宿主菜单注册 | 插件稳定前缀，例如 `excalidraw.file`；不可随会话变化 |
| `itemId` | `save`/`export` | 内存/宿主菜单注册 | 仅允许插件注册的动作 ID |
| `enabled` | 布尔值 | 内存 | 由绘图目录、脏状态、导出状态和能力状态派生 |
| `subscriptionId` | opaque 字符串 | 内存 | SDK 当前会话 token，注销后失效，不持久化；listener 只在 SDK 本地 registry 保存 |
| `capabilityVersion` | 字符串 | 宿主能力声明 | 菜单点击独立 capability 版本，不等同 manifest 平台版本 |
| `minCapabilityVersion` | 字符串 | 插件 manifest/运行时声明 | 插件要求的最低菜单 capability；建议首个稳定值为 `1.0` |
| `eventId` | 宿主生成字符串 | 事件瞬态 | 用于去重与诊断，不做业务排序 |
| `source` | 固定枚举 | 事件瞬态 | 必须为 `treasure.window-menu`，由 SDK 校验 |
| `pluginCode` | 宿主解析字符串 | 事件瞬态 | 从 `MessageEvent.source`/iframe 元数据派生，不信任 payload |
| `occurredAt` | ISO-8601 字符串 | 事件瞬态 | 宿主观测时间，不作安全判断 |
| `platformVersion` | 字符串 | 事件瞬态 | 用于 SDK/宿主兼容诊断 |

状态：`unregistered` → `registered` → `subscribed`；注册、更新、订阅或注销失败进入 `unavailable` 并保留侧边入口。活动 tab 切换时转为 `paused`（保留菜单注册、token 和本地 listener，仅暂停投递），切回后自动回到 `subscribed`；不因切换永久撤销。页面卸载、停用、重载、`destroyTreasure()` 和宿主 iframe 销毁均转为 `unregistered`，重复清理幂等。只有 SDK 公共 API 返回 `Result<T>` 成功才允许把菜单标记为可用；内部 `treasure-menu-event` 不改变状态。当前平台 2.1.x 可加载插件但 capability 不满足时保持 `unavailable`，SDK adapter 将能力缺失统一映射为 `UNSUPPORTED`。
