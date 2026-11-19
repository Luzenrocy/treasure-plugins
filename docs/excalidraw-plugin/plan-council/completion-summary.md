# 完成摘要

- 最终计划：[specs/004-excalidraw-plugin/plan.md](../../../specs/004-excalidraw-plugin/plan.md)
- Phase 0/1 工件：`research.md`、`data-model.md`、`quickstart.md` 和 `contracts/` 下五份契约。
- 用户新增决定：窗口菜单点击能力通过公开 `treasure-sdk` 提供；SDK 与 Treasure 宿主同步实现；插件不直接依赖 `treasure-menu-event`。
- 公开能力方案：`menus.register/update/subscribe/unsubscribe/unregister`，SDK 本地 listener registry，宿主来源校验、去重、活动 tab 暂停/恢复和销毁清理；菜单 capability 与 `manifest.minPlatformVersion` 分离。
- 当前事实：SDK 2.1.1 仅有菜单注册/注销；宿主内部事件和旧 bridge 错误码均记录为待迁移兼容事实，不被插件当作公共 API。
- 写作工坊轮次：round-01 已发布；round-02 经 reviewer 修订后由 approver `approve`，ledger v2。
- 宿主手工验证仍由用户执行，未列入代理任务清单。
