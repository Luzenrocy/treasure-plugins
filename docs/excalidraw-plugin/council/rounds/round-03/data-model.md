# 数据模型：Treasure Excalidraw 绘图插件

## DrawingDirectorySetting

| 字段 | 类型 | 持久位置 | 约束 |
|---|---|---|---|
| `permissionKey` | 固定字符串 | manifest/settings | 与 `dir.param_key` 一致，不得包含路径或授权 ID |
| `accessGrantId` | 宿主返回的标识 | settings | 仅用于启动时验证 |
| `pathHash` | 宿主返回的摘要 | settings | 与授权验证配对，不还原路径 |
| `directoryName` | 显示名称 | settings | 仅用于 UI 提示 |
| `runtimeDirectory` | DirectoryReference | 内存 | 每次启动验证后重新取得，不能写入持久化数据 |

状态：`unconfigured` → `selecting` → `authorizing` → `authorized`；授权失败或撤销进入
`needs-reselect`，当前编辑场景仍保留在内存中。

## DrawingFile

| 字段 | 类型 | 持久位置 | 约束 |
|---|---|---|---|
| `relativeName` | 文件名 | 内存/UI | 只允许安全文件名，正式扩展名为 `.excalidraw` |
| `runtimeReference` | FileReference/DirectoryReference + 文件名 | 内存 | 子文件引用不跨会话复用 |
| `sceneElements` | Excalidraw elements | 内存 | 通过官方 API 读取/更新 |
| `appState` | Excalidraw app state | 内存 | 序列化前移除不应持久化的运行态字段 |
| `binaryFiles` | Excalidraw BinaryFiles | 内存 | 与场景一起序列化，受 32 MiB 限制 |
| `baseHash` | SHA-256 字节摘要 | 内存 | 用于最佳努力外部修改检测，不声称强一致 |
| `dirty` | 布尔值 | 内存 | 显式保存后清除 |

生命周期：`new` → `dirty` → `saving` → `saved`；读取/保存失败进入 `error`，不丢弃当前
内存场景；删除前必须经过 `confirming-delete`。

## LibraryBundle

| 字段 | 类型 | 持久位置 | 约束 |
|---|---|---|---|
| `stableId` | 字符串 | storage key/index | 来源或内容生成的稳定 ID |
| `storageKey` | 相对键 | storage | 例如 `libraries/<stableId>.excalidrawlib`，禁止绝对路径、空段和 `..` |
| `sourceUrl` | 字符串 | 索引元数据 | 仅记录远端来源，不作为本地访问路径 |
| `version` | 字符串/数字 | 索引元数据 | 用于更新提示 |
| `checksum` | 摘要 | 索引元数据 | 导入前校验，校验失败不替换旧版本 |
| `status` | `valid`/`invalid`/`updating` | 索引元数据 | 损坏或更新失败保留上一有效版本 |

## ExportRequest 与 ExportTarget

`ExportRequest` 仅在当前操作中存在，包含 `format`（`png`/`svg`）、`scope`
（`canvas`/`selection`）、`transparentBackground` 和 `elements`。`ExportTarget` 是
`files.saveDialog` 返回的一次性只写引用；写入完成或取消后立即丢弃，不持久化。

## 约束

- `.excalidraw` 是用户绘图目录中的唯一正式文件格式；`.excalidrawlib` 只进入插件私有素材库。
- 所有文件/目录引用均为 SDK 凭据；插件不构造、保存或展示绝对路径。
- 所有 SDK `Result<T>` 都必须处理 `CANCELLED`、`PERMISSION_DENIED`、`REFERENCE_EXPIRED`、
  `CONFLICT`、`FILE_TOO_LARGE`、`IO_ERROR` 等错误。
