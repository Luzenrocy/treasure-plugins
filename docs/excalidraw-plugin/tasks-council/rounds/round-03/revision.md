# Round 03 修订记录

日期：2026-10-20

- 将官方素材库的具体入口从研究文档中移除，统一改为 T042 确认的预配置 API；删除页面打开、回跳和任意 URL 语义。
- 新增 `contracts/official-library-api.md`，只定义必须确认的配置、请求/响应、鉴权、稳定标识、checksum、清理和回滚字段，不虚构接口事实。
- 将 `SidebarNav.vue`、`official-library-client.ts`、`official-library-api.md` 和 `tool-support-matrix.md` 补入计划结构和规格追踪。
- 将任务清单扩展为 T001-T065：T042 为阻塞门，T045/T048/T049 覆盖本地素材包回退，T063 固定 SDK/宿主测试命令，T064 建立工具支持矩阵，T065 记录性能约束不设量化门槛。
- Quickstart 增加 T042 前置说明、本地回退验证、工具矩阵证据和历史自动化证据的日期/提交版本标识。
