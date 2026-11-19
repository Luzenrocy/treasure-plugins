## round-01 新增需求质量项目（CHK049–CHK106）

### 需求完整性

- [ ] CHK049 是否把 FR-017–FR-020 的窗口菜单范围、FR-021–FR-027 的侧边导航与素材流程，以及 FR-028 的范围保护，完整映射到对应 SC-007–SC-011 和契约？[完整性，Spec §FR-017..FR-028、SC-007..SC-011；Plan §规格追踪]
- [ ] CHK050 是否明确 SDK/宿主公共菜单能力至少涵盖注册、状态更新、点击订阅、取消订阅和注销，并为每个操作定义 `Result<T>` 结果语义？[完整性，Contract §menu-actions 推荐的公开 API；Contract §treasure-sdk-boundary 窗口菜单公共边界]
- [ ] CHK051 是否明确 `excalidraw.file`、`save`、`export` 的稳定标识、允许的动作集合及 `enabled` 状态的派生条件？[完整性，Spec §FR-018..FR-019；Data model §MenuAction]
- [ ] CHK052 是否完整规定初始化注册与订阅的先后、卸载/停用/重载/销毁时的清理顺序，以及重复清理的幂等语义？[完整性，Contract §menu-actions 生命周期；Data model §MenuClickSubscription]
- [ ] CHK053 是否规定活动 tab 切出时暂停事件投递、保留注册与订阅，切回时恢复且不创建第二个订阅？[完整性，Contract §menu-actions 生命周期；Contract §treasure-sdk-boundary 窗口菜单公共边界]
- [ ] CHK054 是否分别定义平台最低版本 `2.1.0`、当前 SDK/宿主基线和菜单独立 `capabilityVersion/minCapabilityVersion` 的协商、缺失和升级提示？[完整性，Plan §Technical Context、Phase 0 决策 8；Contract §menu-actions 生命周期与版本兼容]
- [ ] CHK055 是否覆盖父窗口、登记 origin、活动 iframe、插件身份、菜单归属、固定 `source`、事件字段类型和 `eventId` 去重等来源校验要求？[完整性，Contract §menu-actions 事件字段与来源校验]
- [ ] CHK056 是否明确注册失败、能力缺失、订阅失败和宿主拒绝时的统一不可用状态、原因、重试或升级入口及其可追踪结果？[完整性，Spec §FR-019；Contract §menu-actions 插件映射与验收]
- [ ] CHK057 是否为既有目录/文件、素材、导出和 UI 范围保留 FR-001–FR-016 的验收落点，并说明菜单入口变化不能削弱这些边界？[完整性，Spec §FR-001..FR-016、FR-028；Plan §规格追踪]
- [ ] CHK058 是否明确哪些证据由自动化工件提供、哪些宿主能力由用户维护，以及代理交付不包含宿主运行测试？[完整性，Spec §FR-028、SC-011；Tasks §T039..T040；Quickstart §宿主手工验证]

### 需求清晰度

- [ ] CHK059 “公开 `treasure-sdk` 菜单能力”是否明确最终 API 字段命名可以兼容评审，但注册、更新、订阅、取消订阅、注销和状态语义不得被削弱？[清晰度/歧义，Contract §menu-actions 推荐的公开 API、生命周期]
- [ ] CHK060 是否为菜单各 API 的 `Result<T>` 错误、旧 bridge 的 `VALIDATION_FAILED` 与已知能力缺失的 `UNSUPPORTED` 映射给出不相互混淆的定义？[清晰度，Contract §menu-actions 生命周期与版本兼容；Contract §treasure-sdk-boundary 不变量]
- [ ] CHK061 是否以明确条件定义保存和导出菜单的 `enabled`/不可用状态，包括未授权目录、无内容、操作进行中和能力缺失？[清晰度，Spec §FR-019；Data model §MenuAction]
- [ ] CHK062 是否区分“菜单注册失败”“事件投递失败”“保存/导出动作失败”和“用户取消”，并为每类状态规定不同的用户可理解反馈？[清晰度，Spec §FR-019；Contract §treasure-sdk-boundary 不变量；[Gap]]
- [ ] CHK063 是否明确事件字段的来源和信任边界：`pluginCode` 由宿主元数据派生、`source` 为固定枚举、`occurredAt` 仅用于观测、`eventId` 仅用于去重诊断？[清晰度，Contract §menu-actions 事件字段与来源校验；Data model §MenuAction]
- [ ] CHK064 是否明确注册→订阅和取消订阅→注销→bridge 销毁的顺序在部分失败时如何继续清理并呈现状态？[清晰度，Contract §menu-actions 生命周期；Contract §treasure-sdk-boundary 窗口菜单公共边界]
- [ ] CHK065 “暂停”是否明确只暂停事件投递而不撤销注册、token 或本地 listener，并定义何种销毁条件才转为 `unregistered`？[清晰度，Data model §MenuClickSubscription；Contract §menu-actions 生命周期]
- [ ] CHK066 是否明确重复注册、重复订阅和重复注销的幂等结果，包括可见菜单项数量、有效 token 数量和返回结果？[清晰度，Contract §menu-actions 插件映射与验收；[Gap]]
- [ ] CHK067 是否明确 capability 不满足时核心绘图仍可用、菜单动作保持不可用，以及何时允许从不可用恢复为可用？[清晰度，Plan §Technical Context；Contract §menu-actions 生命周期与版本兼容]
- [ ] CHK068 “重试注册”是否定义触发前后状态、已存在注册的处理和最终仍失败时的升级/人工恢复路径？[清晰度，Spec §FR-019；[Ambiguity]]

### 需求一致性

- [ ] CHK069 FR-018 对公共 SDK 菜单 API 的要求是否与 `menu-actions.md` 推荐接口、`treasure-sdk-boundary.md` 的同步门槛保持同一语义？[一致性，Spec §FR-018；Contract §menu-actions、treasure-sdk-boundary]
- [ ] CHK070 “插件只能使用 SDK”是否与禁止 `window` 消息监听、裸 `postMessage`、内部 `treasure-menu-event` 及 quickstart 源码门禁保持一致？[一致性，Spec §FR-018；Plan §Phase 0 决策 8；Quickstart §自动化检查]
- [ ] CHK071 `unregistered`、`registered`、`subscribed`、`paused`、`unavailable` 各状态的进入和离开条件是否在数据模型、菜单契约和规格中一致？[一致性，Data model §MenuClickSubscription；Contract §menu-actions 生命周期；Spec §FR-019..FR-020]
- [ ] CHK072 平台 `minPlatformVersion: 2.1.0`、SDK 2.1.1/宿主 2.1.x 和菜单 capability 1.0 是否被明确区分，避免把平台可加载误解为菜单可用？[一致性，Plan §Technical Context、Phase 0 决策 8；Quickstart §前置条件]
- [ ] CHK073 当前基线下菜单保持不可用的要求，是否与 FR-019 的禁用/明确提示、SC-007 的可观察原因和契约的 `UNSUPPORTED` 语义一致？[一致性，Spec §FR-019、SC-007；Contract §menu-actions 生命周期与版本兼容]
- [ ] CHK074 页面卸载、插件停用、重载、`destroyTreasure()` 和 iframe 销毁的清理责任是否在数据模型、SDK 边界、菜单契约和 quickstart 中一致？[一致性，Data model §MenuClickSubscription；Contract §treasure-sdk-boundary；Quickstart §自动化检查]
- [ ] CHK075 `VALIDATION_FAILED` 仅表示旧 bridge 未知操作、已知能力缺失统一为 `UNSUPPORTED` 的规则是否在所有契约和验收表述中一致？[一致性，Contract §menu-actions 生命周期与版本兼容；Contract §treasure-sdk-boundary 窗口菜单公共边界]
- [ ] CHK076 listener 仅在 SDK iframe 本地 registry 保存、bridge 只传 filter/token 且不传函数的要求，是否与 plan、数据模型、菜单契约和 quickstart 的描述一致？[一致性，Plan §Phase 0 决策 8；Data model §MenuClickSubscription；Quickstart §自动化检查]

### 验收标准质量

- [ ] CHK077 SC-007 是否分别描述菜单注册可用、动作状态随目录/脏状态变化、保存/导出结果、能力不可用原因和重试路径，而不是合并为“可完成一次操作”？[验收质量，Spec §SC-007、FR-019]
- [ ] CHK078 SC-008 是否把侧边导航的展开/收起、焦点顺序、隐藏内容不可聚焦、窄窗口无横向溢出和面板滚动边界写成可观察标准？[验收质量，Spec §SC-008、FR-021..FR-023；Contract §ui-lifecycle]
- [ ] CHK079 SC-009 是否区分查询、下载、校验、写入、完成/失败的阶段顺序，以及清理可验证时才成功、清理失败显示残留的判定？[验收质量，Spec §SC-009、FR-025..FR-026]
- [ ] CHK080 SC-010 是否明确稳定素材标识、内容校验、幂等结果、无重复条目和更新失败保留上一版本的验收语义？[验收质量，Spec §SC-010、FR-027；Data model §LibraryBundle]
- [ ] CHK081 SC-011 是否把“范围未改变”和“交付物不含直接实现/代理宿主测试”分别作为可审查的需求边界，而非把它们混成实现完成条件？[验收质量，Spec §SC-011、FR-028；Tasks §T040]
- [ ] CHK082 `menu-actions.md` 和 `treasure-sdk-boundary.md` 是否给出来源伪造、错误 origin、重复事件、tab 暂停/恢复、重载清理和当前基线不可用的独立验收结果？[验收质量，Contract §menu-actions 插件映射与验收；Contract §treasure-sdk-boundary 验收]
- [ ] CHK083 各菜单验收标准是否明确前置能力、主体状态、期望状态和失败后保留内容，使不同评审者不会把“动作被触发”误当作“需求满足”？[验收质量，Spec §US1-AS1..AS5；Contract §menu-actions 插件映射与验收；[Gap]]

### 场景与边界覆盖

- [ ] CHK084 是否定义从菜单注册、订阅、状态更新到保存/导出动作反馈的主场景，并与既有目录授权和导出前置条件衔接？[场景覆盖，Spec §US1-AS1..AS4、FR-018..FR-019；[Gap]]
- [ ] CHK085 是否定义 capability 缺失、SDK 版本不匹配或宿主拒绝注册时的替代场景、用户可用的核心能力和恢复入口？[替代场景，Spec §US1-AS5、FR-019；Contract §menu-actions 生命周期与版本兼容]
- [ ] CHK086 是否覆盖注册成功但订阅失败、状态更新失败、取消订阅失败或注销失败的部分失败场景，并规定残留注册/订阅如何被标记和清理？[异常覆盖，Contract §menu-actions 生命周期；[Gap]]
- [ ] CHK087 是否定义 `REFERENCE_EXPIRED` 或 bridge 重建后的恢复路径，包括确认现有注册、幂等重订阅、恢复 enabled 状态和最终失败提示？[恢复覆盖，Contract §menu-actions 生命周期；Contract §treasure-sdk-boundary 窗口菜单公共边界]
- [ ] CHK088 是否覆盖活动 tab 切换、页面重载、插件停用和 iframe 销毁发生在菜单动作或保存/导出进行期间时的状态保留与清理边界？[边界覆盖，Data model §MenuClickSubscription；Quickstart §宿主手工验证第 8 项；[Gap]]
- [ ] CHK089 是否定义重复菜单事件、重复动作请求和保存/导出并行状态的去重、串行化或拒绝语义，避免与“不得并发覆盖未完成结果”冲突？[边界覆盖，Spec §Edge Cases；Contract §menu-actions 事件字段与来源校验；[Gap]]
- [ ] CHK090 是否定义来源伪造、错误 origin、字段缺失/类型错误、未知菜单项和不属于本插件注册的事件的处理、记录和用户可见范围？[安全异常覆盖，Contract §menu-actions 事件字段与来源校验；Contract §treasure-sdk-boundary 窗口菜单公共边界]

### 非功能与依赖

- [ ] CHK091 是否明确宿主只向已登记且归属本插件的订阅者投递事件，并定义插件身份、菜单归属和 origin 校验的责任边界？[安全，Contract §menu-actions 事件字段与来源校验；Contract §treasure-sdk-boundary 窗口菜单公共边界]
- [ ] CHK092 是否明确 `subscriptionId`、运行时引用和事件瞬态字段不得写入 settings/storage，并说明诊断信息的最小持久化边界？[安全与隐私，Data model §MenuClickSubscription、关系和不变量；Contract §treasure-sdk-boundary 不变量]
- [ ] CHK093 是否明确官方素材库的预配置来源、任意 URL 禁止、来源/版本/checksum 的不可信输入处理与本地 `.excalidrawlib` 回退之间的安全关系？[安全与依赖，Spec §FR-024、FR-027；Contract §excalidraw-scene 素材库]
- [ ] CHK094 是否为菜单不可用、注册失败、事件拒绝和动作错误定义一致的中文状态文案、无障碍名称和键盘可达的重试/升级入口？[可访问性与本地化，Spec §FR-004、FR-019、FR-022..FR-023；Contract §ui-lifecycle]
- [ ] CHK095 是否定义 `eventId`、`capabilityVersion`、`platformVersion` 和错误码在诊断记录中的用途、保留边界和不作为安全判断的限制？[可观测性，Contract §menu-actions 事件字段与来源校验；[Gap]]
- [ ] CHK096 是否建立 SDK、Treasure 宿主和插件三方的同步发布责任、能力版本矩阵、变更影响和发布前阻塞门槛？[依赖，Plan §Constitution Check、Phase 0 决策 8；Contract §treasure-sdk-boundary SDK/宿主同步清单]
- [ ] CHK097 是否明确当前 SDK/宿主菜单能力未发布时，插件的可交付范围、用户提示、后续升级条件和证据归属？[依赖与假设，Plan §Post-Design Constitution Check；Quickstart §前置条件]
- [ ] CHK098 是否把 32 MiB、Result<T> 错误、引用不持久化、唯一主要滚动区和不阻塞主线程等既有非功能约束与新增菜单状态反馈关联起来？[非功能一致性，Plan §Technical Context；Contract §treasure-sdk-boundary 不变量；Contract §ui-lifecycle]

### 歧义与冲突

- [ ] CHK099 推荐 API 允许“命名兼容评审”时，是否规定由谁记录兼容差异、如何证明语义仍等价以及何种变化必须回到规格决策？[歧义，Contract §menu-actions 推荐的公开 API；Plan §Complexity Tracking]
- [ ] CHK100 “禁用或明确不可用状态”是否说明宿主菜单能力实际支持的呈现形式，以及两种呈现形式各自的验收结果？[歧义，Spec §FR-019；[Ambiguity]]
- [ ] CHK101 注册失败状态可以放在设置、帮助或状态区域时，是否明确唯一首选入口、可发现性和重试结果，避免不同实现选择不同信息架构？[歧义，Spec §FR-019、FR-021；[Ambiguity]]
- [ ] CHK102 `eventId` 去重窗口、重复事件判定和跨宿主重启后的重新计数边界是否已明确，或显式标注为待 SDK/宿主决策？[歧义，Contract §menu-actions 事件字段与来源校验；[Open question]]
- [ ] CHK103 `menus.update` 若并入 `register`，是否明确更新的幂等、失败回滚和现有订阅保留语义，避免与推荐 API 产生冲突？[歧义/冲突，Contract §menu-actions 推荐的公开 API；[Conflict]]
- [ ] CHK104 旧 bridge 对未知 operation 返回 `VALIDATION_FAILED` 与同步后能力缺失返回 `UNSUPPORTED` 的适用边界，是否已有按版本/能力探测区分的规则？[歧义，Contract §menu-actions 生命周期与版本兼容；[Ambiguity]]
- [ ] CHK105 “暂停投递但保留订阅”与窗口切换期间的动作状态更新、重载清理和并发操作之间是否没有未决冲突？[冲突，Contract §menu-actions 生命周期；Spec §Edge Cases；[Conflict]]
- [ ] CHK106 宿主日志记录被拒事件、插件可见错误和证据文档之间的隐私/可追踪边界是否已明确，避免把瞬态来源或路径写入持久化数据？[歧义与安全，Contract §menu-actions 事件字段与来源校验；Data model §关系和不变量；[Gap]]

### 增补备注

- 本轮新增项目从 CHK049 连续至 CHK106，均保持 `[ ]`，直接追加即可；既有 CHK001–CHK048 和其勾选状态不变。
- 本清单只检查需求文本质量，不替代实现任务、自动化测试、宿主手工验证或发布审批。
- 标记 `[Gap]`、`[Ambiguity]`、`[Conflict]`、`[Open question]` 用于指向待补充或待决策内容，不代表实现缺陷。
