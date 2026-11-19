# 本地证据：2026-11-04

范围：只读源码检查，没有运行产品、没有 PoC、没有测试或性能结果。源码可能包含用户未提交变更；本轮不修改这些文件。

## L-01 README.md
- 路径：[README.md](/Volumes/MacExtend/FrontProjects/treasure-plugins/README.md)
- SHA-256：`d2979fa422fa500d518946bf440d69e52c6e1540ce281eb9f4bc8991207a3e3b`

## L-02 docs/PLUGIN-DEVELOPMENT-GUIDE.md
- 路径：[docs/PLUGIN-DEVELOPMENT-GUIDE.md](/Volumes/MacExtend/FrontProjects/treasure-plugins/docs/PLUGIN-DEVELOPMENT-GUIDE.md)
- SHA-256：`57da020b9af3457fd568e5fd3f7f2f582d3a8aea3b08aa1599ba8062de4a5692`

## L-03 docs/TREASURE-HOST-DESIGN.md
- 路径：[docs/TREASURE-HOST-DESIGN.md](/Volumes/MacExtend/FrontProjects/treasure-plugins/docs/TREASURE-HOST-DESIGN.md)
- SHA-256：`d903e5e31ae8ba051634d0e7cb8d84a3f82ff438e91b5a86a8737aa8fee1a389`

## L-04 excalidraw/README.md
- 路径：[excalidraw/README.md](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/README.md)
- SHA-256：`c05aba0d12d804757b30d8a162e8569cfdd46c4b4539888d9dce97245ffa6d79`

## L-05 excalidraw/package.json
- 路径：[excalidraw/package.json](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/package.json)
- SHA-256：`c554579f5ac4326859242d636c288f9c8a36b80cde5f7927b316465297fef06c`

## L-06 excalidraw/node_modules/treasure-sdk/package.json
- 路径：[excalidraw/node_modules/treasure-sdk/package.json](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/node_modules/treasure-sdk/package.json)
- SHA-256：`28264268d1117fdeb7f5050fe19f03dfb99472d68dcb39a9b61e8da329cb70fc`

## L-07 excalidraw/node_modules/treasure-sdk/dist/index.d.ts
- 路径：[excalidraw/node_modules/treasure-sdk/dist/index.d.ts](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/node_modules/treasure-sdk/dist/index.d.ts)
- SHA-256：`5426d4c327a9bb07d118b58e5a0fdc311d64118072f363e832cafc1ec05ac035`

## L-08 excalidraw/src/services/directory-service.ts
- 路径：[excalidraw/src/services/directory-service.ts](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/src/services/directory-service.ts)
- SHA-256：`2ceb2387b1665fedd02d4a2702eb5c213b4ec211c513f9a2247d717ee159bf96`

## L-09 excalidraw/src/services/drawing-file-service.ts
- 路径：[excalidraw/src/services/drawing-file-service.ts](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/src/services/drawing-file-service.ts)
- SHA-256：`9e2d37298e611f83fcac71bff71dd19d78bde8493b8fc4a92fc6314a21187709`

## L-10 excalidraw/src/services/mind-map-import-service.ts
- 路径：[excalidraw/src/services/mind-map-import-service.ts](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/src/services/mind-map-import-service.ts)
- SHA-256：`b20b71cccc4939c1c941506baf06fdbc784b956d98a27e1b54a62f57273bdf5d`

## L-11 excalidraw/src/domain/mind-map.ts
- 路径：[excalidraw/src/domain/mind-map.ts](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/src/domain/mind-map.ts)
- SHA-256：`23b374ba1e5ca5911703e2fbc8fb7c83af284d489a40757ad17d45b4574114a6`

## L-12 excalidraw/src/App.vue
- 路径：[excalidraw/src/App.vue](/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/src/App.vue)
- SHA-256：`bf1378c5740e674038750e3e83872ffb42e040429e45651aa8c737bb02113a67`

## 经检查的事实与限制

- L-01/02：每个插件 Vue+Vite，宿主 Treasure/Tauri，但业务只通过 treasure-sdk；不能直接调用 Tauri/fs。
- L-03：宿主基底 #F5EFE4，交互紫 #7656A7，金 #E8C98A；插件要维护独立色彩角色。滚动条按 L-02 的统一规则。
- L-05/06/07：现有 Excalidraw 依赖 SDK 范围 ^2.1.1，本机安装 2.1.1。不是新插件已选择或验证版本。
- L-07：files 有 openDialog/saveDialog/readFile/writeFile，directories 有 list/create/remove，permissions/settings 有目录授权恢复，storage 有 read/write/remove。DirectoryEntry 只有 name/kind/file/directory，没有大小或修改时间；不能原生按真实 mtime 排序。
- L-07：没有公开 rename/move/watch/stat/atomicReplace/compare-and-swap 或文件锁接口；不能承诺原子保存/持续监听/原位改名。摘要比对后写入有竞态，不是严格锁。
- L-02：单次文件与 storage 读写上限32MiB，不能通过Base64绕过；directories.remove 移到系统回收站；SDK Result错误需要显式处理。数据库单载荷256KiB、事务50条、查询1000行。
- L-08：DirectoryService 支持选择、settings.set、grantDirectory、verifyDirectoryGrant、list 并筛 .excalidraw，按文件名排序；remove({directory,name})。可借鉴职责与流程但不要不加修改复制。
- L-09：读取后解析再返回，失败不更改画布；序列化和文件写入分层；有哈希函数，但 App 中 originalHash 并不意味着已实现完整冲突保护。
- L-10：已有简化 .xmind/.smm 导入：ZIP优先content.json，否则content.xml；只取第一sheet，只保留标题/树，1000节点、标题500；HTML和空白会转成纯文本；不是全保真兼容。
- L-11：既有 Excalidraw 导图 domain 支持树基本操作、单一向右布局、metadata恢复；不能据此推断原生Xmind级布局/图形/导出完整。
- L-12：已有侧栏/导图面板/保存删除界面，但 closeDrawing 直接reset、openDrawing异步加载后更新等路径应重新设计会话保护；只视作参考实现。
- L-02 第9节：宿主菜单缺少公开类型化点击订阅，内部 treasure-menu-event 不作为第三方稳定API。首版用插件内菜单与快捷键；后续如 SDK 补齐再接。

## 方案约束建议（非已实现能力）

- 可列目录内 .smm/.xmind，点击加载；单会话首版，多sheet独立于多文件tabs。
- 默认 .smm 完整配置为用户文档；遇不支持的多sheet/附件等用插件私有恢复快照保留内部状态，不捏造跨应用扩展字段兼容。原始文件保持不变，必要时标注保真范围并另存副本。
- 把 Reset View、Relayout、Clear Content 分开：恢复视野不改数据，重新布局可撤销，清空危险操作可撤销；不要用一个“重置”按钮混合。
- 显式保存+私有草稿恢复先落地；自动写外部文件要等冲突/可靠写入能力验证。
