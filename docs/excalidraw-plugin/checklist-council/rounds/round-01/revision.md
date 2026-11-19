# round-01 修订说明

## Writer 交付

本轮基于用户简报、需求台账、adaptive contract、rules snapshot、source index 及 `spec.md`、`plan.md`、`tasks.md`、`data-model.md`、`contracts/`、`quickstart.md` 生成 CHK049–CHK106，共 58 项。所有项目均保持 `[ ]`，正文使用简体中文，技术标识符保留原文并给出中文语境。

## 重点补强

1. 将新增窗口菜单能力拆成公共 API、状态模型、事件字段、来源校验、生命周期、tab 暂停/恢复、版本协商和错误归一化，避免只检查“菜单是否存在”。
2. 将 FR-017–FR-028 与 SC-007–SC-011、菜单契约和 SDK 边界建立双向追踪，补足失败、恢复、部分失败、重载和 capability 缺失场景。
3. 将 `Result<T>`、`VALIDATION_FAILED`/`UNSUPPORTED`、`enabled` 推导、清理幂等、listener 本地 registry、瞬态字段隐私和人工验证责任转成需求质量问题。
4. 保留既有 CHK001–CHK048，不编辑目标 checklist，也不改动任何 `specs/004-excalidraw-plugin` 目标文件。

## 质量门槛自检

- 条目范围：CHK049–CHK106 连续，无重复旧 ID。
- 勾选状态：58 项全部 `[ ]`。
- 引用覆盖：58/58（100%）含 Spec/Plan/Contract/Data model/Tasks/Quickstart 引用或 `[Gap]`、`[Ambiguity]`、`[Conflict]`、`[Open question]` 标记。
- 禁止措辞：未将条目写成实现测试、代码执行、宿主手工步骤或按钮行为确认。
- 目标输出：clean-final 内容另存于 `docs/excalidraw-plugin/artifacts/append.md`，可直接追加至 reviewer-owned 目标清单。

## 待后续角色处理

Reviewer 应重点审查：是否与既有 CHK030–CHK048 发生近义重复、API 命名兼容是否被过度具体化、以及 [Gap]/[Ambiguity]/[Conflict] 是否都指向真实未决需求。Approver 应据此决定是否可发布 clean-final；本 writer 工件不自行标记通过。
