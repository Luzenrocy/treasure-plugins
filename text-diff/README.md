# 文本对比插件

独立 Treasure 插件：提供双栏可编辑文本、精确行级差异、导航、交换、自动换行、隐藏未变化和忽略行尾空白。处理在本地页面完成，不读取剪贴板、不上传正文、不持久化文件引用。

## 边界

- 两侧均可直接粘贴或编辑，差异结果带有文字摘要，不依赖颜色表达。
- 文件载入仅接受用户通过公开 SDK 选择的 UTF-8 文件；元数据仅为文件名、成功解码后行数及可选安全相对显示路径，绝对路径会丢弃。
- SDK 不提供可用的文件大小检查接口，因此不实现 32MiB 预检或大小拦截。
- 当前差异算法为同步精确 LCS，结果携带 generation 与左右文档版本，陈旧结果不会覆盖新编辑。

## 开发与构建

```bash
npm install
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run build:plugin
npm run build:plugin:zip
```

本地测试环境若无法解析 `localhost`，可使用 `NODE_OPTIONS="--require=$PWD/test/dns-fix.cjs" npm test -- --pool=threads --no-file-parallelism`。macOS Apple Silicon 与 Windows x64 的 3 次采样、WebView/Treasure 版本和资源恢复证据需在各自宿主补录。

静态边界扫描（`src/`）未发现 Tauri、宿主源码、手写 bridge、CDN Worker、绝对路径或浏览器持久化调用。最近一次打包产物为 `build-output/text-diff/` 与 `build-output/text-diff.zip`；插件身份已冻结为 `text-diff-vc0eva`。

## 视觉角色与状态矩阵

- 画布/面板：`--diff-canvas` / `--diff-panel`；边框：`--diff-border`；正文与弱文本：`--diff-text` / `--diff-muted`。
- 身份与主操作：`--diff-purple-dark` / `--diff-purple`；禁用控件：`--diff-disabled`；本地处理状态：`--diff-local`。
- 差异语义色：新增 `--diff-added-bg`、删除 `--diff-removed-bg`、内容不同 `--diff-changed-bg`，并始终配合“仅左侧/仅右侧/内容不同”文字标签。
- 双空态、单侧输入态、一致态和差异态共享双栏编辑器；处理中、错误和复制失败只更新状态区，不增加独立结果卡片或场景选择器。

固定视口证据建议使用 1440×900 与窄视口 820×900，分别记录双空、单侧、差异、错误/恢复和切换选项后的状态。
