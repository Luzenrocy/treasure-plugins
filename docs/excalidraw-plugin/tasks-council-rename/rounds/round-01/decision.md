verdict: approve
round: 1
rules_snapshot: docs/excalidraw-plugin/tasks-council-rename/rules-snapshot.yaml
ledger_version: 2
summary: "重命名修订只将插件项目目录、脚手架命令、实现路径和身份编码改为 excalidraw，保留 004-excalidraw-plugin feature 标识、任务覆盖和目标目录。"
coverage_status: complete
findings:
  - id: R-001
    disposition: fixed
    rationale: "T003 明确 manifest.name、入口 meta 和构建包身份使用 excalidraw。"
    verification: "检查 T003 和 T037。"
  - id: R-002
    disposition: fixed
    rationale: "supporting/plan.md 与 supporting/quickstart.md 已准备同步修订副本，确保发布后的三个文档项目路径一致。"
    verification: "检查两个 supporting 文件无旧项目路径且保留 feature 路径（如适用）。"
  - id: R-003
    disposition: accepted-risk
    rationale: "旧 council 历史记录保持不可变，用新 user brief/source-index 区分历史名称；不影响当前实施路径。"
    verification: "全局扫描只允许旧名称出现在历史过程记录和 feature 标识中。"
blocking_items: []
