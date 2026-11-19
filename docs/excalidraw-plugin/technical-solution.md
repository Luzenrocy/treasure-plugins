# Excalidraw Treasure 插件：素材库与绘图目录适配技术方案

**版本**：0.1（技术方案）  
**状态**：已审核发布  
**语言**：zh-CN  
**目标读者**：Treasure 插件研发、宿主集成和技术评审人员  
**范围**：只定义架构、接口、数据、交互和风险，不包含研发任务拆分或排期。

## 1. 执行摘要

本方案的核心结论是：`UIOptions` 不能注册任意自定义 DOM 元素，也没有 0.18.1 版本的内置素材库可见性开关；它适合隐藏原生 canvas action。顶部右侧的“素材库”应使用官方公开的 `renderTopRightUI` 扩展点渲染，抽屉和 Treasure SDK 逻辑由插件自身承载。原生素材库入口若必须消失，只能增加一个受版本锁定的 CSS 兼容层，或维护一个小型 Excalidraw fork 暴露正式开关；推荐先采用“公开扩展点 + 版本锁定 CSS + DOM 合同测试”，不直接向内部 `layer-ui__wrapper__top-right zen-mode-transition` 注入节点。

绘图目录采用 Treasure 的目录设置和授权模型。左上角菜单隐藏 Open、Save to active file 等不适配动作；绘图文件以固定高度、内部滚动的插件面板展示，点击文件后读取 `.excalidraw` 内容并通过 `excalidrawAPI.updateScene` 打开。保存和导出由插件自己的按钮调用官方序列化/导出能力，再写回已授权目录或使用 `saveDialog`，原生画布、选择、缩放、撤销重做和快捷键保持不变。

“插件默认 app 目录”在 Treasure SDK 中只能安全地表达为插件私有数据区，不是可拼接的操作系统绝对路径。本方案默认使用 `storage` 的 `libraries/` 相对键空间；如果产品必须让用户在文件管理器中看到素材包，则另增一个目录型系统设置和授权流程，不能把私有存储伪装成用户目录。

## 2. 可行性结论与关键决策

### 2.1 `UIOptions` 能力边界

基于本项目锁定的 `@excalidraw/excalidraw@0.18.1` 类型和官方文档：

| 需求 | `UIOptions` 是否直接支持 | 结论 |
|---|---:|---|
| 隐藏 Open/Load scene | 是，`canvasActions.loadScene: false` | 采用 |
| 隐藏 Save to active file | 是，`canvasActions.saveToActiveFile: false` | 采用 |
| 隐藏 Export/Save as image | 是，`canvasActions.export: false`、`saveAsImage: false` | 仅隐藏不适配入口，导出由插件重建 |
| 隐藏或配置 Excalidraw links | 无单独稳定开关 | 先用公开动作配置；剩余链接只通过版本锁定 CSS 或 fork 处理 |
| 注册任意顶部按钮 | 否 | 使用 `renderTopRightUI` |
| 隐藏内置素材库入口 | 0.18.1 无稳定 `UIOptions` 字段 | CSS 兼容层或小型 fork；不把内部类名当公共 API |

**[Decision D-001]** 不修改 `UIOptions` 类型来承载任意元素。`renderTopRightUI` 是自定义按钮唯一优先方案；`UIOptions` 只负责官方提供的动作可见性和导出配置。

**[Decision D-002]** 默认不维护 Excalidraw fork。先在锁定版本上隔离 CSS 选择器，并为内置素材库入口建立 DOM 合同测试；若升级导致选择器失效，再评估 fork 或等待上游开关。

**[Open question O-001]** 当前 Treasure 宿主是否允许插件 CSS 穿透 Excalidraw 内部 shadow boundary（当前渲染未使用 shadow DOM 的假设需通过集成验证确认）。若不允许，必须采用 fork/上游补丁，而不是继续加选择器。

### 2.2 保持主页面

抽屉是画布之上的浮层，不跳转到新页面，不复用原先左侧常驻菜单。打开/关闭抽屉、选择文件、安装素材或保存完成后，焦点和工作区仍回到画布；只在系统文件/目录选择对话框期间暂时交给 Treasure 宿主。

## 3. 总体架构

```text
ExcalidrawCanvas
├─ Excalidraw（官方画布）
│  ├─ UIOptions.canvasActions：隐藏不适配动作
│  ├─ renderTopRightUI：渲染“素材库”按钮
│  └─ excalidrawAPI：updateScene / updateLibrary / getSceneElements
├─ NativeLibrarySuppressor（版本兼容 CSS/合同测试）
├─ DrawingDirectoryPanel（插件自有抽屉/菜单内容）
├─ LibraryDrawer（右侧抽屉）
└─ TreasureAdapter
   ├─ settings：library_url、workspace_dir
   ├─ permissions + directories：目录授权/列举
   ├─ files：读取绘图、保存/导出
   └─ storage：素材包、索引、缓存
```

模块只通过 `Result<T>` 处理 SDK 返回值；取消 (`CANCELLED`) 不提示错误，其他失败显示可诊断信息并保留重试入口。插件不调用 Tauri、宿主内部 operation 或绝对路径。

## 4. 顶部右侧“素材库”按钮与抽屉

### 4.1 挂载方式

`Excalidraw` 使用 `renderTopRightUI(isMobile, appState)` 返回一个与原生按钮同层级的可访问按钮：

- 文本/aria-label：`素材库`；图标只作辅助，不能替代文字语义。
- `aria-expanded` 反映抽屉开关；`aria-controls` 指向抽屉内容。
- 桌面端使用顶部右侧扩展槽；移动端在同一扩展槽中适配为图标按钮或保留文字，不能覆盖原生工具栏。
- 点击后只更新插件状态 `libraryDrawerOpen=true`，不改变 scene、不离开画布。

内部类 `layer-ui__wrapper__top-right zen-mode-transition` 只作为布局观察点，不直接作为插件挂载 API。通过外层 CSS 控制扩展按钮的间距、层级和窄屏折叠，避免改写 Excalidraw 布局树。精确对齐是桌面/移动两个断点的视觉合同，不能承诺与某个内部 DOM 节点永久一一对应；若出现重叠，升级门禁应阻止发布。

### 4.2 隐藏官方内置素材库入口

首选是对锁定版本的内置入口加作用域选择器，将 `sidebar-trigger__label-element` 所在原生 library trigger 设为 `display:none`，同时不隐藏自定义按钮。选择器必须带宿主容器作用域，避免误伤抽屉。每次升级 Excalidraw 需执行 DOM 合同测试：

1. 原生 library trigger 不可见；
2. `renderTopRightUI` 的“素材库”仍可见且可聚焦；
3. 其他官方按钮、快捷键和菜单不受影响。

若 CSS 无法穿透或内部结构变更，升级门禁应失败并转入 **[Decision D-003]**：维护一个最小 fork，新增 `UIOptions.canvasActions.library` 或上游等价开关；不得通过运行时 `querySelector` 删除节点作为长期方案。

## 5. 素材库数据与系统设置

### 5.1 设置契约

新增 Treasure 系统设置（普通字符串，不是目录项）：

| 字段 | 值 |
|---|---|
| manifest key | `library_url` |
| 显示名 | 素材库 |
| 类型 | `input`（字符串输入；Treasure manifest 不支持 `string`） |
| 默认值 | `https://libraries.excalidraw.com/libraries.json` |
| 生效时机 | 打开抽屉或显式刷新时读取；设置变更后清空远端缓存并重新加载 |

URL 只允许 `https`；如未来允许企业内网源，需由宿主设置允许域名策略，不能在插件中放宽到任意 `http`。设置值来自 `settings.get('library_url')`，缺失或校验失败时回退默认值并显示“素材库地址无效”。

### 5.2 远端适配器

`LibrarySource` 将网络响应转换成内部模型，不让 UI 依赖官方 JSON 的全部字段：

```ts
type LibrarySummary = {
  id: string;
  name: string;
  author?: string;
  thumbnailUrl?: string;
  version?: string;
  itemCount: number;
  installed: boolean;
  installedVersion?: string;
};
```

解析器必须校验根数组、稳定 `id`、可读名称和素材包引用；未知字段忽略，缺失关键字段的条目进入“不可安装”状态并记录原因。**[Assumption A-001]** 远端接口允许跨源请求且返回的素材包可由浏览器 `fetch` 获取；这不是 Treasure SDK 已提供的网络 API。只有在 Treasure 宿主 CSP/网络策略允许时才可直连；否则必须由宿主提供明确的域名允许列表或代理契约。未满足该前提时，抽屉进入“网络能力未配置”状态，不得静默回退到任意内部 action。

缓存策略：内存缓存用于当前抽屉，`storage` 可保存经过校验的目录快照和 `fetchedAt`；缓存不是安装状态的来源。请求超时/解析失败时显示“加载失败，重试”，若有最近快照则允许只读浏览并标注“缓存数据”。

运行时兼容：`libraries.excalidraw.com` 是首选目录地址；由于插件 iframe 直接读取该静态站点可能受到 CORS 限制，若首选请求失败，插件可切换到同一官方 `excalidraw-libraries` 仓库的 GitHub Raw 镜像读取目录和素材文件。该兜底不改变 manifest 中的 `library_url`，也不接受任意第三方来源。

## 6. 安装、卸载和 Excalidraw library 同步

### 6.1 私有存储模型

默认使用 Treasure 插件私有数据区（SDK `storage`），相对键建议：

```text
libraries/index.json                 # id -> version/status/checksum
libraries/packages/{id}/{version}.json
libraries/thumbnails/{id}.bin        # 可选，按大小限制缓存
```

单次读写不超过 SDK 32 MiB 限制；大包需拆分或在产品上拒绝。索引写入采用“先包后索引”：包完整写入并校验成功后，才把版本标记为 installed。

### 6.2 安装状态机

```text
未安装 -> 下载中 -> 校验中 -> 已安装
                     └─失败 -> 未安装（保留可清理临时键）
已安装 -> 卸载中 -> 未安装
                     └─失败 -> 已安装（索引不变）
```

- 未安装条目显示“安装”；已安装且版本匹配显示“卸载”；下载中禁用重复操作。
- 安装按 `id + version + checksum` 幂等；相同版本重复点击直接刷新本地状态，不重复写包。
- 卸载先从 Excalidraw 当前 library 中移除对应条目，再删除包和索引；若画布已有使用中的元素，不删除 scene 中已放置元素。
- 所有状态更新串行化，避免安装和卸载并发覆盖索引；失败保留错误码和重试按钮。

### 6.3 与官方 Library API 的关系

安装完成后将包中的 `LibraryItems` 转换为 Excalidraw 0.18.1 类型，通过 `excalidrawAPI.updateLibrary(...)` 合并到当前画布库；启动时从 `libraries/index.json` 恢复已安装包，再一次性更新。安装包写入按 `package:<id>` 命名空间归属；同一 `id` 的新版本只替换该包归属的条目，用户手工创建的 library item 保留。卸载只移除该包归属的条目和私有存储，不删除已放置到 scene 的元素。插件自己的索引是真实来源，`onLibraryChange` 只用于记录用户在画布中新增/删除的本地 library item，不能用它保存远端目录元数据。

**[Open question O-002]** 远端包是否完全符合当前 Excalidraw library schema、是否需要 `libraryItems` 版本迁移，必须在接入前以真实样本验证；解析失败不可把半成品写入当前 library。

## 7. 绘图目录与左上角菜单

### 7.1 目录授权

保留 manifest 中 `workspace_dir` 目录设置。首次使用或授权失效时：

1. `files.openDialog({ kind: 'directory' })` 让用户选择目录；
2. `settings.set({ key: 'workspace_dir', directory })` 更新系统设置；
3. `permissions.grantDirectory({ permissionKey: 'workspace_dir', directory })` 建立授权；
4. 启动时用 `settings.get` + `permissions.verifyDirectoryGrant` 恢复根目录引用；
5. 只用根目录引用调用 `directories.list`，不持久化子目录/文件引用。

目录尚未设置时，绘图文件列表显示空态“请选择绘图目录”，点击后在系统选择器中完成配置；不弹出自定义全屏页面。

### 7.2 原生菜单配置

初始化 Excalidraw 时使用：

```ts
UIOptions: {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    saveAsImage: false,
  },
}
```

`clearCanvas`、背景色、主题和官方工具按产品需要保留，不能为了替换文件流程而关闭整套原生能力。原生“打开/保存到/导出”入口隐藏后，插件提供等价文件操作；不删除画布的选择、绘制、缩放、撤销重做、快捷键和上下文菜单。

Excalidraw links 若当前版本没有 `UIOptions` 公开字段，不能把链接选择器当稳定 API。产品需先枚举要隐藏的可见菜单/链接入口；只在版本锁定 CSS 兼容层中隐藏这些明确目标，并把每个目标纳入 DOM 合同测试。未知内部链接不承诺隐藏，若产品必须隐藏则转入 fork 决策；链接的内部数据和画布功能不受影响。

### 7.3 固定高度文件列表

文件列表只展示已授权绘图目录下的 `.excalidraw` 文件：

- 面板使用固定设计令牌 `--drawing-list-height: 360px`，在宿主高度不足时仅允许受约束的 `min(360px, calc(100vh - 220px))` 小视口回退；列表本身 `overflow-y:auto`，页面根节点和画布不产生第二条滚动条。
- 每项显示文件名、修改时间（若 SDK 返回）和当前打开标记；按名称或修改时间排序应固定一种默认规则。
- 点击文件：`files.readFile(file)` → UTF-8/JSON 校验 → `loadScene`/`excalidrawAPI.updateScene`；解析失败保留当前 scene，不清空画布。
- “新建绘图”：在内存中清空 scene，首次保存时由 `files.writeFile({ directory, fileName, data })` 写入目录。
- “保存”：使用 `serializeAsJSON`（或当前锁定版本等价函数）生成 `.excalidraw` 字节，写入当前文件引用；引用失效时提示重新选择目录/文件。
- “另存为/导出”：使用 `files.saveDialog` 或先选目录再 `writeFile`；导出 PNG/SVG/PDF 等格式由官方导出 utility 生成字节，SDK 只负责受控写入。

滚动条必须复用插件研发指南的样式，不新增品牌色：

```css
.scrollable-region::-webkit-scrollbar { width: 6px; }
.scrollable-region::-webkit-scrollbar-track { background: transparent; }
.scrollable-region::-webkit-scrollbar-thumb {
  background: #d3d7da;
  border-radius: 3px;
}
```

抽屉内容可以独立滚动，但不得同时让 body、插件根节点和列表滚动。

## 8. 数据模型与边界

| 对象 | 来源 | 持久化 | 禁止事项 |
|---|---|---|---|
| 当前 scene | Excalidraw API | 绘图文件 | 不写入素材库索引 |
| 绘图目录根引用 | Treasure permissions | 宿主授权/设置 | 不保存绝对路径或子引用 |
| 绘图文件 | `directories.list` 返回的 FileReference | 不跨会话保存引用 | 不构造 path |
| 远端目录快照 | `fetch` + storage 可选缓存 | 可清理 | 不作为安装事实来源 |
| 已安装素材包 | storage 相对键 | 插件私有区 | 不暴露插件数据绝对路径 |
| `library_url` | Treasure settings | 系统设置 | 不信任任意非 HTTPS 源 |

## 9. 可靠性、安全和可访问性

- 所有 SDK 调用判断 `ok`；`CANCELLED` 静默结束，`PERMISSION_DENIED`/`GRANT_NOT_FOUND` 引导重新授权，`REFERENCE_EXPIRED` 重新列举，`FILE_TOO_LARGE` 提示素材包超限，`IO_ERROR`/`CONFLICT` 提供重试。
- 网络响应使用超时、大小上限、JSON schema 校验和 checksum（若源提供）；不执行远端 JavaScript，不把远端 HTML 当素材包。
- 安装/卸载是幂等事务；临时键带操作 ID，启动时清理未提交临时项。
- 抽屉和文件列表支持键盘焦点、Esc 关闭、焦点回收、`aria-label`、`aria-busy` 和禁用态；颜色对比不依赖素材缩略图。
- 画布错误边界仅显示可诊断信息，不吞掉原生画布错误；文件加载失败不得破坏当前有效 scene。
- 只隐藏入口不删除官方实现，以便升级回滚；CSS 兼容层必须与 Excalidraw 版本一起锁定。

## 10. 验证标准（设计级）

1. UIOptions 映射表与锁定版本类型一致；Open、Save to、Export 等指定入口不可见，原生绘制/撤销/缩放功能仍可用。
2. 顶部“素材库”按钮来自 `renderTopRightUI`，可聚焦，点击后画布不跳页，右侧抽屉标题为“素材库”。
3. 远端 URL 从 Treasure 系统设置读取，默认值正确；无效 URL、超时、非法 JSON 都有明确错误态和重试。
4. 安装、重复安装、卸载、重复卸载和中途失败均保持索引与包一致；已安装素材可在 Excalidraw library 中使用。
5. 未配置绘图目录时有选择目录空态；配置后列表只显示目录下 `.excalidraw` 文件，固定高度且只有列表/抽屉滚动。
6. 读取损坏文件、授权撤销、引用过期和保存冲突不会清空当前画布，错误位置包含具体阶段（列举、读取、解析、写入、安装或卸载）。
7. Excalidraw 版本升级时 DOM 合同测试能检测内置素材库入口和已枚举链接选择器失效，并在桌面/移动断点验证自定义按钮不重叠；失败时禁止静默发布。

## 11. 未决事项

- **[Open question O-001]** Treasure 插件 CSS 是否能稳定穿透当前 Excalidraw 容器；决定 CSS 兼容层和 fork 的取舍。
- **[Open question O-002]** 官方 libraries JSON 的素材包字段、校验字段和版本迁移规则需以真实样本确认。
- **[Open question O-003]** Treasure 宿主的网络 CSP/代理是否允许从设置 URL 直接 fetch；若不允许，需要宿主允许列表或代理契约。
- **[Open question O-004]** 产品是否真的需要用户可见的素材目录。若需要，应新增目录型设置和授权，不应把插件私有区当作用户目录。
- **[Open question O-005]** 当前项目锁定的 Excalidraw 版本是否支持目标导出格式；导出能力以本地类型和构建产物为准，不能直接照搬最新主分支名称。

## 12. 参考资料

- [Excalidraw UIOptions](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/props/ui-options.mdx)
- [Excalidraw Props](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/props/props.mdx)
- [Excalidraw Utils](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/utils/utils-intro.md)
- 本地 `@excalidraw/excalidraw@0.18.1` 类型：`excalidraw/node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
- [Treasure SDK API 参考](/Volumes/MacExtend/FrontProjects/treasure-sdk/docs/API-REFERENCE.md)
- [Treasure 插件研发指南](/Volumes/MacExtend/FrontProjects/treasure-plugins/docs/PLUGIN-DEVELOPMENT-GUIDE.md)

