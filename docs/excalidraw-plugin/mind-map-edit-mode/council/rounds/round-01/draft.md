# 思维导图编辑模式技术方案

**状态**：提案（未实现）  
**版本**：0.1  
**读者**：Treasure 插件研发、技术评审人员  
**适用范围**：`excalidraw` 子项目中由 `.xmind`、`.smm` 或 JSON 导入产生的思维导图。

## 1. 结论

采用“**脑图文档模型为唯一真相 + 受控元素投影 + 命令式编辑 + 全量重排事务**”的编辑模式。

新增分支、删除分支、改名和调整分支顺序不直接在画布上拼装矩形、文字和箭头。它们先更新内存中的脑图模型，再由布局器计算每个节点的最终布局框，最后由渲染器一次性替换该脑图拥有的画布元素。这样节点图形、真实多行文本框和曲线箭头都来自同一份布局结果；新增分支后位置与箭头必然一起校正。

首版不把通用画布中的自由拖拽解释为“新增/移动脑图分支”。受控脑图节点应通过插件提供的编辑命令操作；用户自由绘制的元素仍归 Excalidraw 管理。该边界避免从几何猜测层级关系，也避免 `onChange` 触发重排循环。

## 2. 目标与边界

### 2.1 目标

1. 导入成功后将该图标记为可编辑脑图；用户可选中节点并执行“新增子主题、新增同级主题、重命名、删除子树、上移、下移、重新整理”。
2. 每个命令提交后，受影响脑图的矩形、文本、曲线箭头和画布视口按新布局同步更新。
3. 多行文本的最终中心与矩形中心一致；不能以估算行高单独定位文本。[U-004]
4. 脑图与用户自由绘制的元素可在同一 scene 中共存，重排不得删除或改写自由元素。
5. 脑图结构随 `.excalidraw` 保存、打开、撤销和重做恢复。

### 2.2 非目标

- 本提案不实现协同编辑、任意方向脑图、手势拖拽自动推断层级，或基于第三方素材库的节点样式。
- 不修改 Treasure 宿主，也不依赖 Excalidraw 私有 DOM、内部 Store 或未在本项目锁定类型中确认的 API。
- 不把已有普通矩形、文本、箭头自动识别为可编辑脑图；迁移必须由用户显式触发。

## 3. 现状与问题

当前 `MindMapImportService` 只解析层级；`renderMindMap()` 按该层级一次性生成矩形、独立文本和箭头，随后 `App.vue` 调用 `updateScene()` 写入画布（S-001、S-002）。元素之间没有稳定的脑图节点 ID、父子模型或编辑命令，因此在导入后新增分支时，没有可靠依据可决定应移动哪些节点和重绘哪些箭头。[U-005]

现有 `ExcalidrawCanvas` 已向插件传出 `onChange(elements, appState, files)`，并保存 imperative API（S-003）。锁定 SDK 类型声明包含 `updateScene` 的 `captureUpdate`、元素 `customData` 和 `onChange`（S-005）；这些是本方案可使用的边界。文件服务目前以 `serializeAsJSON` 保存、`loadFromBlob` 打开 `.excalidraw`（S-004）。

## 4. 方案比较与决策

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| A. 只绑定箭头到矩形 | 箭头随拖动吸附，但无法得出新增节点后的树布局，也不能保证文本、父子顺序与交叉最少。 | 不采用。 |
| B. 从 `onChange` 反推矩形/箭头几何 | 将用户新画的形状、移动和删除推断为树操作。 | 不采用；歧义大，且会把自由画布操作误识别为脑图。 |
| C. 独立脑图模型，受控投影到 Excalidraw | 命令更新树模型，布局器重算，渲染器替换受控元素。 | **采用**。 |
| D. 维护 Excalidraw fork | 可深度接入原生工具。 | 当前不采用；先使用 `onChange`、`updateScene`、元素 `customData` 与插件 UI。 |

**[Decision D-001]** 脑图模型是结构与几何的唯一真相；Excalidraw 元素是可再生投影。  
**[Decision D-002]** 首版节点是受控对象：拖拽、文本直接编辑和手工增删受控箭头不作为修改结构的入口；插件命令是唯一结构写入口。  
**[Decision D-003]** 脑图元素使用稳定 ID 和 `customData` 持久化身份；打开文件时从元素重建模型，不另建必须随文件搬运的 sidecar 文件。

## 5. 总体架构

```text
Vue App / MindMapController
  ├─ MindMapRepository        # 从 scene 扫描、校验和恢复脑图模型
  ├─ MindMapCommandService    # addChild / addSibling / rename / remove / reorder / relayout
  ├─ TreeLayoutEngine         # 由模型算出 NodeLayoutBox[]，不读取旧 x/y
  ├─ MindMapRenderer          # 由布局框生成 rectangle + text + curved arrow 元素
  ├─ MindMapReconciler        # 过滤旧受控元素，合并新投影和自由元素
  └─ Excalidraw adapter       # updateScene({ captureUpdate: IMMEDIATELY })、onChange
```

`MindMapController` 是唯一可调用 `updateScene` 更新受控元素的模块。导入器只产生 `MindMapDocument` 后交给 Controller，不再直接把一次性元素写入画布。通用保存、导出、文件目录和素材库仍沿用现有 `App.vue` 与 `DrawingFileService`。

## 6. 数据模型与元素映射

```ts
type MindMapDocument = {
  schema: 1;
  mindMapId: string;
  revision: string;             // 每个命令事务生成新的 UUID
  rootId: string;
  nodes: Record<string, MindMapNodeRecord>;
  layout: { direction: "right"; horizontalGap: number; verticalGap: number };
};

type MindMapNodeRecord = {
  id: string;
  parentId: string | null;
  childIds: string[];       // 顺序即同级顺序
  title: string;
  collapsed: boolean;       // schema 预留，首版固定 false
};

type MindMapElementData = {
  namespace: "treasure.mindmap";
  schema: 1;
  mindMapId: string;
  revision: string;
  document: { rootId: string; layout: { direction: "right"; horizontalGap: number; verticalGap: number } };
  kind: "node" | "label" | "edge";
  node?: MindMapNodeRecord;    // 仅 kind=node；是可恢复结构的权威副本
  nodeId?: string;              // kind=label
  edge?: { parentId: string; childId: string };
};
```

每个受控 rectangle、text、arrow 的 `customData.treasureMindMap` 保存 `MindMapElementData`。同一节点的三个元素有可预测的元素 ID（例如 `${mindMapId}:node:${nodeId}`、`:label:`、`:edge:${parentId}:${childId}`）。每个 rectangle 必须携带完整 `node` 记录；label/edge 必须携带相同的 `mindMapId`、`revision`、`document` 和关联 ID。一次重排生成的全部受控元素带同一个 revision，且受控元素应标记为 locked，防止把通用画布操作误判为结构命令。

Repository 恢复时只接受以下完整快照：同组元素的 schema/revision/document 完全一致；恰有一个根节点；所有 node ID 唯一；`parentId` 与 `childIds` 双向一致、无环；每个可见节点恰有一个 label，除根外每个节点恰有一条对应 edge。任何混合 revision、缺失或重复元素都不是“选择最新项”可以解决的问题，必须降级为普通图形并提示修复方式。

`customData` 是否经过当前 `serializeAsJSON` / `loadFromBlob` 原样往返，必须作为实施前的 P0 契约测试；类型存在不等于已经验证序列化语义。[Open question O-001]

## 7. 统一布局与渲染协议

### 7.1 两阶段文本度量

布局器不能使用固定的 `TEXT_LINE_HEIGHT` 作为文本框真相。每个节点执行：

1. 规范化标题空白，按产品规则换行；
2. 用与最终渲染相同的 font、fontSize、textAlign、verticalAlign 调用当前 `convertToExcalidrawElements` 生成临时文本元素；
3. 读取临时元素真实 `width`、`height`，计算 `NodeLayoutBox = { x, y, width, height, textWidth, textHeight }`；
4. 最终 text skeleton 的 `x/y` 均传入 `NodeLayoutBox.centerX/centerY`，且 `textAlign: 'center'`、`verticalAlign: 'middle'`；最终 rectangle 使用同一布局框。

因此文本中心和图形中心由同一 `NodeLayoutBox` 派生，禁止渲染后手工修正单个文本的 `x/y`。[U-004]

### 7.2 树布局

采用确定性的自左向右 tidy-tree 布局：叶节点按累积 y 排列；内部节点位于首末子节点视觉中心的中点；x 由层级和最大节点宽度、固定水平间距决定。布局后整体平移使最小坐标为安全边距。节点高度使用各自真实文本高度加上下内边距，而不是使用全树最大高度。

连接线只读取父、子 `NodeLayoutBox`：起点为父节点右边中点，终点为子节点左边中点。使用单调递增 x 的三次 Bézier 采样点生成普通 arrow，起点与终点切线水平。不要对多折点 arrow 再使用 proportional-roundness，以免出现回环。每次重排重新生成整张脑图的边，首版不依赖箭头绑定自动跟随。

### 7.3 受控元素替换

`MindMapReconciler` 从当前 scene 过滤 `customData.treasureMindMap.mindMapId === 当前脑图` 的元素，将新生成的 edges、nodes、labels 按“边在底、节点居中、文字在顶”的顺序插入，同时保留所有其他脑图和自由元素。替换是全图原子事务，不能逐条 `updateScene`。

## 8. 编辑交互与重排事务

插件提供轻量 Vue 脑图编辑抽屉：树状节点导航、当前节点标题与“新增子主题、同级主题、重命名、删除子树、上移、下移、重新整理”操作。首版从该树状导航选择受控节点；受控元素保持 locked，不要求通过 Excalidraw 画布的选择/拖拽直接编辑。浮层不注入 Excalidraw 内部 DOM。未来若需要画布点选，应在本地验证 locked 元素的选择语义后作为独立需求加入。

以“新增子主题”为例：

```text
选择节点 -> 点击新增子主题 -> 输入标题
  -> validateCommand(document, nodeId)
  -> model = addChild(model, nodeId, title)
  -> boxes = layout(model)                 # 忽略旧画布 x/y
  -> generated = render(model, boxes)
  -> nextScene = reconcile(scene, generated)
  -> api.updateScene({ elements: nextScene, captureUpdate: IMMEDIATELY })
  -> controller 以新的可恢复 metadata 更新内存状态
```

任何校验、测量、渲染或 `updateScene` 失败时，不提交内存模型；保留旧 scene 和输入内容并显示阶段化错误。命令层统一执行 `validateDocument()`：节点总数不超过当前导入器的 1,000 上限、标题规范化后非空且不超过 500 字符、目标/父节点存在、生成的 ID 未重复、删除目标不是根、调整顺序不越界，且更新后父子图无环。

首版不允许手工拖拽受控元素，因而不存在拖拽后的 `onChange` 回正事务和额外 history 项。若用户绕过 UI 解锁或修改受控元素，完整性检查失败时该组退出编辑模式而不自动覆写用户画布。若产品需要手工摆放，应在后续版本显式引入 `pinned` 坐标/子树 pin 算法，不能把临时拖动坐标默认为树结构。[Open question O-002]

## 9. `onChange`、撤销重做与循环防护

`onChange` 只做三件事：更新普通保存所需的 `elements/appState/files` 快照、刷新抽屉中自由元素的状态、校验受控元素完整性。它不从新增自由元素推导脑图结构，也不在回调中自动重排或调用 `updateScene`。

Controller 为每次重排设置 `pendingTransaction`（包含脑图 ID、revision 与期望的受控元素 ID 集）；对应的下一次 `onChange` 只确认提交并清除标记，避免回调重入。收到撤销或重做导致的完整但不同 revision 时，Repository 从 `customData` 重建模型并校验，而非沿用过期内存模型。若无法重建（缺 label、edge、revision 混杂或 metadata 版本不兼容），该脑图退出编辑模式但保留可见元素，并显示“结构元数据损坏，可保留为普通绘图或从源文件重新导入”。

每个用户命令只调用一次 `updateScene({ captureUpdate: IMMEDIATELY })`，从而作为一个撤销单元；加载文件、导入初始脑图和恢复内部状态使用不写入用户历史的初始化策略。具体 `CaptureUpdateAction` 常量导入路径须以当前锁定版本的本地类型/构建验证为准。[Open question O-003]

## 10. 保存、打开、兼容与迁移

保存仍调用现有 `DrawingFileService.serialize()`；不改变文件扩展名或 Treasure 的目录授权流程。打开时：

1. 先由现有 `loadFromBlob` 恢复 scene；
2. Repository 扫描未删除元素的 `customData.treasureMindMap`；
3. 以 `mindMapId` 分组并执行 schema、节点唯一性、根唯一性、无环、父子双向一致性和元素完整性校验；
4. 验证成功的组进入编辑模式；验证失败的组作为普通 Excalidraw 图形打开，并记录可诊断原因。

对当前已导入的无 metadata 脑图，不自动猜测结构。提供显式“转换为可编辑脑图”命令：用户选择一个根节点或确认一张刚导入的图，插件仅在能读到完整、无歧义的受控导入标记时写入 schema 1；否则提示重新导入。旧图永远可继续作为普通图形使用。

## 11. 验证与发布门槛

| 验收项 | 预期结果 | 验证方式 |
| --- | --- | --- |
| 新增子主题 | 新节点插入模型；全部同级节点、父节点与箭头在一次事务后重排 | 模型单测 + 画布集成测试 |
| 多行标题 | rectangle 中心、最终 text 元素边界中心一致（x/y 误差均不超过 0.5 px），文本不溢出 | 以 SDK 实际转换后的元素边界断言；样本含中文、英文、emoji、原始换行和 500 字符标题 |
| 曲线箭头 | 从父右中到子左中，x 单调、无回环、箭头在节点下层 | 渲染器单测 + 视觉回归 |
| 删除/重排 | 删除子树不残留 label/edge；同级顺序稳定；超节点上限、重复 ID、循环 parentId 和删除根均拒绝且 scene 不变 | 命令与 reconcile 单测 |
| 自由元素隔离 | 重排不改变不含该 `mindMapId` 的元素 | 集成测试 |
| 保存打开 | `customData`、模型和可编辑状态完整往返 | 序列化/反序列化契约测试 |
| 撤销重做 | 单次新增或删除对应一个历史项；撤销/重做后同 revision 元数据可恢复模型，受控元素保持 locked | 浏览器级集成测试 |
| 异常恢复 | metadata 缺损或更新失败不破坏当前画布 | 失败注入测试 |

发布前需用真实 `.xmind`、`.smm` 和长中文标题样本进行人工视觉验证；只有在保存打开与撤销重做都通过后，才能开放“编辑模式”入口。

## 12. 风险与未决问题

- **O-001（P0）**：确认当前锁定 Excalidraw 版本对元素 `customData` 的 JSON 往返保留；未通过则改用带 schema 的 companion 文件或在 `.excalidraw` 外层包装，二者都需要兼容评审。
- **O-002（P1）**：产品是否需要保留用户手工拖拽的节点位置。默认不支持；需要时另行设计 pin 约束，不能破坏确定性布局。
- **O-003（P1）**：用本地依赖版本验证 `captureUpdate` 常量的公开导入与撤销行为，再固化 adapter。
- **O-004（P1）**：同一 `.excalidraw` 是否允许多张可编辑脑图；本模型支持按 `mindMapId` 分组，但 UI 入口和选择冲突须在实施时测试。
- **O-005（P2）**：折叠节点、双向/左侧分支、主题样式和导出源文件回写不属于首版范围。

## 13. 实施顺序（建议）

1. 为当前依赖补齐 `customData` 往返、`updateScene` 历史和真实文本度量的契约测试；P0 未通过不开始编辑 UI。
2. 新建 `domain/mind-map.ts`、Repository、命令服务和无副作用布局/渲染器，并迁移导入路径到模型优先。
3. 实现 Reconciler 和 Controller，覆盖新增、重命名、删除、排序、撤销重做。
4. 增加选中节点浮层与无障碍键盘入口；最后才评估 pin/拖拽扩展。

## 14. 需求覆盖

本方案覆盖 U-001 至 U-005；逐项定位和证据见同迭代的 `coverage.yaml`。
