# JSON 格式化插件

独立 Treasure 插件：在本地编辑区校验、格式化、压缩、折叠、转义并复制 JSON。正文只存在于当前页面状态，不写入 localStorage、剪贴板读取接口或远程服务；文件载入仅接受用户通过公开 SDK 选择的 UTF-8 文件。

## 边界

- 支持对象、数组和标量根节点；严格拒绝注释、单引号、尾逗号、非法转义和多余 token。
- 文件元数据仅显示文件名、成功解码后派生的行数和可选的安全相对显示路径；绝对路径会丢弃，正文不会持久化。
- SDK 不提供可用的文件大小检查接口，因此不实现 32MiB 预检或大小拦截。
- 转义状态锁定格式化、压缩和折叠，但保留编辑与复制；取消转义时只安全移除一层。

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

本地测试环境若无法解析 `localhost`，可使用 `NODE_OPTIONS="--require=$PWD/test/dns-fix.cjs" npm test -- --pool=threads --no-file-parallelism`。最终 Treasure/macOS 与 Windows 性能证据需在目标宿主人工采样后补录；本地自动化不冒充跨平台实测。

静态边界扫描（`src/`）未发现 Tauri、宿主源码、手写 bridge、CDN Worker、绝对路径或浏览器持久化调用。最近一次打包产物为 `build-output/json-formatter/` 与 `build-output/json-formatter.zip`；插件身份已冻结为 `json--j9i283`。

## 视觉角色与状态矩阵

- 画布/面板：`--json-canvas` / `--json-panel`；边框：`--json-border`；正文与弱文本：`--json-ink` / `--json-muted`。
- 身份与主操作：`--json-purple-dark` / `--json-purple`；禁用控件：`--json-disabled`；本地处理状态：`--json-local`。
- JSON 语义色：键 `--json-key`、字符串 `--json-string`、数字 `--json-number`、字面量 `--json-literal`。
- 空态保留身份区、工具栏、单体编辑器和页脚；内容态只增加行号/折叠/语法层；错误、处理中和复制失败复用同一状态容器，不插入预览模块。

固定视口证据建议使用 1440×900 与窄视口 820×900，分别记录空态、有效内容态、错误态和操作后状态。
