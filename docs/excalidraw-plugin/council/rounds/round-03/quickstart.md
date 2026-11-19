# Quickstart：Treasure Excalidraw 插件验证

## 前置条件

- 已安装 Node.js、npm、Treasure 宿主和本仓库依赖。
- 已在 `excalidraw-plugin/` 安装依赖，并锁定经验证的 Excalidraw 版本。
- 能启动 Treasure 桌面宿主，或能在 Treasure 源码目录运行 `npm run tauri -- dev`。

## 自动化检查

在插件目录执行：

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run build:plugin
npm run build:plugin:zip
```

单元测试必须覆盖：目录授权状态机、`Result<T>` 错误映射、`.excalidraw` 读取/序列化、32 MiB
限制、显式保存与哈希冲突、素材 storage 写入/回滚、PNG/SVG 导出范围和透明背景。

## Treasure 宿主手工验证

1. 运行 `npm run dev`，在 Treasure 插件中心注册开发地址。
2. 首次选择目录，确认设置保存授权摘要，重启后能重新验证并列出 `.excalidraw` 文件。
3. 新建、打开、编辑、显式保存和删除文件；取消删除、取消保存、权限撤销和目录切换失败时确认当前场景仍在内存中。
4. 修改目录中的同名文件后保存，确认出现覆盖/另存/取消选择，且 SDK `CONFLICT` 不会丢失内容。
5. 从官方素材库安装 `.excalidrawlib`，重启插件后离线插入素材；损坏或网络失败时旧素材仍可用。
6. 导出 PNG/SVG 的全画布与选区，分别验证透明背景开关、保存窗口取消、超 32 MiB 和写入失败。
7. 执行 `npm run build:plugin` 与 `npm run build:plugin:zip`，分别导入目录包和 ZIP，验证 manifest、入口标识、安装、升级、卸载和失败提示。

## 证据记录

每个场景记录插件版本、宿主版本、系统、窗口尺寸、输入文件/素材、操作结果、错误码和必要截图。
自动化结果与宿主手工结果分开记录。
