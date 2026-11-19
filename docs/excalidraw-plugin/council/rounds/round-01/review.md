# Review 1

- Reviewed ledger version: 1
- Reviewed contract: `adaptive-contract.yaml` (hybrid normative feature specification, zh-CN)
- Reviewed sources: S-001 through S-006
- Reviewed draft: `round-01/draft.md`
- Dimensions checked: user fidelity, negative scope, source support, reader fit, clarity, verification, Treasure SDK boundaries, security/privacy, accessibility, dependency and maintenance risk.

## Findings

- id: R-001
  severity: P1
  category: ambiguity
  location: FR-001/FR-002 and external dependencies
  evidence: "The draft leaves React/Vue integration open while making the editor a hard requirement."
  challenge: "The implementation cannot choose the page mount, build, lifecycle, or state bridge without a decision."
  impact: "Architecture and task decomposition may diverge from the intended plugin boundary."
  action: "User selected direct integration of the official @excalidraw/excalidraw editor; record this as a hard integration boundary."
  acceptance_check: "The spec names direct official editor integration and excludes remote iframe and self-built canvas alternatives."
  status: fixed

- id: R-002
  severity: P1
  category: ambiguity
  location: FR-008, OQ-002, DrawingFile
  evidence: "The draft does not choose explicit save, autosave, or conflict behavior."
  challenge: "A file can be overwritten or lost when the same drawing is changed outside Treasure or when the user closes with unsaved changes."
  impact: "File lifecycle, data-loss prevention, and tests remain undefined."
  action: "User selected one configured directory, explicit save, and confirmation for unsaved, external-change, duplicate-name, or cancel outcomes."
  acceptance_check: "The spec requires one directory, explicit save, unsaved-change prompts, and confirmation for overwrite, external change, duplicate name, or cancel."
  status: fixed

- id: R-003
  severity: P2
  category: acceptance
  location: FR-013–FR-016, OQ-004
  evidence: "The user asks for image export similar to Excalidraw.com, but the draft only requires PNG or SVG and leaves options open."
  challenge: "The team cannot verify whether format, background, range, scale, or clipboard behavior is complete."
  impact: "Export implementation and acceptance evidence may be incomplete or overbuilt."
  action: "Keep PNG/SVG as a documented baseline and defer optional formats, range, background, scale, and clipboard choices to planning unless the user specifies otherwise."
  acceptance_check: "The spec lists exact formats, defaults, target selection, and failure behavior."
  status: accepted-risk

- id: R-004
  severity: P1
  category: security
  location: FR-010–FR-012, OQ-003
  evidence: "The official library site is remote and the draft allows session or persistent library storage without a decision."
  challenge: "The plugin needs a defined trust, cache, update, attribution, and offline behavior for remote `.excalidrawlib` data."
  impact: "A remote failure or malformed library could corrupt state or produce an unverifiable user experience."
  action: "User selected plugin-private persistent storage with offline reuse; retain validation, update, removal, and failure recovery requirements."
  acceptance_check: "The spec defines plugin-private persistence, offline reuse, validation, update, removal, and failure recovery."
  status: fixed

- id: R-005
  severity: P2
  category: acceptance
  location: FR-002 and Scope
  evidence: "The phrase '等编辑器核心能力' is open-ended."
  challenge: "Different readers may interpret the core tool set differently."
  impact: "Coverage and test completeness cannot be measured consistently."
  action: "The draft lists the exact first-release tool baseline in FR-002; optional tools remain subject to package-version verification in planning."
  acceptance_check: "FR-002 names every baseline tool and the acceptance scenarios cover those tools."
  status: fixed

- id: R-006
  severity: P2
  category: consistency
  location: Data and file model, FR-005–FR-009
  evidence: "The draft correctly follows the repository guide's SDK reference and Result requirements, but the current active spec is a separate JSON/Text Diff feature."
  challenge: "Publishing this candidate to the wrong feature path would mix unrelated requirements."
  impact: "The existing feature history and downstream plan would become misleading."
  action: "Keep the target `specs/004-excalidraw-plugin/spec.md` and do not modify `003-prototype-source-parity`."
  acceptance_check: "The final publication path matches the user's confirmed A answer."
  status: fixed

- id: R-007
  severity: P2
  category: source
  location: Overview and References
  evidence: "The draft summarizes official capabilities but mostly points to source IDs rather than direct links at each claim."
  challenge: "A reviewer may not know which source supports a specific export or library statement."
  impact: "Source verification is slower and dynamic web behavior may be mistaken for a guaranteed API."
  action: "Keep the source index and attach source IDs to claims that affect scope; mark dynamic web behavior and version-sensitive APIs as requiring runtime verification."
  acceptance_check: "Every external capability claim has an S-* source or an explicit assumption/open-question label."
  status: fixed
