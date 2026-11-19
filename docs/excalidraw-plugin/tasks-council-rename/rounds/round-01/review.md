# Review 1

- Reviewed ledger version: 2
- Reviewed contract: `adaptive-contract.yaml`（用户修订、最小路径变更）
- Reviewed draft: `rounds/round-01/draft.md`
- Reviewed sources: 已发布 tasks.md、plan.md、quickstart.md、constitution、speckit-tasks contract
- Reviewed dimensions: rename fidelity, feature-identifier preservation, task ID/story/dependency preservation, exact paths, manifest identity, source-document consistency, scope, clean-final condition

## Findings

- id: R-001
  severity: P1
  category: clarity
  location: `T003`
  evidence: "T003 只要求配置小写 kebab-case 身份，没有明确说明冻结的插件编码必须是 `excalidraw`。"
  challenge: "项目目录改名后，实施者仍可能把 manifest.name 或入口 meta 保留为旧编码。"
  impact: "目录名、manifest、入口 meta 和构建包身份可能不一致。"
  action: "在 T003 明确 manifest.name、入口 meta 和构建包使用 `excalidraw`。"
  acceptance_check: "T003 和 manifest-consistency 任务能直接审查新插件编码。"
  status: open

- id: R-002
  severity: P1
  category: consistency
  location: `specs/004-excalidraw-plugin/plan.md`、`quickstart.md` 与候选 tasks.md
  evidence: "候选任务已使用 `excalidraw/`，但当前已发布的 plan.md 和 quickstart.md 仍使用 `excalidraw-plugin/` 项目目录。"
  challenge: "只发布 tasks.md 会让实施者看到任务与设计/验证文档的项目路径不一致。"
  impact: "执行 quickstart 或按 plan 项目结构实施时会回到旧目录。"
  action: "为 plan.md 和 quickstart.md 生成同一重命名修订副本，并在最终发布确认时同步写入；feature 路径 `specs/004-excalidraw-plugin/` 保持不变。"
  acceptance_check: "发布后的 plan、quickstart、tasks 三者项目路径统一为 `excalidraw/`，feature 标识仍为 `004-excalidraw-plugin`。"
  status: open

- id: R-003
  severity: P2
  category: delivery
  location: council 历史文件
  evidence: "旧 council round 和 publish 记录保留 `excalidraw-plugin`。"
  challenge: "历史记录中的旧名称如果被当作当前实现路径会造成误解。"
  impact: "审计材料需要区分历史版本与当前修订。"
  action: "保留历史记录不改写，在新 council 的 user brief、source-index 和 publish 记录中注明旧记录是历史版本。"
  acceptance_check: "新候选不含旧项目路径；历史文件只作为不可变过程记录。"
  status: accepted-risk

No unresolved P0 findings. R-001 and R-002 are fixed in the revision; R-003 is an accepted historical-record risk.
