# 首稿记录：round 01 / iteration 01

- 独立主写者仅从规则、用户原文/台账、合同和来源文件起草，没有继承协调对话。
- 核心建议：SimpleMindMap 为有门槛的优先 PoC 候选，Mind Elixir 为对照；不隐藏 SMM 低维护、闭源客户端与开源能力插件的边界。
- 推荐新增 `.treasuremind` 工作簿原生包为明确提案，写清维护与用户成本；普通单 sheet `.smm` 可直接保存，Xmind 导入副本默认另存原生包，不宣称未知字段保留等于无损回写。
- 完成格式R/E/W/RT、Xmind全部sheet/资源/高级语义、SDK能力缺口、文件生命周期、具体UI与分阶段验收。
- 已整合概念PNG/目标态说明、删除当前脏文件另存副本保护、唯一撤销源、generation/revision guard、IME和初始颜色检查边界。
- 技术决策编号采用 ADR-01..05，避免与需求台账已有 D-01/D-02 含义冲突。
- 更新台账定位与检查计数；hard项 satisfied 只表示本次方案覆盖，未表示插件已实现。宿主与SMM方言假设保持open。
- 本轮无 prior review findings；独立 reviewer/checker 尚未开始，未虚构通过结论。没有运行插件、PoC、兼容或性能测试。
