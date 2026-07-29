# 石玉录 Treasure 插件

石玉录是基于 Treasure 插件脚手架拆分出的 Markdown 笔记插件，使用 Cherry Markdown 作为编辑器，通过 Treasure SDK 与宿主平台通信。

## 环境要求

- Node.js 20+
- npm
- Treasure 平台版本 2.x

## 安装依赖

```bash
npm install
```

## 独立开发

```bash
npm run dev
```

独立开发模式下 SDK 会启用 `DevBridge`，使用浏览器本地存储模拟数据库、设置和文件操作。该模式适合调试页面布局、编辑器交互和基础逻辑。

## 平台联调

1. 启动石玉录插件开发服务：`npm run dev`
2. 启动 Treasure 主程序：`npm run tauri dev`
3. 打开 Treasure 的插件管理页面
4. 使用调试入口输入插件地址，例如：`http://localhost:5173`
5. 在侧边栏或调试标签页中验证 iframe 加载、编辑器渲染、SDK 通信

调试模式不会安装插件，也不会写入正式插件表，适合开发阶段快速联调。

## 打包

```bash
npm run build
npm run build:plugin
```

输出目录：

```text
build-output/shi-yu-lu.treasure-plugin/
```

该目录就是 Treasure 平台导入时选择的插件目录。

## 导入到 Treasure

1. 打开 Treasure 插件管理页面
2. 点击导入
3. 选择 `build-output/shi-yu-lu.treasure-plugin/`
4. 导入成功后侧边栏出现「石玉录」菜单
5. 首次进入时按提示选择笔记文件存储目录

## manifest 配置

当前插件编码：`shi-yu-lu`

插件菜单：`石玉录`

配置项：

- `文件存储目录`：选择 Markdown 文件保存目录
- `插件菜单`：控制菜单显示/隐藏

## SDK 使用约定

代码中统一使用 `@sdk` 别名引用 SDK：

```ts
import { initTreasure, getTreasure } from '@sdk/treasure';
```

不要使用 `../sdk/treasure` 这类相对路径，否则在 `src/utils` 等子目录中会解析到错误位置。

## 文件操作

石玉录不直接调用 Tauri API，而是通过 SDK 调用宿主能力：

```ts
const api = getTreasure();

const content = await api.readFile(path);
await api.writeFile(path, content);
await api.mkdir(path);
await api.deleteFile(path);
const dir = await api.selectDirectory('选择文件存储目录');
```

## 配置读写

```ts
const api = getTreasure();

const settings = await api.getSettings();
await api.saveSetting(settings.data);
```

## 生命周期脚本

- `scripts/init.sql`：当前版本预留，无需建表
- `scripts/destroy.sql`：当前版本预留，无自建表需清理

后续如增加插件自建表，表名必须以 `plugin_shi_yu_lu_` 开头。

## 常见问题

### Failed to resolve import "../sdk/treasure"

原因是相对路径层级错误。已配置 `@sdk` 别名，应统一改为：

```ts
import { getTreasure } from '@sdk/treasure';
```

### 导入后 iframe 404

请确认已执行：

```bash
npm run build
npm run build:plugin
```

并导入 `build-output/shi-yu-lu.treasure-plugin/`。插件包根目录必须直接包含 `index.html`。

### 修改后平台没有更新

开发阶段请使用调试入口加载 `http://localhost:5173`。正式导入模式需要重新打包并重新导入插件。
