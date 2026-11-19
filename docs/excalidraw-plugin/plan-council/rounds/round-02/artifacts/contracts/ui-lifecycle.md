# Vue 与 React 生命周期及界面契约

## 挂载边界

- `ExcalidrawCanvas.vue` 在 `onMounted` 创建一次 React root，并以 `React.createElement` 渲染官方 `Excalidraw`；所有 props 和 callback 通过 `adapters/excalidraw-react.ts` 明确转换。
- 组件卸载或切换插件时在 `onBeforeUnmount` 调用 `root.unmount()`，取消未完成的网络/读写回调，避免旧场景写回新会话。
- 画布父容器有明确的非零宽高；页面根节点隐藏溢出，唯一主要业务区承担滚动，滚动条遵循研发指南。

## 状态和控件

- 页面必须表达空态、加载、保存中、已保存、未保存、冲突、读取失败、素材失败和导出失败；错误操作保留可恢复按钮和当前内存场景。
- 文件列表、新建/删除、素材入口、保存、导出和确认弹窗使用语义控件、稳定焦点顺序和无障碍名称；核心画布工具依赖 Excalidraw 键盘能力，宿主工具栏不重复渲染同一动作。
- React 编辑器设置 `langCode` 为中文，省略协作相关 props；隐藏会触发浏览器文件 API 或非目标云端能力的菜单动作。插件不注册、不显示实时协作、账户登录、分享链接、云端同步或 Excalidraw+ 入口；若锁定版本仍暴露不可配置的入口，必须在宿主手测记录并在 UI 适配层遮蔽。

## 验收

使用 Vue 组件测试和人工键盘巡检确认 mount/unmount 只发生一次、状态过渡不丢场景、按钮有名称、焦点可见、窗口窄化时不出现 body 双滚动条。
