# Treasure 插件研发指南

> 本文定义插件从创建、开发、联调到发布的工程流程。SDK 方法签名请参阅 [SDK API 参考](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/API-REFERENCE.md)，底层通信契约请参阅[桥接协议](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/BRIDGE-PROTOCOL.md)。

## 1. 创建项目

插件模板将 `treasure-sdk` 写入生成项目的 `dependencies`。CLI 默认会在生成后执行 `npm install`，因此 SDK 会随项目依赖一并安装；不需要全局安装 CLI。

```bash
# npx 会按需下载并执行 treasure-sdk CLI
npx treasure-sdk create my-plugin --alias "我的插件"
cd my-plugin
npm run dev
```

如使用 `--no-install` 跳过自动安装，或自动安装失败，请在生成的插件目录中手动执行 `npm install`；该步骤会安装 `package.json` 中声明的 `treasure-sdk` 及其他依赖。CLI 会生成 Vue + Vite 项目、SDK 初始化、`manifest.json`、生命周期脚本和插件打包脚本。插件编码必须是小写 kebab-case，例如 `my-plugin`。

## 2. 插件工程约定

| 文件或目录 | 必须承担的职责 |
| --- | --- |
| `manifest.json` | 声明编码、名称、版本、入口、菜单、图标、设置与最低宿主版本。 |
| `index.html` | 使用 `meta[name="treasure-plugin-code"]` 声明与 manifest 一致的编码。 |
| `src/main.ts` | 在挂载 Vue 应用前调用 `initTreasure()`。 |
| `src/` | 仅维护插件业务 UI、状态和业务逻辑。 |
| `scripts/init/<version>.sql` | 安装或升级时创建插件数据表；应保持幂等。 |
| `scripts/destroy.sql` | 卸载时清理插件专属资源；避免影响用户主动选择的外部文件。 |
| `README.md` | 记录该插件的产品定位、核心流程、架构、色彩方案、使用方式与构建命令。 |

## 3. 使用 SDK

```ts
import { createApp } from 'vue';
import { initTreasure, getTreasure } from 'treasure-sdk';
import App from './App.vue';

initTreasure();
createApp(App).mount('#app');

const api = getTreasure();
const result = await api.query('SELECT * FROM notes', ['notes']);
```

插件业务代码只通过 SDK 调用宿主能力。不要直接 import Treasure 宿主源码、调用 Tauri API，或手写底层桥接消息。

### 数据约束

- SQL 使用裸表名，如 `notes`；每条 SQL 必须完整声明 `tables`。
- 宿主自动将表名隔离到 `plugin_{pluginCode}_*` 命名空间。
- 禁止访问 `tp_*`、`sys_*` 等平台表。
- 仅使用参数化 SQL；禁止拼接用户输入。
- 不使用 `DROP TABLE`、`ALTER TABLE`、`RENAME TABLE` 等高风险 DDL。

## 4. manifest 与版本

`manifest.json` 是插件的安装契约。`name` 一旦发布，不应更改；它决定数据命名空间、设置归属和宿主识别身份。

```json
{
  "name": "my-plugin",
  "alias": "我的插件",
  "version": "1.0.0",
  "entry": "index.html",
  "minPlatformVersion": "2.0.0",
  "menu": { "name": "我的插件", "order": 100 }
}
```

- 使用语义化版本；数据结构变化应新增版本化初始化脚本。
- 菜单与设置是宿主展示的一部分，文案应面向最终用户。
- 自定义图标应放在插件包内并使用相对路径引用。

## 5. 视觉与产品设计

插件是独立产品页面，但处于 Treasure 工作区中：

- 插件 README 要说明自身的用户问题、核心页面/流程和视觉角色。
- 首先保证业务信息层级和可访问性，再选择独立配色；不要机械复制宿主侧边栏。
- 宿主色彩与布局约束见 [Treasure 宿主视觉参考](TREASURE-HOST-DESIGN.md)。
- 每个插件应在自己的 README 中列出主色、背景、文字、语义色及其用途，避免颜色只散落在源码中。

## 6. 验证路径

### 独立开发

```bash
npm install
npm run dev
```

SDK 在浏览器中使用 `DevBridge` 模拟常规数据、文件和设置能力。该模式适合 UI 和业务逻辑迭代；清除浏览器站点数据会清除模拟数据。

### 宿主联调

1. 启动插件开发服务器。
2. 打开系统中**已安装的 Treasure** 桌面应用；无需克隆、编译或运行 Treasure 源码项目。
3. 在插件管理中的调试入口加载插件开发地址。
4. 验证真实文件、设置、菜单、对话框、权限失败路径和插件关闭后的清理行为。

开发态模拟与宿主能力不完全等价；涉及原生能力、菜单和文件路径的改动必须完成宿主联调。

## 7. 构建与发布

```bash
npm run build
npm run build:plugin

# 如脚本支持，可额外生成 ZIP
npm run build:plugin:zip
```

打包以插件项目目录名作为**发布包名**：`build-output/<package-name>/` 是目录包，`build-output/<package-name>.zip` 是可导入 Treasure 的 ZIP 包。例如 `shi-yu-lu` 项目会生成 `build-output/shi-yu-lu/` 和 `build-output/shi-yu-lu.zip`。包根目录必须直接包含 `index.html`、静态资源、`manifest.json` 和 `scripts/`。

发布包名只用于分发和文件管理；Treasure 的插件身份仍由 `manifest.json` 中的 `name` 与入口页的 `treasure-plugin-code` 决定，两者必须一致。首次开发或打包时，脚手架会按既有规则为插件身份生成并固定随机后缀，以避免不同开发者的插件编码冲突；该身份生成机制不影响发布包名。

### 发布检查清单

- [ ] `manifest.json`、入口 meta 标签和构建包编码一致。
- [ ] 插件 README 已更新产品功能、架构与色彩方案。
- [ ] 版本号和初始化脚本匹配，重复安装/升级不会破坏数据。
- [ ] 独立开发和宿主联调均已完成。
- [ ] `npm run build` 与 `npm run build:plugin` 成功。
- [ ] 已验证安装、启动、更新、卸载及失败提示。

## 8. 文档归属

| 内容 | 权威位置 |
| --- | --- |
| 插件研发流程、manifest、打包与联调 | 本文档。 |
| SDK 方法、类型与返回值 | [SDK API 参考](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/API-REFERENCE.md)。 |
| 请求/响应信封、action、版本兼容 | [桥接协议](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/BRIDGE-PROTOCOL.md)。 |
| 宿主产品与内部实现 | [Treasure](https://github.com/Luzenrocy/treasure) README。 |
| 某一插件的功能与设计 | 对应插件目录的 README。 |
