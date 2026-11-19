# 渲染形态补充研究

访问日期：2026-11-04。此处补充前轮已核实官方资料，并追加最多两次直接浏览；第二次请求超时，未将未取得的内容当作证据。

| 候选 | 可以写入主文的事实 | 官方证据 |
|---|---|---|
| SimpleMindMap | 以 SVG 为主要图形表示，依赖 `@svgdotjs/svg.js`；导出代码操作 SVG 节点。富文本开启时 SVG 中可含 `foreignObject` 的 HTML 内容，不能简单称为“纯 SVG 文本”。 | [package.json](https://raw.githubusercontent.com/wanglin2/mind-map/main/simple-mind-map/package.json)、[Export.js](https://raw.githubusercontent.com/wanglin2/mind-map/main/simple-mind-map/src/plugins/Export.js)。后者明确获取 SVG、处理 image/img、foreignObject 及样式。 |
| Mind Elixir | 节点使用 HTML/DOM，并以 CSS 变量控制主题；连线/箭头/概要存在 SVG 元素，属于 DOM/HTML 与 SVG 组合。API 的 `nodes`、`container` 为 HTMLElement，`lines`、`arrowSvg` 等为 SVGElement；不是 Canvas 专用渲染器。 | [当前 API 类型](https://docs.mind-elixir.com/docs/api/mind-elixir.mindelixir)、[官方首页的 CSS 主题说明](https://docs.mind-elixir.com/)、[官方博客的 div 导图图片导出说明](https://docs.mind-elixir.com/blog)。本轮未完成逐个绘制函数源码核对，避免进一步断言所有节点/路径的细节。 |
| Markmap | `markmap-lib` 把 Markdown 转为结构化数据，`markmap-view` 渲染交互 SVG。 | [官方文档](https://markmap.js.org/docs)。 |
| AntV X6 | 官方定义为基于 HTML 和 SVG 的图编辑引擎，支持 SVG/HTML/React/Vue/Angular 自定义节点。 | [官方介绍](https://x6.antv.antgroup.com/en/tutorial/about)。 |
| AntV G6 | 当前官方文档明确默认 Canvas；通过 `@antv/g-svg`、`@antv/g-webgl` 支持 SVG 和 WebGL，还可按图层配置不同渲染器。不能写成“仅 Canvas”或把旧版默认值当成当前能力上限。 | [官方 renderer 文档](https://g6.antv.antgroup.com/en/manual/further-reading/renderer)、[G6 5.x 特性](https://g6.antv.antgroup.com/en/manual/whats-new/feature)。 |

## 可用于主文的工程取舍（均为推断，非性能实测）

| 形态 | 适合本需求的理由 | 应验证的代价 |
|---|---|---|
| SVG | 矢量缩放、路径/边框/关系线和 SVG 导出贴近脑图需求，元素级事件与样式便于定制。 | 元素多时会增加 DOM 与样式更新成本；复杂富文本通常混入 HTML；字体、图片、foreignObject 的跨宿主导出兼容性要验证。不能直接断言 SVG 在所有节点规模比 Canvas 慢。 |
| HTML/DOM + CSS + SVG 线条 | 节点内容、表单编辑、CSS 主题和浏览器文本排版比较自然，便于做现代属性面板与复杂内容。 | 文字尺寸变化会影响节点测量与布局；大批节点带来 DOM 维护成本；图片导出需要克隆 DOM/内联样式等转换路径，实际视觉一致性必须检查。 |
| Canvas / WebGL | 可减少逐图元 DOM 节点，对大规模图可视化具备优化空间；G6 允许按渲染器/图层选择。 | 输入法/富文本编辑常需额外 DOM 层；命中测试、选择、可访问性、SVG 导出等依赖引擎提供或自行实现。不能把 GPU 渲染视为自动解决布局计算、文本测量或文件转换。 |

据此可以推荐“先用具有脑图编辑语义的 SVG 或 DOM 核心做 MVP 验证”，但不能仅凭渲染类型判定某引擎最终体验或速度；文件保真、快捷编辑、布局稳定性、中文输入、宿主生命周期和维护成本更直接决定本需求的成败。

## 关于商业 Xmind 的表述边界

**待验证**：本轮没有取得当前商业 Xmind 编辑/布局/渲染内核的官方源码或架构披露。第二次针对官方 GitHub/条款的浏览超时，不作为“已证实闭源”的依据。主文不宜用没有来源的“Xmind 使用 React/SVG/Canvas/某某布局算法”说明选型。

**建议措辞**：“当前方案不以商业 Xmind 的内部实现为依据；本次未获得其现行编辑内核的公开官方技术资料，无法核实它采用的框架或渲染器。对 Xmind 的参照限于可观察的交互、视觉与文件交换需求。”

“没有取得公开资料”与“已证明从未公开”不同。历史开源版、文件格式 SDK、文件读取/生成工具，即便存在，也不能直接证明现行商业产品编辑内核的内部框架。若主文必须称其内核未公开，应单列为有待来源支持的说法，而不是本研究已核实事实。
