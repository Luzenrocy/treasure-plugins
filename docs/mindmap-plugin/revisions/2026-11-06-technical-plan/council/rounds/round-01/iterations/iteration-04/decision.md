# 第 1 轮 / 第 4 次迭代最终 Gate

verdict: revise

本次不批准发布。B-001（目标宿主验收）与 B-002（折叠状态回归）都是实施完成后才执行的发布验收，按既有决定不构成技术方案未解决项，也不阻止本草稿作为方案内容获准。阻止批准的是 workshop 的直接发布契约尚未满足：source index 仍有失效的本地证据链接，且草稿复制到 `publication.target_path` 后仍包含指向不存在的同目录 council 记录的引用及过时的草稿元数据。

## GATE-001..003 决定

| Gate | 决定 | 证据与核验 | 处置 |
| --- | --- | --- | --- |
| GATE-001 — final-path link integrity | 关闭 | 从 `docs/mindmap-plugin/revisions/2026-11-06-technical-plan/technical-ui-proposal.md` 解析，草稿 §1 的命名决定与原型 README 链接、§10 的原型 README、适配器、研发指南和 SDK 2.1.1 声明链接均存在。 | 保持这些目标路径相对链接。 |
| GATE-002 — source-index local-link integrity | 未关闭 | S-04、S-05 的链接已可从 `council/source-index.md` 解析；但 S-03 的 `../2026-11-05-native-and-naming/decision.md` 从 `council/` 解析为当前 revision 下的不存在路径。实际命名决定位于其上级 `revisions/` 下。 | 将 S-03 改为从 `council/` 可解析的路径，并重新执行 source-index 链接核验。 |
| GATE-003 — authoritative council metadata | 关闭 | `manifest.yaml` 记录 `current_iteration: 4`，且 `sources` 已包含 S-11；与 iteration-04 输入快照和 source index 一致。 | 保持。 |

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
U-009: revise-publication-cleanliness-and-source-index
R01-I01-001..R01-I01-006: resolved
B-001: release-acceptance-item-not-an-unresolved-plan-gap
B-002: release-acceptance-item-not-an-unresolved-plan-gap
GATE-001: closed
GATE-002: open
GATE-003: closed
```

## 逐项决定

| 项目 | 决定 | 证据/定位 |
| --- | --- | --- |
| U-001 原型校对 | 通过 | 草稿 §1、§2、§7、§9；S-01/S-10。 |
| U-002 插件指南与 SDK 约束 | 通过，保留实现发布验收 | 草稿 §3、§9、§10；S-04/S-06/S-11。 |
| U-003 `.gxp` 原生格式 | 通过 | 草稿 §1、§2、§6；S-03。 |
| U-004 外部只读与副本 | 通过 | 草稿 §2、§5.2、§6。 |
| U-005 左侧悬浮大纲 | 通过 | 草稿 §2、§7、§9。 |
| U-006 打开/导出 SDK 文件流 | 通过 | 草稿 §3、§5.2、§9。 |
| U-007 重置语义 | 通过 | 草稿 §2、§7、§9。 |
| U-008 控制面禁令 | 通过 | 草稿 §1、§2、§7、§9。 |
| U-009 中文独立 revision 技术方案 | 待修发布成品 | 最终路径正确，但草稿元数据仍为“评审草稿，第 3 次迭代”，并含不能随草稿发布的 council 记录引用。 |

## blocking_items

1. **GATE-002 / S-03 source index 链接失效。** 在 `source-index.md` 将 S-03 链接改为从该文件所在 `council/` 目录能够抵达 `docs/mindmap-plugin/revisions/2026-11-05-native-and-naming/decision.md` 的相对位置，并验证全部 source-index 本地链接。
2. **clean-final / council 内部记录引用。** 草稿 §10 最后一段写有“同目录 `coverage.yaml`”和“`revision.md`”；直接复制到 `publication.target_path` 后，两者均不存在。这些是 council 过程记录，不应作为最终技术方案的同目录依赖。删除、改为可随最终稿解析的稳定发布证据，或将该追溯内容内联到方案后，再按目标路径检查。
3. **clean-final / 元数据准确性。** 草稿 YAML 仍标注 `status: "评审草稿"` 和“第 3 次迭代”。批准后必须能原样复制为干净最终稿；在下一次草稿中将其改为不含迭代/评审态的最终文档元数据，或删除这些过程性字段。

除上述文档发布与证据闭合事项外，没有方案内容阻塞项。下一次检查不应要求先完成 B-001 或 B-002 的实现验收。
