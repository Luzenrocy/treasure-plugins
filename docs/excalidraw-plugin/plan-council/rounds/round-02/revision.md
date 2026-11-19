# Revision 2

本轮根据新增决定 U-010 对计划和 Phase 0/1 工件做同步修订：

- 将窗口菜单点击从宿主内部 `treasure-menu-event` 提升为 `treasure-sdk` 公共能力边界。插件只调用类型化的注册、状态更新、订阅、取消订阅和注销 API；内部事件仅保留为 SDK bridge 的实现事实。
- 新增 `contracts/menu-actions.md`，给出推荐 API、事件字段、来源校验、活动 iframe 路由、去重、生命周期和版本兼容语义；新增/更新 `contracts/treasure-sdk-boundary.md`，列出 SDK、Treasure 宿主和插件三方同步清单。
- 在 `plan.md` 的 Summary、Technical Context、Constitution Check、Project Structure、Phase 0、Phase 1 和规格追踪中加入 FR-018..FR-020/SC-007 的实现与验证位置；菜单能力标为 SDK/宿主同步实现门槛，平台 `minPlatformVersion` 保持 2.1.0，独立 capability 建议版本 1.0。
- 在 `research.md`、`data-model.md` 和 `quickstart.md` 中补充当前事实与待同步实现的区分、菜单状态实体、mock/源码门禁和宿主手工验收。
- 将完整 `plan.md`、全部 Phase 0/1 工件和新增菜单契约复制到 `round-02/artifacts/`，没有直接修改 `specs/004-excalidraw-plugin/` 目标文件。

尚未声称 SDK/宿主改造已经完成；实现阶段必须先发布并验证公共契约，再接入插件。

## Reviewer 修订（R2-001..R2-005）

- **R2-001（P0）已修复**：`menus.subscribe` 仍向插件暴露 listener，但明确 listener 只进入 SDK iframe 内的本地 registry；bridge 仅发送可 structured-clone 的 filter/token。新增入站事件层、token 路由、来源校验和销毁清理要求，并加入函数不得进入 payload 的测试。
- **R2-002（P0）已修复**：移除“宿主 2.2.0 作为最低平台”的矛盾。插件 `manifest.minPlatformVersion` 保持 2.1.0；菜单点击以独立 `capabilityVersion/minCapabilityVersion` 协商，建议首个稳定值 1.0。当前 2.1.x 可加载核心插件但菜单保持不可用，待 SDK/宿主发布 capability 后启用。
- **R2-003（P1）已修复**：记录当前旧 bridge 对未知 operation 返回 `VALIDATION_FAILED` 的事实；SDK adapter 对已知能力缺失统一映射为 `UNSUPPORTED`，并要求同步宿主直接返回结构化不支持错误。quickstart 同时验证旧宿主事实和同步后行为。
- **R2-004（P1）已修复**：计划范围、规格追踪、coverage 和 quickstart 增加 FR-028/SC-011，明确不改变核心绘图、文件/导出格式或宿主全局菜单，且本轮不包含直接实现和代理代跑宿主测试。
- **R2-005（P1）已修复**：活动 tab 切换改为暂停投递、保留订阅与菜单，切回自动恢复；仅 iframe/bridge 销毁、卸载或重载撤销。定义 `REFERENCE_EXPIRED` 后的幂等重订阅、状态恢复和“恰有一个订阅”验收。

同步更新了 round-02 根工件及 `artifacts/` 下的 plan、research、data-model、quickstart 和两个菜单契约；未修改 `specs/004-excalidraw-plugin/` 目标文件。
