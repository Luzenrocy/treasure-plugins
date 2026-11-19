# 图片导出契约

## 输入

`ExportRequest` 必须包含：

- `format`: `png` 或 `svg`；
- `scope`: `canvas`（全画布）或 `selection`（当前选区）；
- `transparentBackground`: 默认 `false`，用户可切换；
- 当前非删除元素和 `BinaryFiles`。

选区为空时导出操作显示可理解提示并保持当前场景。

## 处理

- PNG 使用官方 `exportToBlob`，SVG 使用官方 `exportToSvg`；选区通过元素集合过滤，全画布使用当前场景的非删除元素。
- 透明背景通过派生导出 `appState.exportBackground = false` 实现，不修改编辑器的持久化 appState。
- Excalidraw 默认 `loadScene`、`saveToActiveFile`、`export.saveFileToDisk` 和 `saveAsImage` 必须关闭，避免浏览器文件下载绕过 SDK。
- 导出 Blob/SVG 字节通过 32 MiB 守卫后调用 `files.saveDialog` 和 `files.writeFile({file, data})`；目标引用不持久化。

## 失败和覆盖

取消保存窗口不产生错误、不修改脏状态；目标已存在时由系统保存窗口或 SDK Result 要求明确覆盖/另存/取消；写入失败、图片资源缺失、超限和 `CONFLICT` 保留画布和当前文件状态。

## 验收

自动化验证 PNG/SVG、全画布/选区、透明背景、空选区、超限和取消；宿主手测验证系统保存窗口、目标覆盖、导出的文件可在系统中打开。
