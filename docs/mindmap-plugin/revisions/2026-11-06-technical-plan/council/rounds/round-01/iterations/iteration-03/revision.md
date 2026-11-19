# 第 1 轮 / 第 3 次迭代修订记录

本记录承接 `iteration-02` 对 `iteration-01/review.md` 的 R01-I01-001 至 R01-I01-006 的处置。本次仅依据 council 已记录的两项决定更新：同仓 Excalidraw 的 `treasure-sdk ^2.1.1` 与 `manifest.minPlatformVersion: 2.3.0` 组合成为首版保守基线；原型折叠/展开使用可撤销的 `markChanged`，因此折叠是内容态。B-001、B-002 均登记为待完成的发布验收风险。

| 审查项 | 处置 | 所做修改 | 验收证据 |
| --- | --- | --- | --- |
| R01-I01-001 | 已解决 | 拆分正常保存与首次保存/另存为/导出：正常保存复用内存会话既有目标并直接 `writeFile`；`saveDialog` 仅为无目标、另存为和每个导出目标返回新的引用；多画布逐目标限定为导出。 | `draft.md` §3、§5.2；已打开 `.gxp` 保存无对话框，首次/另存为各一次，全部画布导出每输出一次，取消/失败保留会话。 |
| R01-I01-002 | 已解决（验收风险） | 首版 `manifest.minPlatformVersion` 确定为 `2.3.0`，依据同仓 Excalidraw 的 `treasure-sdk ^2.1.1` + `2.3.0` manifest 组合；保留目标宿主联调为验收风险。 | `draft.md` §1、§3、§9、§10；`coverage.yaml` B-001。验证注册、目录授权恢复与文件调用链。 |
| R01-I01-003 | 已解决 | `Tab`/`Enter` 增加有效节点选区前置条件；无选区不执行结构命令；输入和中文 IME 继续保留文字行为。 | `draft.md` §7、§9 验收 5；四状态矩阵只允许“节点已选且非输入”创建结构。 |
| R01-I01-004 | 已解决 | 按 iteration-02 的实际深度重新计算正文全部本地证据链接，不复用 council 层的相对路径。 | `draft.md` §1、§10；链接分别解析至 S-03 命名决定、S-01 原型 README、S-04 指南和 S-06 声明。 |
| R01-I01-005 | 已解决 | 定义外部副本事务：目标选择和写入都成功后才切换为 `editable-clean`，并把 `savedRevision` 设为写入快照；取消/失败保持原外部只读。 | `draft.md` §5.2、§9 验收 3；`.smm` 与 `.xmind` 分别验证成功 clean、编辑 dirty、失败不覆盖来源。 |
| R01-I01-006 | 已解决（验收风险） | 折叠确定为内容态：写入 `.gxp`、进入 `revision`、撤销/重做与脏状态；根主题左右布局保留独立状态。 | `draft.md` §6、§7、§9、§10；`coverage.yaml` B-002。执行“折叠 → 保存/重开 → 撤销/重做”及根左右独立状态回归。 |

## 链接验收

从 `iteration-03/draft.md` 解析的本地链接如下，均应存在：

- `../../../../../../2026-11-05-native-and-naming/decision.md`（S-03）
- `../../../../../../../prototype/README.md`（S-01）
- `../../../../../../../../PLUGIN-DEVELOPMENT-GUIDE.md`（S-04）
- `../../../../../../../../../excalidraw/node_modules/treasure-sdk/dist/index.d.ts`（S-06）

修订后的需求覆盖和验收风险状态以同目录 `coverage.yaml` 为准。
