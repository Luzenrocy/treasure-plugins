# Excalidraw 场景与素材契约

## 绘图文件

- 正式绘图文件扩展名为 `.excalidraw`，内容类型按锁定版本的 `MIME_TYPES.excalidraw`（`application/vnd.excalidraw+json`）和场景版本校验；目录列表不得把 `.excalidrawlib` 或其他扩展名当作绘图。
- 当前场景由 `elements`、`appState` 和 `BinaryFiles` 组成。保存使用锁定的 `@excalidraw/excalidraw@0.18.1` 导出序列化函数，调用参数以安装包类型为准，并使用本地文件语义，使图片数据能随场景恢复。
- 打开时把 SDK 字节包装为 `Blob` 交给官方 `loadFromBlob`；类型、版本或 JSON 校验失败时显示可恢复错误，不替换当前内存场景。
- 官方工具负责过滤删除元素和不应持久化的运行态字段；插件不得手写场景 JSON 或调用浏览器 `fileOpen`/`fileSave`。

## 素材库

- `.excalidrawlib` 只作为素材导入格式，内容类型按锁定版本的 `MIME_TYPES.excalidrawlib`（`application/vnd.excalidrawlib+json`）和库版本校验。远程 URL、hash、manifest 和下载字节是用户触发的不可信输入。
- 导入前使用 `loadLibraryFromBlob` 校验版本和元素结构；成功后通过 `serializeLibraryAsJSON`（或锁定版本提供的 library persistence adapter）写入 storage 相对键。
- storage 索引记录 `stableId`、来源、版本、checksum、状态和相对键；新版本写入索引失败时删除新 blob，保留上一有效版本。
- 插件重启后从索引和 storage 恢复素材，网络不可用时仍能插入已有素材；删除素材不会删除已经复制进绘图场景的元素。
- 远程回跳被 iframe/CORS 阻断时，入口必须提供用户选择本地 `.excalidrawlib` 文件的 SDK 导入回退，并给出重试或取消路径。

## 大小和失败

- 场景（包括图片 BinaryFiles）、素材 blob 和导出结果在写入前执行 32 MiB 字节预检；超过限制返回 `FILE_TOO_LARGE`，不拆分、不 Base64 绕过、不覆盖旧数据。
- SDK 读写错误、解析异常、网络失败、取消和重复安装都不能清空当前画布或上一有效素材版本。

## 验收

自动化验证有效/损坏/空场景、版本不兼容、图片资源、库版本 1/2、大小边界和回滚；宿主手测验证重启离线素材、官方库回跳和本地文件回退。
