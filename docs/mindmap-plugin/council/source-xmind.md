# Xmind 官方能力、格式与 UI 研究证据

访问日：2026-11-04。仅使用 Xmind、MindNode、Wondershare 官方网站，以及 xmindltd 官方 GitHub 仓库。本文是证据素材，不是最终技术方案。标记：**事实**=来源直接支持；**推断/建议**=由事实导出的实现判断；**待验证**=本轮没有充分一手资料或实际样本验证。

## 1. 可直接使用的结论

- **事实**：当前 Xmind 官方指南有结构、主题、关系线、边界、概要、大纲、多 Sheet、浮动主题、备注、标签、标记、图片、超链接等能力。不能把“像 Xmind”缩减为只有一棵可编辑的树。[Xmind 用户指南](https://xmind.com/user-guide)
- **事实**：`xmind-sdk-js` 是构建文件的 SDK，支持浏览器与 Node.js；官方 v2.2.0 发布记录明确移除了加载已有 `.xmind` 文件能力。**推断**：它不能直接承担现有文件的通用导入编辑和无损回写，也不是画布编辑器。[仓库](https://github.com/xmindltd/xmind-sdk-js)、[发布记录](https://github.com/xmindltd/xmind-sdk-js/releases)
- **事实**：`xmind-viewer` 2022-04-18 归档，README 明确警告 “DEPRECATED - Never ever use it in a production environment!”。**推断**：只能作为历史格式研究材料，不应成为生产渲染主方案。[官方 viewer](https://github.com/xmindltd/xmind-viewer)
- **事实**：`xmind-embed-viewer` 提供 `.xmind` 只读展示、缩放、适应视图、Sheet 切换和事件；源代码创建 `https://www.xmind.app/embed-viewer` 或 `https://www.xmind.cn/embed-viewer` iframe。**推断**：MIT 的公开包装库不等于可离线自托管的完整 Xmind 渲染器，也不等于编辑授权。[README](https://github.com/xmindltd/xmind-embed-viewer)、[index.ts](https://github.com/xmindltd/xmind-embed-viewer/blob/main/src/index.ts)
- **待验证**：本轮没有找到一份覆盖当前 Xmind 27 全部字段及行为、版本化且公开承诺兼容的完整 `.xmind` 格式规范。因此不能承诺“全版本、全部高级元素、所有样式 100% 无损兼容”。

## 2. 当前 Xmind 功能与界面证据

| 领域 | 官方事实 | 对本项目的推断/建议 | 来源 |
|---|---|---|---|
| 节点/结构 | 主题包括中心、主、子、自由及概要主题；支持 Mind Map、Logic Chart、Brace Map、Tree Chart、Org Chart、Timeline、Fishbone、Matrix、Tree Table；桌面版支持同图混合结构；右侧 Format Panel 可改结构方向、形状、文字等 | 基础节点树之外，模型要预留自由主题、概要主题、每个分支布局；不要声称全部首期实现 | [Topic](https://xmind.com/user-guide/topic-editing-new) |
| 关系线 | 可连接主题等对象，支持文字、线型/颜色/粗细、两端箭头；有端点与控制点，手动端点定位后不再自动移动；可 Delete 删除 | 关系线与树边应是不同模型；端点/控制点不宜丢失 | [Relationship](https://xmind.com/user-guide/relationship-new) |
| 边界 | 包围选中主题，可带文字并改形状、填充、边线与文字；可拖边界上下范围；跨分支选择会各自生成边界；中心主题和多个自由主题不能按普通边界操作 | 边界不是任意自由矩形；采用同父节点的连续范围模型更接近实际语义，具体序列化待样本验证 | [Boundary](https://xmind.com/user-guide/boundary-new) |
| 概要 | 为选中主题生成概要主题，概要主题可有自己的子主题；能改范围和样式；跨分支分别生成概要；中心主题和多个自由主题有约束 | 不应降为普通文本注释；需要“范围 + 概要主题”结构 | [Summary](https://xmind.com/user-guide/summary-new) |
| 多 Sheet | 一个 `.xmind` 可含多个 Sheet，一起保存；左下当前 Sheet 名旁有 +；可重命名、复制、删除、重复、从主题建 Sheet；可将一个 Sheet 另存 `.xmind` | 文件、Sheet、画布视口是三个不同层次；目录点击打开文件不应只读取首 Sheet | [Sheet](https://xmind.com/user-guide/sheet-new) |
| 样式 | Format 面板按选中对象编辑；主题、关系、边界、概要、Callout 都可单独改样式；Topic 支持富文本样式 | 右侧上下文属性面板有明确产品先例 | [Style](https://xmind.com/user-guide/style-new) |
| 全局布局 | Sheet 可改 skeleton、配色、背景、全局字体、分支线宽；高级布局有平衡、紧凑、主题对齐、自由定位、允许重叠、CJK 字体等 | 中文混排与节点测量应作为兼容验收项；区分模板/主题与逐节点覆写 | [Sheet](https://xmind.com/user-guide/sheet-new) |
| 大纲 | Web 和桌面右下入口；桌面也可 View > Outliner；当前指南注明桌面 Outliner 仅支持本地文件；Enter 新主题、Tab 缩进、Shift+Tab 反缩进；支持拖动改层级 | 大纲应和画布共享数据，不能各存一份；本项目可采用左侧大纲/目录 Tab，但这是设计建议 | [Outliner](https://xmind.com/user-guide/outliner-new) |
| 打开/导入 | File > Open、Open Recent、双击 `.xmind`；导入 EdrawMind、MindManager、FreeMind、MindNode、DOCX、Markdown、OPML、TextBundle 等 | “打开原生文件”和“有损格式导入”应分别定义 | [Import](https://xmind.com/user-guide/import-new) |
| 导出 | PNG/JPEG、SVG、PDF、Excel、Word、OPML、TextBundle、PowerPoint、Markdown 等；PNG/JPEG 可倍数、分主分支、透明背景；PDF 可选导图/大纲/Pitch 和当前图/当前文件；SVG 提醒字体安装要求 | 本项目可先承诺经验证的格式及范围；多 Sheet 导出应明确当前图/全部图 | [Export](https://xmind.com/user-guide/export-new) |
| 快捷操作 | 当前桌面 Settings > Shortcuts 可搜索、修改和重置快捷键；浮动工具条随选中主题出现，包含关系线、链接、图片、备注、To-Do、样式等；选中文字有文字格式工具条 | 键盘操作 + 上下文按钮可互补；不能照搬 2021 年快捷表称为当前默认键 | [Shortcuts](https://xmind.com/user-guide/preferences-shortcuts-new)、[Floating Toolbar](https://xmind.com/user-guide/floating-toolbar) |
| 自由主题 | 双击画布空白创建；Space/双击编辑；Tab 加子主题；可拖动，支持自由定位选项和与普通主题转换；可用关系线连接 | 画布非纯树，未来需独立主题森林 | [Floating Topic](https://xmind.com/user-guide/floating-topic) |

**版本证据与注意**：官方 Changelog 当前显示 2026-10-28 的 Xmind 27.01.05086；2026-08-10 的 26.05.01106 增加 Floating Toolbar、Add Topic 按钮，并重新设计编辑器与设置。旧截图、旧教程的入口与快捷键可能已变。[Changelog](https://xmind.com/changelog)

**套餐注意（事实）**：功能存在不代表免费版可用；官方价格页把无水印及多种导出、自定义主题等列在付费层，并列有在线图数量和多 Sheet 权益区别。本文不将其作为本项目商业策略依据。[Pricing](https://xmind.com/pricing)

## 3. `.xmind` 格式与官方开发库

| 来源/对象 | 已证事实 | 限制与待验证 |
|---|---|---|
| 官方 Swift SDK | README 直接说明 `.xmind` 是 ZIP，含 manifest、metadata、sheets、resources；metadata 有版本和创建者；resources 放图片等资源；支持创建、打开、修改、保存，并有 password/loadContent 示例 | 这是 Swift 文件 SDK，不是浏览器 UI 引擎；不能把 Swift API 能力归给 JS SDK；当前新格式覆盖率和最近维护状态需另验。[仓库](https://github.com/xmindltd/xmind-sdk-swift) |
| 旧 XML 族 | 官方 Python SDK 定义 `content.xml`、`styles.xml`、`meta.xml`、`META-INF/manifest.xml`、附件目录与 XML namespace/version 2.0 | 文件年代与具体产品版本的精确映射应以样本验证，不能只靠扩展名判断。[const.py](https://github.com/xmindltd/xmind-sdk-python/blob/master/xmind/core/const.py) |
| JSON 族 | 官方 JS dumper 生成 `content.json`、`metadata.json`、`manifest.json`；`content.json` 来自 workbook，manifest 维护文件条目；同时写 `content.xml` 兼容提示壳，提示旧版打开可能丢失数据 | `content.xml` 的存在并不能证明文件是旧 XML 格式；探测应优先判断有效 `content.json`，兼容壳不能当真实地图。[dumper.ts](https://github.com/xmindltd/xmind-sdk-js/blob/master/src/utils/dumper.ts) |
| 历史 viewer loader | 官方 loader 先查 `content.json`，没有才查 `content.xml`；JSON 作为 sheets 解析；XML 会读 manifest/styles | 代码已废弃，不能视作当前完整标准或质量保证。[xmindLoader.ts](https://github.com/xmindltd/xmind-viewer/blob/master/src/xmindLoader.ts) |
| xmind-sdk-js | README：JS/TS、浏览器及 Node.js、构建文件；包源码显示版本 2.2.33、MIT；v2.2.0 发布记录删除加载已有 `.xmind` 功能 | 导出生成器候选，非现成导入器/编辑器。公开文档和 issue 仍有外框/样式等疑问，不能承诺高级元素覆盖。[仓库](https://github.com/xmindltd/xmind-sdk-js)、[package.json](https://github.com/xmindltd/xmind-sdk-js/blob/master/package.json)、[releases](https://github.com/xmindltd/xmind-sdk-js/releases) |
| xmind-model | 官方源码含 `children`、`boundaries`、`summaries`、`markers`、`labels`、`notes`、`image`、`href`、`numbering`、折叠 `branch`、`position`、`structureClass`、`extensions` 等数据键 | 有字段定义不等于已有布局渲染或新版本兼容保证。[topic.ts](https://github.com/xmindltd/xmind-model/blob/master/src/models/topic.ts) |
| xmind-embed-viewer | MIT；公开方法包括 ArrayBuffer load、50–500 缩放、Fit Map、sheets/currentSheetId/switchSheet；事件 map-ready/zoom-change/sheet-switch/sheets-load | 公开 API 未提供节点修改、保存原文件或导出地图 API；源代码依赖远程 iframe，并经 MessageChannel 传递事件/数据，不能表述为纯离线本地渲染。[README](https://github.com/xmindltd/xmind-embed-viewer)、[index.ts](https://github.com/xmindltd/xmind-embed-viewer/blob/main/src/index.ts)、[channel-controller.ts](https://github.com/xmindltd/xmind-embed-viewer/blob/main/src/channel-controller.ts) |
| xmind-viewer | 官方项目、MIT、将 `.xmind` 解析后 SVG 渲染；2022-04-18 归档且禁止生产使用的明确警告 | README 旧称支持所有版本，不可把它延伸到 2026 当前格式。[仓库](https://github.com/xmindltd/xmind-viewer) |
| 新官方 CLI（发现线索） | 官方 `xmindltd/xmind-cli` 的技能文件描述本地 `.xmind` 生成、校验和编辑；其文档称文件命令需登录，部分生成涉及 credits/recipe fallback | 本轮未执行或深入 API/许可证核验；不应直接建议集成到离线插件运行路径，更不能当作自由可分发浏览器引擎。[官方技能源码](https://github.com/xmindltd/xmind-cli/blob/main/skills/xmind-file/SKILL.md) |

**许可事实与推断**：仓库标示 MIT 仅可证明对应仓库开源代码采用 MIT；应保留版权和许可文本。不能从某包装库的 MIT 推导 Xmind 商业应用、品牌/图标/主题素材、远程服务、未公开渲染端也被授权为 MIT。后半句是许可范围判断，非法律意见；实施时应逐依赖核对随包 LICENSE 和服务条款。

**建议的格式验证证据（推断）**：以 Xmind 8、Zen/2020、当前桌面版生成的真实文件建立样本集，涵盖多 Sheet、混合布局、自由主题、关系/概要/边界、富文本、图片附件、备注、主题、折叠和密码；验证打开→保存→Xmind 重开及非改动字段保留。导入、显示、编辑、导出、无损回写应分别标兼容级别。

## 4. 竞品设计参照：事实与可借鉴建议分开

### Xmind

- **事实**：当前官方指南截图/说明呈现大画布、顶部插入工具、右侧 Format Panel、左下 Sheet 管理、右下大纲和缩放；选中主题附近可出现浮动工具条。依据为上表对应指南，最新编辑器在 2026-08 曾改版。
- **建议**：插件可采用“左文件目录—中画布—右属性”，顶部放文件级动作，底部放 Sheet/视图；左文件目录是本用户目标导出的新增设计，并非本轮已验证的 Xmind 固定三栏界面。
- **待验证**：未实际启动当前桌面 Xmind，未完成视觉像素/交互复现验证；不主张复制其图标、logo 或主题资源。

### MindNode（官方已验证）

- **事实**：当前 Outlining 指南通过工具栏左上 View 图标切换 Mind Map/Outline，两视图同步；大纲左有缩进指示，中间标题，右侧任务/附加内容图标；布局 Sidebar 控制附加内容展示；大纲保留粗斜体但简化字号、颜色和对齐。[Outlining](https://www.mindnode.com/support/guides/outlining)
- **事实**：Themes 在 Mac/iPad Sidebar 中选择；支持随系统深浅色切换的动态主题和个人主题；可从当前文档样式提取个人主题。[Themes](https://www.mindnode.com/support/guides/themes)
- **事实**：布局支持水平/垂直/紧凑/径向及窄/默认/宽间距；拖节点时用阴影预告吸附位置，超出阈值显示偏移指示，并保持自动布局；Organize 下有平衡、移动方向、Reset Position。[Canvas Styling](https://www.mindnode.com/support/guides/mind-map-and-canvas-styling)
- **建议**：借鉴同步大纲、上下文属性和拖放预览；本用户的“重置画布”应区分视口归中适应与节点位置重置，文案明确，前者无需修改文件。
- **待验证**：没有实际运行 MindNode 当前客户端；不要把 Classic 旧版左右并排大纲能力直接套用到所有当前平台。本轮官方网页有 2026 新版本，设计需标平台和版本。

### EdrawMind（官方已验证但较有限）

- **事实**：官方平板指南支持导图/大纲/演示模式，导图与大纲修改同步；原生 `.Emmx`；导入 XMind/MindManager/FreeMind/Markdown/HTML，导出 PNG/JPG/HTML/PPT/PDF/Word/SVG。[Tablet Guide](https://edrawmind.wondershare.com/tablet-guide/)
- **事实**：官方 V12 用户指南 PDF 中界面为顶部 ribbon/mode tabs（MindMap/Outline/Kanban/Slides），右侧设置面板，含主题、分支色、主题字体、间距等；大纲也有背景/宽度面板。[V12 官方 PDF](https://edrawmind.wondershare.com/guide/EdrawMind_V12_User_Guide.pdf)
- **建议**：借鉴把整体主题与当前对象属性区分，导出集中入口。
- **待验证**：本轮只取得 PDF 的工具文本/图像描述，未对最新桌面实际截图做视觉检查；V12 不是当前所有平台的事实基线，不应称其为最新桌面界面。文件目录树这一特定设计也未在竞品中查实。

## 5. 对父任务的边界提示

- `.smm` 的具体格式、simple-mind-map 能力与许可证由其他调研核验，本文不推断 `.smm` 是统一行业标准。
- 本项目用户要求的“打开/关闭/重置画布/删除/导出、目录点击打开”是产品输入，不应由竞品功能反向改变。建议分别命名“删除节点”“移除最近记录”“删除磁盘文件”，不能用同一 Delete 按钮隐含多个动作；这是交互建议，不是 Xmind 事实。
- 本轮有两次批量 web open/find 长时间无响应，已终止；本文可引用的内容均来自此前成功返回的官方搜索/页面结果。没有以超时页面支撑新增事实。
