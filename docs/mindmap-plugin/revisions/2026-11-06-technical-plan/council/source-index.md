# 来源索引

| ID | 来源 | 状态/版本 | 本次用途 |
| --- | --- | --- | --- |
| S-01 | [当前交互原型 README](../../../prototype/README.md) | 2026-11-06，本地 | 当前产品行为、模拟边界、回归场景的主要依据。 |
| S-02 | [文件适配器草案](../../../prototype/treasure-file-adapter.ts) | 原型接线 | 核对 open/save 的 SDK 调用形态；不是生产实现完成证据。 |
| S-03 | [观象谱命名决定](../../2026-11-05-native-and-naming/decision.md) | 已确认 | `.gxp`、外部只读与副本策略的权威决定。 |
| S-04 | [Treasure 插件研发指南](../../../../PLUGIN-DEVELOPMENT-GUIDE.md) | 本地 | 工程、manifest、SDK、权限、测试、构建和发布约束。 |
| S-05 | [Treasure 宿主视觉参考](../../../../TREASURE-HOST-DESIGN.md) | 本地 | 视觉协调、滚动边界与 README 要求。 |
| S-06 | `excalidraw/node_modules/treasure-sdk/dist/index.d.ts` | 2.1.1，本地 | 最终 API/类型和目录授权恢复能力的优先证据。 |
| S-07 | `treasure-plugin/node_modules/treasure-sdk/dist/index.d.ts` | 2.0.0，本地 | 识别原型适配器所在依赖与 2.1.1 的能力差异。 |
| S-08 | `excalidraw/src/services/directory-service.ts` | 本地参考 | 验证 2.1.1 的目录授权/恢复调用次序；不复制其业务。 |
| S-09 | [初版方案](../../../technical-ui-proposal.md) | 历史研究基线 | 仅保留引擎比较与风险研究；文件格式和 UI 假设须以本次校对为准。 |
| S-10 | [原型文件通路回归](../../../prototype/qa-host-file-flows.md) | 2026-11-05 | 10 项浏览器替身验证范围；不等同于宿主端到端验证。 |
| S-11 | `excalidraw/package.json`、`excalidraw/manifest.json` | 本地，SDK `^2.1.1` / 宿主最低 `2.3.0` | 已有同仓插件的已声明依赖与宿主基线，可作为观象谱首版的保守基线；仍须宿主联调验证。 |

本方案不以互联网资料或未锁定的 SDK 文档覆盖上述本地证据；接口冲突时以 S-06 的公开类型和 S-04 的硬约束为准。
