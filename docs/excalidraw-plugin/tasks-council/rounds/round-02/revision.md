# Round 02 修订记录

日期：2026-10-20

本轮以当前 `spec.md`、已发布 `plan.md` 和设计契约重新生成任务清单。上一版任务清单把本地绘图、素材库和导出重新编号为 US1/US2/US3，并将所有任务标记为已完成；该状态与当前待实施计划不一致，因此候选稿将全部任务重置为 `[ ]`，按当前规格的四个 P1 用户故事重新组织。

本轮新增或修订：

- 增加 SDK、Treasure 宿主和插件三方同步的公开菜单 capability 前置任务，覆盖 `register/update/subscribe/unsubscribe/unregister`、listener registry、来源校验、能力版本和 `UNSUPPORTED` 语义。
- 明确插件只能通过公开 `treasure-sdk` 使用菜单，不读取 `window`、调用 `postMessage` 或匹配内部 `treasure-menu-event`。
- 将宿主 contract tests 保留为源码/单元测试任务，将宿主 GUI、权限、系统窗口、菜单实际点击、导入、重启和卸载验证明确交给用户手工执行。
- 将页面无标题行、File 菜单保存/导出列为 US1 MVP；将统一折叠侧边导航列为 US2；官方预配置素材接口、阶段进度和临时包清理列为 US3；首版核心绘图与 PNG/SVG 导出回归列为 US4。
- 用 `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/...` 和 `/Volumes/MacExtend/FrontProjects/treasure/src/...` 标明跨仓库变更位置，不把 SDK/宿主源码复制到插件目录。

评审后修订确认：

- 保留 SDK/宿主源码级 contract tests，但在任务、Polish 和说明中重复标注不执行宿主 GUI 运行验证，避免把用户手工职责变成代理任务。
- 明确 `treasure-menu-event` 只在宿主内部兼容实现中出现；插件源码扫描任务禁止读取或匹配该名称。
- 在 US4 目标、独立验收和依赖关系中注明其复用 US1 的本地绘图、文件生命周期和 App/画布集成，防止导出任务被误解为替代核心绘图。
