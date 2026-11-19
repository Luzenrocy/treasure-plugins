# Round 03 文档修订候选稿

日期：2026-10-20

本轮根据 `speckit-analyze` 的 U1、I1、U2、I2、A1、A2、U3、I3 反馈修订六份核心文档：

1. `spec.md` 增加 2026-10-20 澄清，明确官方 API 详细契约确认是 US3 实现前置门，继续禁止任意 URL 和页面跳转。
2. `plan.md` 日期更新为 2026-10-20；新增 `contracts/official-library-api.md`、`SidebarNav.vue`、`official-library-client.ts` 和 `excalidraw/docs/tool-support-matrix.md` 的结构说明；新增官方 API 契约确认决策、本地素材回退、工具支持矩阵及性能设计约束；补充跨仓库 SDK/宿主测试命令。
3. `quickstart.md` 删除 `libraries.excalidraw.com` 页面/回跳表述，改为调用预配置官方 API；增加本地素材包回退、工具矩阵、性能约束和历史测试证据的日期/提交版本说明。
4. `tasks.md` 将任务扩展为 T001-T065：T042 作为官方 API 契约阻塞门，T045 增加本地素材包选择/读取/校验/安装，T064 增加工具支持矩阵，T063 补充 SDK/宿主实际测试命令，T065 记录性能约束不设量化门槛。
5. `research.md` 将素材方案统一为 T042 确认的预配置官方 API，并保留 SDK 本地文件回退；`contracts/excalidraw-scene.md` 同步删除远程回跳语义。
6. `contracts/official-library-api.md` 新增配置位置、请求/响应、鉴权、稳定标识、checksum、临时包清理和回滚的待确认清单，作为 T042 的阻塞依据。

本轮不填写未确认的官方 URL、鉴权字段、响应字段或 checksum 算法；这些内容留在契约门中，确认后才能解除 T042 阻塞。
