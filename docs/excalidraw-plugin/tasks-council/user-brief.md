# User brief

> [$speckit-tasks](/Volumes/MacExtend/FrontProjects/treasure-plugins/.agents/skills/speckit-tasks/SKILL.md) [$writing-workshop](/Users/luzenrocy/.codex/skills/writing-workshop/SKILL.md)

Captured: 2026-10-16 Asia/Shanghai
Source: user message in the active Codex task

## Source feature context

The task list consumes the published feature specification and implementation plan at `specs/004-excalidraw-plugin/spec.md` and `specs/004-excalidraw-plugin/plan.md`, including the four confirmed user scenarios: local drawing/file lifecycle, official library import and offline use, and PNG/SVG export.

## Amendments

### 2026-10-20

基于已更新的 `plan.md` 重新生成任务清单。新增跨仓库菜单能力要求：窗口菜单点击通过公开 `treasure-sdk` 提供，SDK 与 Treasure 宿主同步调整；插件不得直接依赖 `treasure-menu-event`。任务清单必须覆盖菜单公共 API、SDK/宿主同步契约、能力版本兼容和插件侧接入门槛，并继续遵守“宿主运行测试由用户手工执行”的边界。

### 2026-10-20（分析修订反馈）

用户确认按分析报告修订相关文档：在 T042 前增加官方 API 契约确认阻塞门；Quickstart 改为预配置官方 API 调用并删除页面跳转/回跳表述；补充本地 `.excalidrawlib` 选择、读取、校验、安装及测试；将 `SidebarNav.vue`、`official-library-client.ts` 等新增文件补入计划结构；增加工具支持矩阵；将性能目标明确为设计约束并说明不设置量化验收；补充 SDK/宿主实际测试命令；更新文档日期并标识历史验证证据的提交/版本状态。
