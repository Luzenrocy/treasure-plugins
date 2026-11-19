# Review 1

- Reviewed ledger version: 1
- Reviewed contract: `adaptive-contract.yaml`（hybrid normative，zh-CN）
- Reviewed draft: `rounds/round-01/draft.md`
- Reviewed sources: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/`、`quickstart.md`、constitution、tasks template
- Reviewed dimensions: user-story coverage, priorities, task format, exact paths, dependencies, parallel markers, SDK/security boundaries, test/manual gates, scope, language, target path, clean-final condition

## Findings

- id: R-001
  severity: P1
  category: ambiguity
  location: `rounds/round-01/draft.md`, 顶部组织方式与 US1-US3 标题
  evidence: "spec.md 有四个用户场景，但没有显式 P1/P2 优先级；draft 直接把场景 1/2 合并为 P1、素材库和导出设为 P2。"
  challenge: "任务优先级可能被误读为产品已确认决策。"
  impact: "实施者可能按未经确认的排序投入资源。"
  action: "明确这是基于计划 MVP 和范围的 [Assumption]，并说明如产品排序改变只调整阶段标签，不改变任务覆盖。"
  acceptance_check: "draft 的组织方式和实施策略标注该假设及其来源。"
  status: open

- id: R-002
  severity: P1
  category: omission
  location: `T001-T012`
  evidence: "plan.md 要求 `src/main.ts` 在挂载 Vue 前调用 `initTreasure()`，但 draft 没有一条任务明确创建或审查该文件。"
  challenge: "脚手架虽可能生成入口，但任务清单没有把 SDK 初始化作为可追踪的基础门槛。"
  impact: "实现可能在 React/服务可用前遗漏宿主初始化。"
  action: "在 Foundational 任务中明确 `excalidraw-plugin/src/main.ts` 的 `initTreasure()` 初始化和错误边界。"
  acceptance_check: "任务包含该路径，且基础验证明确初始化先于 Vue mount。"
  status: open

- id: R-003
  severity: P1
  category: scope
  location: `T010`、`T019`
  evidence: "draft 关闭浏览器文件动作，但没有单独的任务审查协作、账户、分享、云端同步和 Excalidraw+ 入口。"
  challenge: "默认菜单或产品入口可能把首版非目标带入实现。"
  impact: "实现边界与 FR-001、非目标和 constitution 不一致。"
  action: "把非目标入口排除和 UIOptions 菜单审查写入 React bridge/App 集成任务，并在任务验收中记录。"
  acceptance_check: "任务明确不注册/不显示这些入口，且有 release-boundary 测试或人工证据。"
  status: open

- id: R-004
  severity: P2
  category: delivery
  location: `T040`
  evidence: "T040 要求宿主手工验证，但没有指定证据文件路径；任务格式要求每项包含明确路径。"
  challenge: "实施者不知道手工结果应保存在哪里，SC-006 的证据可能丢失。"
  impact: "发布验证无法追踪。"
  action: "指定 `excalidraw-plugin/docs/host-validation.md` 作为宿主证据索引，并在 T041 统一回填。"
  acceptance_check: "T040/T041 都包含该路径，quickstart 和 README 链接到它。"
  status: open

- id: R-005
  severity: P2
  category: completeness
  location: `T015`、`T023`、`T030`
  evidence: "任务提及序列化、库校验和导出，但没有明确要求实现探针使用锁定包的实际 Excalidraw 0.18.1 类型签名。"
  challenge: "官方文档与安装包签名可能漂移，任务缺少显式的兼容性确认点。"
  impact: "实现阶段可能在最后构建时才发现 API 类型不匹配。"
  action: "把 API probe 文件和 `vue-tsc` 类型门槛写入 T010/T015/T023/T030 的描述或共享测试任务。"
  acceptance_check: "基础阶段和三个故事服务都能在类型检查中证明使用锁定版本导出。"
  status: open

No P0 findings. P1 findings must be fixed before approval; P2 findings are actionable and should be fixed in the same round.
