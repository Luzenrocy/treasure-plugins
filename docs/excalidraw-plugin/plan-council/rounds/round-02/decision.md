verdict: approve
round: 2
rules_snapshot: docs/excalidraw-plugin/plan-council/rules-snapshot.yaml
ledger_version: 2
target_path: specs/004-excalidraw-plugin/plan.md
summary: "round-02 候选计划及 Phase 0/1 工件满足 U-001..U-010、constitution v1.4.0 与 clean-final 契约；可发布到精确目标路径，并由后续发布步骤同步配套工件。"
coverage_status: complete
blocking_items: []
findings:
  - id: R2-001
    disposition: fixed
    rationale: "menus.subscribe 的 listener 明确只进入 SDK 本地 listener registry；bridge 只发送可 structured-clone 的 filter/token，并定义入站事件层、token 路由、来源校验、去重和销毁清理。当前 SDK/宿主尚未实现该公共能力，候选工件未把它误写成已发布事实。"
    evidence: "round-02/artifacts/contracts/menu-actions.md；round-02/artifacts/contracts/treasure-sdk-boundary.md；round-02/artifacts/research.md#决策-8"
    acceptance_check: "SDK 类型/bridge mock 证明 payload 不含函数，覆盖 subscribe/unsubscribe、重复事件和 destroyTreasure 清理；插件源码门禁无裸 postMessage/window 监听。"
  - id: R2-002
    disposition: fixed
    rationale: "manifest.minPlatformVersion 保持当前 2.1.0；菜单点击采用独立 capabilityVersion/minCapabilityVersion（建议 1.0），2.1.x 可加载核心绘图但菜单能力保持不可用。未将 capability 版本伪装成平台版本，也未宣称同步版本已发布。"
    evidence: "round-02/artifacts/plan.md#Technical-Context；round-02/artifacts/contracts/menu-actions.md#版本兼容；round-02/artifacts/quickstart.md"
    acceptance_check: "SDK/宿主发布前后分别验证 2.1.x 不可用矩阵和同步 capability 的注册、update、subscribe、unsubscribe、unregister；最终字段名仍按实现前 SDK/宿主确认。"
  - id: R2-003
    disposition: fixed
    rationale: "候选工件区分当前宿主未知 operation 返回 VALIDATION_FAILED 的事实与未来兼容语义；要求 SDK adapter 对已知能力缺失归一为 UNSUPPORTED，并要求同步宿主返回结构化不支持码，不以内部事件回退。"
    evidence: "round-02/artifacts/research.md#决策-8；round-02/artifacts/contracts/menu-actions.md#版本兼容；round-02/artifacts/quickstart.md#前置条件"
    acceptance_check: "对当前旧宿主和同步后宿主各执行 bridge contract test，核对错误码、UI 提示、重试/升级入口一致。"
  - id: R2-004
    disposition: fixed
    rationale: "计划、追踪表、coverage 与 quickstart 均列出 FR-028/SC-011，并明确核心绘图、既定文件/导出格式和宿主全局菜单不变；本轮只交付规格、计划、契约和验证工件，不把直接实现或代理代跑宿主测试写入任务。"
    evidence: "round-02/artifacts/plan.md#规格追踪；round-02/coverage.yaml；round-02/artifacts/quickstart.md#Treasure-宿主手工验证"
    acceptance_check: "coverage 覆盖 FR-001..FR-028、SC-001..SC-011；speckit-tasks 输入不包含直接实现或宿主运行测试代理任务。"
  - id: R2-005
    disposition: fixed
    rationale: "活动 tab 切换定义为暂停投递并保留注册、subscription token 与本地 listener；切回自动恢复，不创建第二订阅。仅 iframe/bridge 销毁、卸载或重载撤销，并定义 REFERENCE_EXPIRED 后的幂等重订阅。"
    evidence: "round-02/artifacts/data-model.md#MenuAction-与-MenuClickSubscription；round-02/artifacts/contracts/menu-actions.md#生命周期；round-02/artifacts/quickstart.md#步骤-8"
    acceptance_check: "宿主手测覆盖切出/切回、重载、卸载和重复重试，确认恰有一个有效订阅和一个菜单注册，点击无重复回调或并发覆盖。"
  - id: U-010
    disposition: satisfied
    rationale: "窗口菜单点击已明确为 treasure-sdk 公共能力；SDK、Treasure 宿主和插件三方同步清单齐全，插件不依赖 treasure-menu-event。"
    evidence: "round-02/artifacts/plan.md#Summary；round-02/artifacts/contracts/treasure-sdk-boundary.md；round-02/artifacts/contracts/menu-actions.md；round-02/artifacts/quickstart.md"
    acceptance_check: "SDK mock、源码门禁和用户执行的宿主 capability 验收完成后，才可在实现阶段启用菜单动作。"
  - id: CONSTITUTION-1.4.0
    disposition: satisfied
    rationale: "Constitution Check 前后均保留 SDK-first、Result<T>、权限/32 MiB、Vue/Element Plus/Vite、无障碍、中文文档和发布验证门槛；跨仓库 API 作为 implementation gate，不复制宿主源码。"
    evidence: "round-02/artifacts/plan.md#Constitution-Check；round-02/artifacts/plan.md#Post-Design-Constitution-Check；.specify/memory/constitution.md v1.4.0"
    acceptance_check: "发布前保持 Phase 0/1 工件、路径、语言和验证矩阵一致。"
  - id: CURRENT-FACTS
    disposition: satisfied
    rationale: "直接核对当前 SDK 2.1.1 src/client.ts、ProductionBridge、API/Bridge 文档及 Treasure pluginBridge.ts：现状仅公开 menus.register/unregister，宿主 dispatchMenuEvent 发送内部事件，未知 operation 返回 VALIDATION_FAILED。候选文本均将新增 API、listener registry、来源校验、暂停恢复和 capability 作为待同步设计，不宣称已实现。"
    evidence: "/Volumes/MacExtend/FrontProjects/treasure-sdk/src/client.ts；/Volumes/MacExtend/FrontProjects/treasure-sdk/src/bridge-impl/production.ts；/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts:81-82,187-192,612"
    acceptance_check: "实现阶段先完成 SDK/宿主公共契约和 bridge contract tests，再接入插件。"
  - id: CLEAN-FINAL
    disposition: satisfied
    rationale: "round-02/artifacts/plan.md 及 Phase 0/1 工件为中文、可执行的 clean-final；无角色讨论、隐藏推理、完整实现代码或 speckit-tasks 任务清单。目标路径精确为 specs/004-excalidraw-plugin/plan.md，过程工件与目标分离。"
    evidence: "round-02/input-snapshot.yaml；round-02/artifacts/plan.md；round-02/artifacts/research.md；round-02/artifacts/data-model.md；round-02/artifacts/quickstart.md；round-02/coverage.yaml"
    acceptance_check: "仅在本 approve 后执行目标路径发布，并记录发布版本、规则快照、ledger v2 与验证结果。"
