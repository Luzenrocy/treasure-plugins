# Review findings: round 01, iteration 01

检查输入：ledger v1、adaptive-contract v1、S-001 至 S-006，以及 draft.md / coverage.yaml。已检查用户忠实度、范围、公开 API 边界、模型一致性、保存打开、撤销重做、失败路径和验证可测性。

- id: R-001
  severity: P1
  category: ambiguity
  location: "draft §6、§9、§10"
  evidence: "草案称 rectangle 保存恢复模型所需字段，但没有规定 rootId、布局参数、版本/修订号和每个元素元数据的完整最小集合。"
  challenge: "撤销、重做或重开文件后，Repository 可能得到互相矛盾的节点片段，无法确定应信任哪个文档快照。"
  impact: "编辑模式的持久化和撤销重做不能可靠验收。"
  action: "定义 versioned 的可恢复快照字段；要求同一事务内所有受控 node/label/edge 带相同 revision，并规定扫描冲突时的失败策略。"
  acceptance_check: "文档能从任一完整 revision 的元素集合唯一重建 MindMapDocument，且说明混合 revision/缺失字段时的降级行为。"
  status: open

- id: R-002
  severity: P1
  category: consistency
  location: "draft §8、§9"
  evidence: "草案一面禁止自由拖拽作为结构入口，一面提出在 onChange 检测几何偏离后恢复布局，但未规定回滚 updateScene 的 captureUpdate、去抖和用户撤销语义。"
  challenge: "用户拖动可产生额外历史项或与 pendingTransaction 确认竞争，导致撤销栈与模型不一致。"
  impact: "用户会看到跳动/无法预测的撤销行为，违反单命令单历史项目标。"
  action: "将拖拽回正定义为 captureUpdate: NEVER 的防护性恢复，并限定只对非事务来源且完整 metadata 的受控图执行；或明确首版锁定交互并验证仍可选择节点。"
  acceptance_check: "方案给出回正事务状态机、不会重入 onChange 的条件，以及拖拽后 history 不新增条目的集成测试。"
  status: open

- id: R-003
  severity: P2
  category: omission
  location: "draft §8、§11"
  evidence: "新增分支流程校验了标题和节点存在性，但未将当前导入器的节点数/标题长度上限扩展到编辑命令，也没有覆盖循环结构/重复 ID 的防御。"
  challenge: "连续新增可能绕过导入时的资源限制或写出无法恢复的模型。"
  impact: "大图性能与保存完整性缺乏一致保护。"
  action: "把命令层限制、ID 唯一性和 parent/child 无环验证列为前置校验，并加入测试。"
  acceptance_check: "新增达到上限、重复 ID、删除根、循环 parentId 均被拒绝且 scene 不变。"
  status: open

- id: R-004
  severity: P2
  category: acceptance
  location: "draft §11"
  evidence: "文本测试要求中心一致，但没有给出允许误差及长文本、多语言/emoji、极小视口下的测试样本。"
  challenge: "视觉问题可能在中文多行样本以外重新出现。"
  impact: "U-004 的验收不可重复。"
  action: "定义几何中心的浮点容差，并加入中英文、emoji、原始换行和极长标题样本；视口只影响 UI，不应影响模型布局。"
  acceptance_check: "测试矩阵给出样本与中心误差阈值。"
  status: open
