# 用户原始请求（不可变）

记录时间：2026-10-29（Asia/Shanghai）

用户指定技能：`awesome-ai-tools:writing-workshop`

原文：

> 根据上述调研的结果 结合下列需求 出一份技术方案：
>
> 1. 将画布右上角素材库按钮(sidebar-trigger__label-element ) 这一前端元素删除或隐藏
> 2. 在素材库按钮所在元素（layer-ui__wrapper__top-right zen-mode-transition） 新增一个类似素材库的按钮，该按钮命名为素材库  功能为：点击按钮打开右侧抽屉，抽屉标题为素材库，素材库数据从素材库url获取 支持安装（未安装的）卸载（已安装的）功能  安装则安装到本地素材库目录 卸载则从本地素材库删除 本地素材库目录默认为 treasure app 插件默认的app目录下创建；
> 3. 新增系统参数 素材库 默认https\\://libraries.excalidraw\\.com/libraries.json 
> 4. 画布左上角的按钮 点击后的菜单中 隐藏或去掉 打开、保存到 这两个按钮; excalidraw links 或隐藏，改为限制绘图目录下的 文件列表  要求定高 支持滚动 滚动条按插件研发指南的样式操作;
>
> 先确定在`UIOptions` 增加自定义元素的可行性 如果不可行 则按`UIOptions` 左侧洗澡能样式相同的按钮的操作来处理 绘图目录下的文件列表的逻辑来处理

## 上下文修正与前置结论

以下是本轮请求依赖的前序用户意图和已完成调研结论，作为约束而非新增研发任务：

- 画布应保持主页面，不能因目录、素材库、设置等操作离开主页面；操作完成后返回画布。
- 原先自定义侧边菜单及其内嵌工作区设计被用户否定；最终设计不得重新引入左侧常驻业务侧栏。
- 应恢复 Excalidraw 官方原生画布能力，仅按需求隐藏/替换明确的入口。
- 官方 `UIOptions` 可隐藏 `loadScene`、`saveToActiveFile`、`export` 等菜单动作，但没有稳定的任意工具栏按钮注册或内置素材库可见性开关；`renderTopRightUI` 是公开的顶部右侧扩展点。
- Treasure SDK 通过 `files`、`directories`、`storage`、`settings`、`permissions` 等公开模块提供受控能力，插件不能使用绝对路径或宿主内部 action。
- 方案需解释“插件默认 app 目录”与用户可见目录的边界，并明确默认素材库存储策略。

