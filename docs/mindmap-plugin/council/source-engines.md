# 思维导图引擎来源研究（非最终技术方案）

访问日期统一为 **2026-11-04**。只使用项目官方文档、官方 GitHub 仓库或作者维护的源码。下文的“事实”指来源明确陈述或源码可见；“推断”是对本项目适用性的判断；“待验证”不能写成产品承诺。本研究未以 star 数判断质量，也未运行候选库或进行文件往返实测。

## 先给方案作者的关键证据

1. **事实：SimpleMindMap 的 `.smm` 是 JSON 换扩展名。** 官方文档完整配置形态含 `layout`、`root`、`theme: { template, config }`、`view`；无配置模式只有节点树。不能只读文本层级后宣称完整支持 `.smm`。[官方导入导出](https://wanglin2.github.io/mind-map-docs/course/course17.html)
2. **事实：SimpleMindMap 当前官方 README 明确开源库/Web“已进入低维护状态”，客户端和宿主插件闭源且积极维护。** README 的客户端特性（自由节点、更多布局等）不能直接算作 MIT 核心能力。[当前官方 README](https://github.com/wanglin2/mind-map)
3. **事实：MIT 开源库明确不实现多个根的自由节点，也不实现概要节点后继续加节点。** 因此“类似 Xmind”应限定为常规单根思维导图体验。[开源库能力说明](https://github.com/wanglin2/mind-map/blob/main/README_MORE_ZH.md)
4. **推断：若 `.smm` 特指思绪 JSON，SimpleMindMap 最省格式转换与基本编辑工作，仍需以技术验证通过为采用前提。** 应预算锁版本、维护分支、修复导出与宿主交互的责任，不能假设上游持续补齐功能。Mind Elixir 应进入同一小规模样例验证作为替代；它已存在官方 `.xmind` 导入包，不能误写为只支持导出。

## `.smm` 歧义

| 标签 | 已证实内容 | 来源与方案含义 |
|---|---|---|
| 事实 | SimpleMindMap 的 `smm(name, withConfig)` 与 `json()` 返回内容相同，属于自定义 JSON 格式。 | [SMM Export 插件](https://wanglin2.github.io/mind-map-docs/plugins/doExport.html)。这是本需求最直接可实现的 `.smm` 解释。 |
| 事实 | 独立产品 **SimpleMind** 当前官方说明原生共享格式是 `.smmx`；FreeMind `.mm` 和 OPML 属于基本内容交换，会损失图片等附加内容。 | [SimpleMind 官方格式说明](https://simplemind.eu/faq/share-in-mind-map-formats/)。它与 SimpleMindMap 是不同产品，不能混为一谈。 |
| 待验证 | 本轮官方来源未查证 SimpleMind 旧 `.smm` 的完整规范，也未查证 `.smmx` 与思绪 JSON 兼容。 | 不应凭扩展名作自动互认。方案可记 U 项：默认 `.smm` 指 SimpleMindMap/思绪 JSON；若实际文件来自 SimpleMind，则需样本及额外转换器。 |
| 推断 | 导入时根据内容结构识别 JSON、ZIP 等，不应改后缀就当兼容；不认识的 `.smm` 应明确报格式不支持。 | 来自以上格式差异；不是已实现能力。 |

## SimpleMindMap：嵌入与编辑

**事实**：框架无关，能放入 React/Vue 或原生 DOM 容器；初始化 `new MindMap({ el, data })`。容器位置变化需 `getElRectInfo()`，尺寸变化需 `resize()`；渲染异步，`setData` 等之后的 fit 操作应等待 `node_tree_render_end`。[构造函数](https://wanglin2.github.io/mind-map-docs/api/constructor/constructor-options.html)

**事实**：`setData` 设置纯节点树，`setFullData` 设置节点、布局、主题、视图；`getData(true)` 取完整数据；`destroy()` 清插件、事件、画布节点；`execCommand('REMOVE_NODE', ...)` 是节点删除入口。[实例方法](https://wanglin2.github.io/mind-map-docs/en/api/constructor/constructor-methods.html)

**事实**：`mindMap.view.fit()` 适应画布，`reset()` 恢复默认变换，另可获取和设置平移/缩放。[视图 API](https://wanglin2.github.io/mind-map-docs/api/view.html)

**推断**：用户的“打开/关闭/重置画布/删除/导出”可以建立清楚边界：打开由宿主文件系统读取后交给引擎；关闭释放实例并保存状态；视图复位调用 view API。文件列表、目录 CRUD、文件删除、脏状态与磁盘持久化属于插件宿主，不能因引擎能删除节点就视为已有文件管理。现代外观可由宿主工具栏、属性面板、配色和节点主题提供，不必直接移植 Vue 2/ElementUI demo。

## SimpleMindMap：布局、插件、导出

**事实**：基础配置支持逻辑结构、左右脑图、组织、目录、时间轴、鱼骨等；v0.12 起核心只有默认主题，其他主题拆为 `simple-mind-map-plugin-themes`，官方页面归为“免费”，通过 `Themes.init(MindMap)` 注册。[主题插件](https://wanglin2.github.io/mind-map-docs/plugins/themes.html)

**事实**：开源库说明列出 RichText、Drag、Select、AssociativeLine、Export、MiniMap、Search、RainbowLines 等可按需插件。普通文本、富文本、图片、链接、备注、标签、概要均有对应能力。[库 README](https://github.com/wanglin2/mind-map/blob/main/README_MORE_ZH.md)

**事实**：Export 提供 PNG、JPG、SVG、JSON/SMM、Markdown、TXT；PDF 需 ExportPDF，Xmind 需 ExportXMind。官方特别说明 PDF 使用图片转 PDF，大图可能丢内容，需实际验证。[Export 文档](https://wanglin2.github.io/mind-map-docs/plugins/doExport.html)

**源码事实**：Xmind 解析器使用 JSZip，优先读取 `content.json`，否则 `content.xml`；新版多画布可交给 `handleMultiCanvas` 回调选择，否则默认第一个。可见转换处理文本、备注、HTTP(S) 链接、标签、图片、概要与 attached 子树。导出代码对每个节点写固定的右向逻辑结构，注释明确暂不考虑样式。**推断：不能承诺 Xmind 原样往返或样式保真。** 其 detached 自由主题、关系线、边界等复杂结构的保留，必须逐项实测；源代码不等于全格式规范。[当前解析/导出源码](https://raw.githubusercontent.com/wanglin2/mind-map/main/simple-mind-map/src/parse/xmind.js)

**待验证/文档差异**：导出文档概括为 data URL；当前 Xmind 源码返回 Blob。适配层应以锁定版本的实际返回值为准，统一成 Blob/bytes，不在方案中照抄过时签名。[ExportXMind 源码](https://raw.githubusercontent.com/wanglin2/mind-map/main/simple-mind-map/src/plugins/ExportXMind.js)

**事实**：当前 main 分支 `simple-mind-map/package.json` 为 `0.14.0-fix.3`，MIT，依赖 svg.js、JSZip、Quill、KaTeX、pdf-lib、Yjs 等。此为仓库观察值，不能代替 npm 最新版本证明。[package.json](https://raw.githubusercontent.com/wanglin2/mind-map/main/simple-mind-map/package.json)

## 许可证与商业边界

**事实**：仓库 LICENSE 是 MIT，允许使用、修改、分发和销售，要求版权与许可声明随副本/主要部分保留。[实际 LICENSE](https://raw.githubusercontent.com/wanglin2/mind-map/main/LICENSE)

**事实**：中文官方文档要求保留 SimpleMindMap 版权和来源，可放 About、帮助或开源声明页；若要去除，作者提供付费联系途径。[中文许可说明](https://wanglin2.github.io/mind-map-docs/start/introduction.html)

**事实/限定**：主仓库将“客户端和插件”描述为闭源，所指宿主客户端/Obsidian/uTools 产品；同仓库 `src/plugins` 中公开的能力插件仍是该仓库代码。不能把两者混成“所有插件收费/闭源”，也不能因核心 MIT 就宣称客户端软件可复用。

**待验证**：单独发布主题包及未来引入的独立扩展应逐个检查其锁定版本的 LICENSE。本轮只确认官方页面列为免费，未把“免费”直接推断为所有内容都属 MIT。图片、字体、图标也需按所选资源实际许可记录；这不是阻断当前技术方案的理由。

## 其他候选的证据对比

| 候选 | 已核实事实与官方来源 | 适用性推断 / 待验证 |
|---|---|---|
| Mind Elixir | 框架无关的脑图核心；有 CSS 变量主题、左右/双侧、快捷键、拖拽、撤销重做、关系线/概要、SVG/PNG、JSON 等能力。[官方首页](https://docs.mind-elixir.com/)。API 有 `init`、`refresh`、`getData`、`destroy`、`scaleFit`、`toCenter`；切文件后 `clearHistory` 避免撤销回旧文档。[当前 API](https://docs.mind-elixir.com/docs/api/mind-elixir.mindelixir) | 是真正的脑图编辑核心，可与 SMM 做概念验证。接入思绪 `.smm` 需要自写字段适配器；布局种类与思绪风格覆盖应实测，不能只看首页演示。 |
| Mind Elixir Xmind 生态 | 官方组织的 `@mind-elixir/import-xmind` 支持新版 JSON Xmind、旧 XML Xmind，返回多个 sheets，再转为 MindElixirData；README 列出文本层级、样式、图片、关系、概要等，同时明确 detached topics 和附件等不支持/受限。[导入包](https://github.com/mind-elixir/import-xmind/blob/main/README.md)。官方文档列 `@mind-elixir/export-xmind` 和 HTML 输出扩展。[插件文档](https://docs.mind-elixir.com/docs/advanced-guides/plugins) | 不应因旧知识否定其 Xmind 导入；同样不能把 README 的“支持”当成往返保真证明。导入器本轮只源码/文档核查，未实测。 |
| Mind Elixir 许可 | 核心 LICENSE 是 MIT。[LICENSE](https://raw.githubusercontent.com/SSShooter/mind-elixir-core/master/LICENSE)。导入包 README 也声明 MIT。 | 商业宿主可集成，保留声明；各输出扩展仍需锁版核查。 |
| Markmap | 从 Markdown 提取层次，用 `markmap-lib` 转换，再由 `markmap-view` 输出交互 SVG；有 React/Vue 示例。[官方 docs](https://markmap.js.org/docs)。仓库 MIT。[官方仓库](https://github.com/gera2ld/markmap) | 适合 Markdown 到脑图预览、折叠与导航。要做接近 Xmind 的图形直接编辑、原生 `.smm`、Xmind 导入导出，需要大量另建功能，非当前主引擎优先项。没有因“不见 API”断言绝对不能编辑。 |
| AntV X6 | HTML/SVG 图编辑引擎，支持自定义 SVG/HTML/React/Vue/Angular 节点，内建选择、对齐线、小地图等扩展。[官方介绍](https://x6.antv.antgroup.com/en/tutorial/about)。官方仓库 MIT。[仓库](https://github.com/antvis/X6) | 适合自建通用图形编辑平台。脑图的父子语义、插入/重排、布局、SMM/Xmind 转换、主题与导出保真均需自行组织，本项目投入明显高于专用核心。 |
| AntV G6 | 图可视化框架，Mindmap 布局支持左右两侧、节点尺寸、间距和 `getSide`。[脑图布局](https://g6.antv.antgroup.com/en/manual/layout/mindmap-layout)。有树布局及 History、Minimap 等扩展。[官方文档目录](https://g6.antv.antgroup.com/en/docs/manual/)。官方仓库 MIT。[仓库](https://github.com/antvis/G6) | 适合数据驱动的关系图与自定义脑图，可做更大可视化平台的底座；完整编辑器和文件格式需要自建，不能把布局示例算成现成 Xmind 编辑器。 |
| React Flow | 官方说明本身没有自动布局方案，使用外部 Dagre、D3 hierarchy、ELK 等。[布局总览](https://reactflow.dev/learn/layouting/layouting)。仓库 MIT。[LICENSE](https://github.com/xyflow/xyflow/blob/main/LICENSE) | 适合 React 节点画布；若仅为本次脑图重造编辑语义与格式转换，工作量较大。官方 Auto Layout 组合示例属于 Pro License，不能把整个网站示例全部当 MIT。[Pro 示例](https://reactflow.dev/examples/layout/auto-layout) |
| ELK / elkjs | 只算元素位置，不提供渲染、样式或图编辑器；支持端口与有向层次图。[官方仓库](https://github.com/kieler/elkjs)。许可证 EPL-2.0。[LICENSE](https://raw.githubusercontent.com/kieler/elkjs/master/LICENSE.md) | 作为自研引擎的布局组件有价值，配置复杂；不是 Xmind 替代品。若引入需记录与 MIT 不同的许可条款。 |
| Dagre | 客户端有向图布局；官方只推荐仍更新的 DagreJs npm 包，MIT。[官方仓库](https://github.com/dagrejs/dagre) | 适合相对简单的层次树。对复杂脑图形状、富文本编辑、文件处理均无现成解决。React Flow 官方比较列其无边路由，嵌套子图有已知限制。[布局比较](https://reactflow.dev/learn/layouting/layouting) |

## 建议验证顺序（仅研究结论，不是最终排期）

**推断**：首轮并列验证 SimpleMindMap 与 Mind Elixir。若 `.smm` 是不可妥协的思绪原生格式、布局较丰富且节点规模适中，SimpleMindMap 有最直接的数据适配优势；选择理由必须附带低维护风险和团队承接修补能力。若更看重持续升级空间、较简单的脑图布局、CSS 外观与自持数据模型，Mind Elixir 值得优先比较；其 `.smm` 保真成本也不能低估。

**待验证清单**：中文输入法与快捷键；宿主 webview 中焦点与滚轮；关闭时提交文本编辑与自动保存；容器 resize 和事件清理；300/1000 节点的真实机器交互；SMM 未知字段保留；旧/新 Xmind、多 sheet、图片、备注、概要、关系线、边界、附件、自由主题的导入损失清单；PNG/SVG 的中文字体和嵌图；Xmind 导出的可读性与样式损失；版本锁定与可维护 fork。性能阈值不能从上游示例或作者经验直接变成本项目 SLA。

**推断**：文件目录结构和打开/关闭/删除逻辑应复用本仓库现有 Excalidraw 的宿主模式，引擎只负责画布；本研究未检查本地 Excalidraw 实现，不对具体文件路径和存储 API 作结论。
