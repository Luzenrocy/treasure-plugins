# Source index

| ID | Source | Version/date | Used for |
| --- | --- | --- | --- |
| S-001 | `excalidraw/src/services/mind-map-renderer.ts` | 工作区，2026-11-02 | 当前一次性树布局、矩形/文本/曲线箭头生成方式及其边界。 |
| S-002 | `excalidraw/src/App.vue` | 工作区，2026-11-02 | 当前导入流程使用 `renderMindMap()` 和 `updateScene()`，无编辑模型。 |
| S-003 | `excalidraw/src/components/ExcalidrawCanvas.vue` | 工作区，2026-11-02 | 当前桥接层已暴露 `onChange` 与 `ExcalidrawImperativeAPI`。 |
| S-004 | `excalidraw/src/services/drawing-file-service.ts` | 工作区，2026-11-02 | 当前 `.excalidraw` 读取与序列化边界。 |
| S-005 | `excalidraw/node_modules/@excalidraw/excalidraw/dist/types/excalidraw/{types,element/types}.d.ts` | 已安装依赖 | 当前锁定 SDK 类型含 `onChange`、`updateScene` 与元素 `customData`。 |
| S-006 | `docs/excalidraw-plugin/technical-solution.md` | 工作区既有方案 | 既有插件架构、SDK/宿主边界与错误处理原则。 |
