# 第 1 轮 / 第 3 次迭代最终 Gate

verdict: revise

本次不批准发布。技术方案正文已满足产品、SDK 与原型边界的实质要求；但依据 workshop 的“批准后将干净草稿直接复制到精确目标路径”规则，当前迭代草稿尚不能原样成为目标路径的干净定稿，且 council 的权威索引未反映本次采用的来源与迭代状态。以下是发布前必须完成的流程性修订；不要求改变方案的技术决策。

## Disposition

| 项目 | 结论 | 证据/定位 | 处置 |
| --- | --- | --- | --- |
| U-001 原型校对 | 通过 | `draft.md` §1、§2、§7、§9；S-01/S-10 | 保持。 |
| U-002 插件指南与 SDK 约束 | 通过（带发布验收） | `draft.md` §3、§9、§10；S-04/S-06/S-11 | 保持 SDK 2.1.1 正式基线与目标宿主验收。 |
| U-003 `.gxp` 原生格式 | 通过 | `draft.md` §1、§2、§6；S-03 | 保持。 |
| U-004 外部只读与副本 | 通过 | `draft.md` §2、§5.2、§6 | 保持；不得加入外部格式回写。 |
| U-005 左侧悬浮大纲 | 通过 | `draft.md` §2、§7、§9；S-01/S-10 | 保持浮层高于主菜单、不挤压画布、无侧栏新建。 |
| U-006 打开/导出 SDK 文件流 | 通过 | `draft.md` §3、§5.2、§9；S-02/S-04/S-06 | 保持 `Result`/`CANCELLED` 处理和无路径边界。 |
| U-007 重置语义 | 通过 | `draft.md` §2、§7、§9；S-01 | 保持“重置视图”与可撤销、保根的“重置画布”区分。 |
| U-008 控制面禁令 | 通过 | `draft.md` §1、§2、§7、§9；S-01 | 保持无顶部栏、右上唯一保存/导出、主菜单不重复。 |
| U-009 中文独立 revision 技术方案 | 实质通过，发布记录待修 | `draft.md` 元数据与 §9/§10；`manifest.yaml` 目标路径 | 修复下列目标路径链接与 council 索引后再发布。 |
| R01-I01-001 | 已解决 | `draft.md` §3、§5.2 | 正常保存复用既有引用；`saveDialog` 仅给首次保存、另存为和导出新的引用。 |
| R01-I01-002 | 已解决，保留 B-001 发布验收项 | `draft.md` §1、§3、§9、§10；S-11 | `2.3.0` 仅为同仓组合推得的保守首版基线，不冒充 SDK 官方版本映射。 |
| R01-I01-003 | 已解决 | `draft.md` §7、§9 | 结构快捷键有画布焦点、有效选区、非文本/IME 输入的前置条件。 |
| R01-I01-004 | 迭代草稿已解决；定稿路径仍阻塞 | `draft.md` §1、§10；`manifest.yaml` `publication.target_path` | 本迭代目录中的四条正文证据链接均可解析，但其相对层级不能直接用于最终目标文件。 |
| R01-I01-005 | 已解决 | `draft.md` §5.2、§9 | 外部副本成功写入后为 `editable-clean`；取消/失败维持只读会话。 |
| R01-I01-006 | 已解决，保留 B-002 发布验收项 | `draft.md` §6、§7、§9、§10 | 折叠明确为 `.gxp` 内容态，进入 revision、undo/redo 和 dirty；根主题左右独立。 |
| B-001 | 非方案缺口；发布验收项 | `coverage.yaml`、`draft.md` §9/§10 | 在目标宿主验证注册、目录授权恢复和文件调用链后，才可发布实现。 |
| B-002 | 非方案缺口；发布验收项 | `coverage.yaml`、`draft.md` §6/§9/§10 | 完成保存/重开、撤销/重做及根主题左右独立折叠回归后，才可发布实现。 |

## coverage_status

```yaml
U-001: satisfied
U-002: satisfied-with-release-acceptance
U-003: satisfied
U-004: satisfied
U-005: satisfied
U-006: satisfied
U-007: satisfied
U-008: satisfied
U-009: revise-publication-record
R01-I01-001..R01-I01-006: resolved
B-001: release-acceptance-item-not-unresolved-plan-gap
B-002: release-acceptance-item-not-unresolved-plan-gap
```

## blocking_items

1. **GATE-001 — final-path link integrity.** `manifest.yaml` 的发布目标是 `docs/mindmap-plugin/revisions/2026-11-06-technical-plan/technical-ui-proposal.md`，而 `draft.md` §1 和 §10 的相对链接特意以 `iterations/iteration-03/` 为基准。按 workshop 的直接复制发布契约，复制后四条链接均会失效。发布版必须使用相对于目标文件的链接（分别为 `../2026-11-05-native-and-naming/decision.md`、`../../prototype/README.md`、`../../../PLUGIN-DEVELOPMENT-GUIDE.md`、`../../../../excalidraw/node_modules/treasure-sdk/dist/index.d.ts`），并从目标路径重新执行链接解析。
2. **GATE-002 — source-index local-link integrity.** `source-index.md` 的 S-04 和 S-05 使用 `../../../PLUGIN-DEVELOPMENT-GUIDE.md` 与 `../../../TREASURE-HOST-DESIGN.md`；从 `council/` 解析不存在。应改为 `../../../../PLUGIN-DEVELOPMENT-GUIDE.md` 与 `../../../../TREASURE-HOST-DESIGN.md`，以维持合同要求的本地可核验证据索引。
3. **GATE-003 — authoritative council metadata.** `manifest.yaml` 仍为 `current_iteration: 0`，其 `sources` 列表止于 S-10；但本次 `input-snapshot.yaml`、`source-index.md` 与正文使用第 3 次迭代和决定性 S-11。发布前应更新 manifest 为当前迭代并纳入 S-11，确保权威 run index、输入快照和发布记录一致。

## 核验记录

- 当前 writing-workshop 规则、角色配置和本次所需引用文件的 SHA-256 与 `rules-snapshot.yaml` 中的记录一致；未发生规则重载。
- SDK 2.1.1 声明确认 `openDialog`、`saveDialog`、`readFile`、`writeFile`、`DirectorySetting`、`verifyDirectoryGrant` 及 `Result`/错误码边界；方案未越过公开 API。
- S-11 实际确认同仓 Excalidraw 的 `treasure-sdk: ^2.1.1` 与 `manifest.minPlatformVersion: 2.3.0` 组合；该证据范围只支持保守首版基线，不能替代目标宿主验收，方案已正确限定。
- 草稿没有把浏览器原型或适配器说成真实解析/磁盘持久化完成；折叠内容态的决定、状态同步和验收均前后一致。
