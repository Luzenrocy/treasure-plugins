# Revision map: round 01, iteration 01

| Finding | Disposition | Change | Evidence |
| --- | --- | --- | --- |
| R-001 | fixed | §6 定义 revisioned metadata 的完整最小字段、恢复一致性规则和混合 revision 降级。§9 使用 revision 验证撤销/重做。 | 草案 §6、§9 |
| R-002 | fixed | §8 将首版交互改为锁定受控元素 + 抽屉命令，不在 `onChange` 中回正或重排；§9 明确回调只确认事务。 | 草案 §8、§9 |
| R-003 | fixed | §8 添加统一命令层上限、标题、重复 ID、根节点、无环验证；§11 加入拒绝用例。 | 草案 §8、§11 |
| R-004 | fixed | §11 添加中心误差阈值与多语言/emoji/原始换行/长标题样本。 | 草案 §11 |
