# Treasure SDK 边界契约

## 目的

所有用户目录、文件、私有素材、导出目标和窗口菜单操作都通过公开 `treasure-sdk` 完成。Vue/React 组件只能调用本契约定义的服务，不得直接调用宿主、Tauri、浏览器文件 API 或宿主内部消息。

## 允许的调用

| 场景 | SDK 顺序 | 结果处理 |
| --- | --- | --- |
| 首次设置目录 | `files.openDialog({kind: 'directory'})` → `settings.set({key, directory})` → `permissions.grantDirectory({permissionKey, directory})` | 取消返回稳定空态；授权失败保留当前场景并显示重选 |
| 启动恢复目录 | `settings.get(key)` → `permissions.verifyDirectoryGrant(...)` → `directories.list(directory)` | `GRANT_NOT_FOUND`/`PERMISSION_DENIED` 进入 `needs-reselect`；不读取路径 |
| 列出绘图 | `directories.list(directory)` | 只显示 `kind=file` 且名称以 `.excalidraw` 结尾的条目；解析错误可重试 |
| 打开绘图 | `files.readFile(file)` | 检查 `Result<T>`，交给官方 `loadFromBlob`；失败不清空当前场景 |
| 保存绘图 | 重新读取并比较 hash → `files.writeFile({directory, fileName, data})` | 同名/外部修改要求确认；处理 `CONFLICT`、`FILE_TOO_LARGE` 和授权错误 |
| 删除绘图 | 确认 → `directories.remove` 或 SDK 公开删除方法 | 取消不修改目录；失败保留列表和当前场景 |
| 导入素材 | 远程用户触发或 `files.openDialog({kind:'file'})` → `files.readFile` | 先 `loadLibraryFromBlob` 校验，再写 storage；失败保留旧版本 |
| 导出图片 | 官方导出工具 → `files.saveDialog` → `files.writeFile({file,data})` | 取消丢弃一次性引用；失败不修改画布 |

## 不变量

- 每个方法都检查 `Result<T>` 的 `ok` 和错误码；`CANCELLED` 是可预期的正常结束，不当作异常崩溃。
- 只保存 `accessGrantId`、`pathHash`、显示名称和 storage 相对键；不保存绝对路径、子文件引用、`FileReference`、`DirectoryReference` 或 `ExportTarget`。
- 单文件和私有 storage 单次读写超过 32 MiB 时在 SDK 调用前拒绝，并保留恢复动作。
- `files.saveDialog` 返回的一次性写引用只用于本次导出，成功、取消或失败后立即丢弃。
- 错误映射至少覆盖 `CANCELLED`、`NOT_FOUND`、`PERMISSION_DENIED`、`GRANT_NOT_FOUND`、`REFERENCE_EXPIRED`、`INVALID_FILE_NAME`、`VALIDATION_FAILED`、`FILE_TOO_LARGE`、`IO_ERROR`、`CONFLICT`、`UNSUPPORTED` 和 `INTERNAL`。

## 窗口菜单公共边界

`[Decision]` SDK 与 Treasure 宿主必须同步增加类型化菜单订阅、取消订阅、状态更新、事件来源校验和独立 `capabilityVersion`。推荐 API 与事件字段见 [menu-actions.md](menu-actions.md)。插件 `manifest.minPlatformVersion` 继续为 2.1.0 基线；菜单能力独立协商，当前基线下核心绘图可用但菜单动作保持不可用。

- 推荐公开方法：`menus.register`、`menus.update`、`menus.subscribe`、`menus.unsubscribe`、`menus.unregister`，每次调用均返回 `Result<T>`。
- `subscribe` 的 listener 只保存在 SDK iframe 内的本地 registry；跨窗口 payload 只传可 structured-clone 的 filter/token，不传函数。
- SDK bridge 和宿主必须校验父窗口、登记 origin、活动 iframe、菜单归属、固定 `source`、事件字段类型和 `eventId` 去重；插件不得信任 payload 中的 `pluginCode`。
- 当前旧 bridge 对未知 operation 返回 `VALIDATION_FAILED`；SDK adapter 对已知能力缺失统一映射为 `UNSUPPORTED`，同步后的宿主应直接返回结构化不支持错误。
- 活动 tab 切换只暂停投递并保留订阅和菜单，切回自动恢复；`REFERENCE_EXPIRED` 走幂等重订阅。只有页面/iframe 销毁、插件卸载或 bridge 销毁才撤销订阅。
- `treasure-menu-event` 只能作为 SDK bridge 的私有输入，插件源码不得出现该消息、裸 `postMessage` 或 `window` 消息监听。

### SDK/宿主同步清单

- SDK：新增类型、菜单更新/订阅/取消订阅、本地 listener registry、入站事件分发、来源校验、能力探测、错误归一化、API/Bridge 文档和 mock/contract tests。
- Treasure 宿主：新增独立 capability 注册表、订阅生命周期、活动 iframe/origin/菜单归属校验、事件去重/路由、切 tab 暂停/恢复、插件卸载清理和结构化 `UNSUPPORTED` 响应；内部事件只作为 SDK bridge 私有输入。
- 插件：在公共 SDK 能力发布并通过能力探测后注册 `excalidraw.file` 的 `save`/`export`，失败时保持菜单不可用并显示重试/升级提示，不使用内部通道兜底。

## 验收

使用 mock `Result<T>` 验证每个错误码的 UI 状态和回滚；使用 SDK mock 验证 listener 不跨 structured clone、订阅清理、错误归一化和活动 tab 暂停/恢复；在 Treasure 宿主验证授权撤销、重启、目录包与 ZIP 导入、保存窗口取消、伪造来源拒绝、重载/卸载清理和当前 2.1.x 的菜单能力不可用提示。宿主手工验证由用户执行。
