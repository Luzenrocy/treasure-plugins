# Review 1

- Reviewed ledger version: 1
- Reviewed contract: `adaptive-contract.yaml`（hybrid normative，zh-CN）
- Reviewed draft: `rounds/round-01/draft.md`
- Reviewed sources: `source-index.md`、`spec.md`、constitution、SDK guide/API、Excalidraw official docs
- Reviewed dimensions: user fidelity, scope and non-goals, required sections, source traceability, technical unknowns, SDK/Result boundaries, file/privacy safety, accessibility, failure recovery, validation, language, exact target path, clean-final condition

## Findings

- id: R-001
  severity: P2
  category: scope
  location: `specs/004-excalidraw-plugin/contracts/ui-lifecycle.md`, 状态和控件
  evidence: "契约明确关闭浏览器文件动作，但没有把账户、协作、分享和云端入口的排除写成可验收的 UI 条件。"
  challenge: "实现者可能保留 Excalidraw 默认的非本地产品入口，导致首版范围与 FR-001 的非目标边界不够可检查。"
  impact: "宿主手测无法明确证明非目标没有被意外暴露。"
  action: "增加 UI 契约和 quickstart 检查：协作/账户/分享/云端入口不注册、不显示；仅保留本地画布工具和 Treasure 工具栏。"
  acceptance_check: "契约列出非目标 UI 验收，quickstart 有对应人工检查。"
  status: open

- id: R-002
  severity: P2
  category: source
  location: `specs/004-excalidraw-plugin/research.md` 决策 5 与 `source-index.md`
  evidence: "计划说使用官方 library hash/return 流程，但来源索引没有列出用户指定的 libraries.excalidraw.com 地址，也没有明确该地址的协议变化和本地回退证据。"
  challenge: "读者无法把素材库入口决策与规格中的官方来源对应起来。"
  impact: "素材网络失败和来源变化的验证边界不够可追踪。"
  action: "加入官方素材库 URL 来源，说明 hash/manifest 仅作为不可信网络输入，并将本地 `.excalidrawlib` 回退加入 quickstart 证据。"
  acceptance_check: "source-index、research、quickstart 三处能互相链接官方素材库和回退步骤。"
  status: open

No P0/P1 findings. All hard ledger entries have coverage rows; the two P2 findings are fixed in the revision below.
