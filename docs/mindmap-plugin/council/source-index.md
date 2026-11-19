# 来源索引

访问日统一为 **2026-11-04（Asia/Shanghai）**。本次研究以官方文档、作者仓库、官方源码及当前本地仓库为依据；没有执行候选库 PoC、运行商业客户端、进行兼容往返或性能实测。“主流”采用多个代表性产品/框架覆盖，不代表市场份额排名。

| 来源组 | 证据文件 | 主要用途 | 边界 |
| --- | --- | --- | --- |
| S-ENG | [source-engines.md](source-engines.md) | SimpleMindMap、Mind Elixir、Markmap、AntV X6/G6、React Flow、ELK/Dagre；格式/维护/许可/嵌入 | 含每条官方 URL；main 分支观察不等于 npm 最新版；未运行 |
| S-RENDER | [source-rendering.md](source-rendering.md) | SVG/DOM/Canvas/WebGL 渲染事实与工程取舍 | 技术取舍为推断；未核实现行 Xmind 内部框架 |
| S-XM | [source-xmind.md](source-xmind.md) | Xmind 实际功能、格式族、官方 SDK/viewer、MindNode/EdrawMind 界面依据 | 指南能力不等于所有套餐；不同平台/版本分别注明 |
| S-LOCAL | [source-local.md](source-local.md) | Treasure 插件约束、实际 SDK 2.1.1 接口、Excalidraw 目录和导入实现 | 含文件绝对路径与 SHA-256；只读检查，非产品运行验证 |
| S-USER | [user-brief.md](user-brief.md)、[requirements-ledger.yaml](requirements-ledger.yaml) | 用户必需功能和范围 | 产品需求为权威，不由竞品反向删减 |
| S-DESIGN | 本轮 draft companion `rounds/round-01/iterations/iteration-01/ui-concept.svg` | 自行设计的概念 UI 草图；[初始颜色校验](design-validation.md) | 属于提案，非来源产品截图，需 review/checker 一起检查 |

引用规则：主文关键事实就近链接原始官方 URL；本地事实链接实际本地文件；事实、研究推断、方案决定与待验证项分开。所有链接是本次访问快照，实施时需锁定版本、源码 commit 和随包许可证。

来源细项与逐条用途均在三份证据文件中。网络曾发生批量请求超时，未以未返回页面支撑事实。
