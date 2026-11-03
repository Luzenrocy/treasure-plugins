# Excalidraw Treasure 插件

这是一个以官方 `@excalidraw/excalidraw@0.18.1` 为画布内核的 Treasure 绘图插件。Vue 外壳只负责状态和浮层面板，React 适配层负责画布生命周期；文件、目录授权、私有素材和导出目标全部通过 `treasure-sdk` 的引用与 `Result<T>` API 完成。

主要能力：

- 顶部右侧通过 `renderTopRightUI` 在 Excalidraw 原生 UIOptions 区域旁提供“素材库”按钮，并隐藏锁定版本的原生素材库入口。
- `workspace_dir` 目录中的 `.excalidraw` 文件支持列举、打开、新建和显式保存；损坏文件不会清空当前画布。
- 受控读取官方 `libraries.json`，查询/筛选/排序/分页在本地完成；素材包校验后写入 `storage`，可离线恢复。
- PNG/SVG 导出使用 Excalidraw 官方导出工具，再交给 Treasure 系统保存窗口写入。

插件私有存储只使用 `libraries/` 相对键；不保存操作系统路径、运行时文件引用或任意远端 URL。

## 验证

```bash
npm install
npm run typecheck
npm test
npm run build
```
