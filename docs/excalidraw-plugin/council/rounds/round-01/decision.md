verdict: approve
round: 1
rules_snapshot: docs/excalidraw-plugin/council/rules-snapshot.yaml
ledger_version: 1
summary: "候选规格完整覆盖用户四项硬性要求，并纳入已确认的路径、范围、官方编辑器集成、显式文件保存和素材持久化决策；仅保留导出高级选项作为计划阶段的 P2 风险。"
coverage_status: complete
findings:
  - id: R-001
    disposition: fixed
    rationale: "用户确认直接集成官方 @excalidraw/excalidraw 编辑器，排除远程 iframe 和自研画布。"
    verification: "FR-001/FR-002 与外部依赖说明。"
  - id: R-002
    disposition: fixed
    rationale: "用户确认单一目录、显式保存和未保存/冲突确认。"
    verification: "FR-005–FR-009 与 SC-002。"
  - id: R-003
    disposition: accepted-risk
    rationale: "用户要求图片导出并偏好 Web 端一致；规格以 PNG/SVG 为首版基线，高级选项留给计划阶段确认。"
    verification: "FR-013–FR-016、SC-004。"
  - id: R-004
    disposition: fixed
    rationale: "用户确认素材持久保存到插件私有存储并支持离线使用。"
    verification: "FR-010–FR-012 与 SC-003。"
  - id: R-005
    disposition: fixed
    rationale: "FR-002 列出首版核心工具基线。"
    verification: "核心编辑器用户场景与 SC-001。"
  - id: R-006
    disposition: fixed
    rationale: "目标路径已由用户确认且与旧规格隔离。"
    verification: "target path = specs/004-excalidraw-plugin/spec.md。"
  - id: R-007
    disposition: fixed
    rationale: "外部能力均绑定 S-* 来源，并将动态页面与版本敏感行为标记为运行时验证。"
    verification: "source-index.md 与参考来源。"
blocking_items: []
