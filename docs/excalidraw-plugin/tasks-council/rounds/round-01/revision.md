# Revision 1

主写者依据 Review 1 处理全部发现：

- **R-001（优先级歧义）**：在组织方式中标注 US1/US2/US3 的 P1/P2 分组是基于已发布计划 MVP 的 `[Assumption]`，规格排序变化时只调整优先级。
- **R-002（SDK 初始化）**：T009 明确 `src/main.ts` 中 `initTreasure()` 必须先于 Vue mount。
- **R-003（非目标边界）**：T010/T019 明确关闭浏览器文件动作并不注册或显示协作、账户、分享、云端同步和 Excalidraw+ 入口。
- **R-004（手工证据路径）**：T040/T041 指定 `excalidraw-plugin/docs/host-validation.md`。
- **R-005（API 探针）**：T010、T015、T023、T030 统一引用锁定版本的 `test/adapters/excalidraw-api-probe.ts` 和类型检查门槛。

任务数量和阶段结构保持不变，所有任务仍未勾选。
