# Round 02 Review

审查对象：`round-02/input-snapshot.yaml`、requirements ledger v2、adaptive contract、rules snapshot、source-index、`draft.md`、Phase 0/1 工件、`artifacts/plan.md` 与 `artifacts/contracts/*`。

核对基线：`.specify/memory/constitution.md` v1.4.0、`specs/004-excalidraw-plugin/spec.md`、当前 `/Volumes/MacExtend/FrontProjects/treasure-sdk` 的 `src/client.ts`、`src/bridge-impl/production.ts`、API/Bridge 文档，以及 `/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts`。候选工件未修改。

## Findings

### R2-001 — P0 — `menus.subscribe` 的推荐签名不能直接穿过现有 SDK bridge

- **位置**：`round-02/contracts/menu-actions.md:35-42`、`artifacts/contracts/menu-actions.md:35-42`；SDK `/Volumes/MacExtend/FrontProjects/treasure-sdk/src/bridge-impl/production.ts:37-49`、`src/client.ts:65-102`。
- **证据**：契约把 `(filter, listener: (event) => void)` 作为公开调用参数；当前 `ProductionBridge.send()` 将 `payload` 原样交给 `window.parent.postMessage`，而 structured clone 不能序列化函数。当前 `createClient` 的 transport 也只接受将要发送的 `unknown` payload，没有本地 listener registry 或入站菜单事件分发层。
- **影响**：按文档直接实现会在订阅时产生 `DataCloneError`/`IO_ERROR`，或无法将事件回调交付给插件；因此“推荐 SDK 公共 API 可实现”的核心要求尚未闭合。该问题不是把未实现 API 当作已发布事实，而是方案缺少可实现的桥接形态。
- **修复动作**：把 API 明确建模为 SDK 本地注册回调、桥接只发送可序列化的 `filter` 并返回 opaque token；或拆成“请求订阅 + SDK 本地 `onMenuClick`”两个接口。补充 SDK bridge 的入站事件监听、来源校验、token 路由和销毁清理，禁止把 listener 放进 postMessage payload。
- **验收检查**：SDK 类型/bridge 测试证明发出的 payload 不含函数；mock/契约测试覆盖事件交付、过滤、重复事件、unsubscribe 和 `destroyTreasure()` 后不再回调；插件 mock 能按 `Result<T>` 处理订阅失败。

### R2-002 — P0 — 菜单能力版本门槛与 manifest/依赖仍相互矛盾

- **位置**：`artifacts/plan.md:23,31,67`；`contracts/menu-actions.md:57-61`；`quickstart.md:9`。
- **证据**：计划的目标平台仍写“宿主 2.1.x”，项目结构把 `manifest.json` 最低宿主版本写成 `2.1.0`，插件依赖为 `treasure-sdk ^2.1.1`；同一轮契约又把 `menus.update/subscribe/unsubscribe` 推荐能力门槛写成 `2.2.0`，并要求 manifest 与确认值一致，最终版本仍是 `[Open question]`。
- **影响**：2.1.x 可以通过 manifest 门槛加载插件，但当前 SDK/宿主没有点击订阅能力；插件无法可靠区分可用、未支持和需要升级的状态，FR-018/U-010 的兼容语义不能交付。
- **修复动作**：在进入实现/任务拆分前确定能力版本（或把版本继续标为阻塞条件），同步更新 manifest `minPlatformVersion`、SDK 依赖/lockfile、宿主能力注册表和文档；将 2.1.x 明确列为不可用矩阵，避免以建议版本写成运行时保证。
- **验收检查**：manifest 一致性测试断言最低版本等于已发布能力版本；SDK/宿主版本矩阵分别验证 2.1.x 的明确不可用提示和目标版本的注册、更新、订阅、注销成功。

### R2-003 — P1 — 2.1.x 的 `UNSUPPORTED` 兼容叙述与当前宿主返回值不符

- **位置**：`contracts/menu-actions.md:59-61`、`quickstart.md:9,47`；宿主 `/Volumes/MacExtend/FrontProjects/treasure/src/bridge/pluginBridge.ts:185-192`。
- **证据**：候选工件要求旧宿主对新菜单能力返回结构化 `UNSUPPORTED`。当前宿主对不在 `capabilityRegistry` 的 operation 直接返回 `VALIDATION_FAILED`；当前 registry 只有 `menus.register` 和 `menus.unregister`（同文件 `:81-82`）。SDK `ResultErrorCode` 虽包含 `UNSUPPORTED`，但当前桥接不会为未知菜单 operation 产生该码。
- **影响**：真实 2.1.x 上的错误映射、升级/重试提示和“不可用”状态会与 mock/quickstart 预期不同；用户可能看到参数校验错误而非版本不兼容。计划把未实现的旧宿主行为写成了现状。
- **修复动作**：在跨仓库同步清单中增加版本/能力协商：旧宿主必须对已知但版本不足的能力返回 `UNSUPPORTED`，或 SDK 先用可用的能力探测并在本地生成该状态；在发布前不要断言 2.1.x 的返回码。
- **验收检查**：对当前旧宿主和同步后的宿主各做 bridge contract test；2.1.x 结果码、UI 文案、重试/升级入口与文档一致，且不回退到内部事件。

### R2-004 — P1 — 规格追踪和范围声明遗漏 FR-028、SC-011

- **位置**：`artifacts/plan.md:31,137-145`、`round-02/coverage.yaml`；规格 `specs/004-excalidraw-plugin/spec.md:160,193-199`。
- **证据**：计划 Scale/Scope 只写 `FR-001..FR-016、SC-001..SC-006`，追踪表覆盖到 `FR-027/SC-010`，没有 `FR-028` 或 `SC-011`。当前规格明确要求“本轮不改变核心/格式/宿主全局菜单，交付物只含规格和清单，不包含直接代码实施或代理代跑宿主测试”。
- **影响**：任务生成阶段可能漏掉本轮的非扩 scope 和代理边界，导致把代码或宿主测试排进代理任务，或没有验收“核心能力/既定导出/全局菜单未改变”。这也使“计划覆盖原规格和所有 Phase 0/1 要求”的证据不完整。
- **修复动作**：在计划范围、追踪表、coverage 和 quickstart 验证矩阵中增加 FR-028/SC-011；明确宿主运行测试只由用户执行，计划阶段不得将其写为代理任务，并为不改变核心范围增加审查检查。
- **验收检查**：coverage 列出 FR-001..FR-028、SC-001..SC-011 且每项有设计/验证落点；`speckit-tasks` 输入不含直接实现或宿主运行测试代理任务。

### R2-005 — P1 — 活动 tab 切换撤销订阅后没有恢复路径

- **位置**：`contracts/menu-actions.md:53-61`、`artifacts/data-model.md:78`、`quickstart.md:47`。
- **证据**：契约要求宿主在切换活动 tab 时“撤销该插件的全部订阅并停止投递”，但没有 SDK 的 tab 激活通知、订阅失效事件或插件重新初始化/自动重试规则；`subscriptionId` 仅描述为当前会话 token。quickstart 只验证后台 tab 不触发回调，没有验证切回后重新订阅且不重复注册。
- **影响**：用户切换到别的插件再切回后，菜单入口可能仍显示但保存/导出不再响应，或者重试会创建重复订阅/菜单；FR-018、FR-020 的生命周期和错误恢复语义不完整。
- **修复动作**：明确“切换 tab 仅暂停投递”还是“撤销并要求重订阅”。若撤销，增加 SDK/宿主激活通知或插件可观察的 `UNSUPPORTED/REFERENCE_EXPIRED` 结果与幂等重订阅流程，并定义菜单状态如何同步。
- **验收检查**：宿主手测覆盖切出/切回、重载、卸载和重复重试；切回后恰有一个有效订阅和一个菜单注册，点击可执行且无并发/重复回调。

## 已核对且未发现问题的维度

- U-010 已在 plan、research、`contracts/menu-actions.md`、`contracts/treasure-sdk-boundary.md`、data-model 和 quickstart 中作为 SDK/宿主同步的方案决策表达；当前 SDK 2.1.1 仅有 `register/unregister`、宿主内部 `treasure-menu-event` 的事实也被明确区分，未把 `menus.update/subscribe` 或 2.2.0 写成当前已发布事实。
- 来源校验、插件身份不得信任 payload、活动 iframe、origin、事件去重、订阅/注销顺序、Result 错误映射、重试入口和“不得依赖 `treasure-menu-event`”均有契约文字和验收方向；R2-001、R2-003、R2-005 指出的是可实现性/版本闭环缺口。
- 当前候选工件的中文正文、路径、Phase 0/1 文件及 artifacts 复制关系与 adaptive contract 基本一致；本审查未修改候选工件。
