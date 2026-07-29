# Treasure Plugin Scaffold

Treasure 插件脚手架用于开发可导入 Treasure 平台的 iframe 插件。项目同时支持独立开发模式和平台联调模式。

## 环境要求

- Node.js 20+
- npm
- Treasure 平台版本 2.x

## 快速开始

```bash
npm install
npm run dev
```

开发服务默认运行在 Vite 提供的 localhost 地址。独立运行时 SDK 自动启用 `DevBridge`，使用 `sql.js` 和浏览器本地存储模拟数据库与文件操作。

## 目录说明

- `src/`：插件页面源码
- `sdk/`：Treasure 插件 SDK 公共接口
- `sdk-bridge/`：桥接实现（内部实现，插件不可见）
- `scripts/init.sql`：插件安装时执行
- `scripts/destroy.sql`：插件卸载时执行
- `manifest.json`：插件声明文件
- `build-output/`：插件打包输出目录

## SDK 引用规范

不要使用 `../sdk/treasure` 这类相对路径引用 SDK。脚手架已配置 `@sdk` 别名，应统一使用：

```ts
import { initTreasure, getTreasure } from '@sdk/treasure';
```

这样可以避免 `src/utils/*`、`src/components/*` 等不同目录层级下出现 SDK 路径解析错误。

## SDK 基本用法

```ts
import { initTreasure, getTreasure } from '@sdk/treasure';

initTreasure();

const api = getTreasure();

const list = await api.query('SELECT * FROM data WHERE id = ?', ['data'], [1]);

await api.execute(
  'INSERT INTO data (name, value) VALUES (?, ?)',
  ['data'],
  ['demo', 'value']
);

await api.transaction([
  { sql: 'UPDATE data SET value = ? WHERE name = ?', tables: ['data'], params: ['new', 'demo'] },
]);
```

## 数据库安全规则

插件只能操作自身前缀表，表名必须以 `plugin_{插件编码}_` 开头。例如插件编码为 `my-plugin` 时，建议使用：

```sql
CREATE TABLE IF NOT EXISTS plugin_my_plugin_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value TEXT
);
```

不要访问平台核心表：`tp_plugin`、`tp_menu`、`tp_setting`、`sys_migration`、`sys_audit_log`。

## manifest.json

关键字段：

- `name`：插件编码，必须为 kebab-case，例如 `my-plugin`
- `alias`：插件显示名称
- `version`：语义化版本，例如 `1.0.0`
- `entry`：入口文件，通常为 `index.html`
- `menu.name`：菜单显示名称
- `settings`：插件配置项

## 独立调试

```bash
npm run dev
```

独立调试用于快速开发 UI 和本地逻辑，不依赖 Treasure 主程序。

## 平台联调

1. 启动插件开发服务：`npm run dev`
2. 启动 Treasure：`npm run tauri dev`
3. 在 Treasure 插件管理页面使用调试入口
4. 输入插件地址，例如 `http://localhost:5173`

调试模式不会写入 `tp_plugin` 表，适合开发阶段联调 iframe 与 postMessage。

## 打包插件

```bash
npm run build
npm run build:plugin
```

输出目录：

```text
build-output/{name}.treasure-plugin/
```

插件包根目录会直接包含 `index.html`、静态资源、`manifest.json` 和 `scripts/`，以匹配 Treasure 平台的 `plugin://localhost/{pluginCode}/index.html` 加载规则。

## 导入到 Treasure

1. 在 Treasure 中打开插件管理页面
2. 点击导入
3. 选择 `build-output/{name}.treasure-plugin/` 目录
4. 导入成功后侧边栏会出现插件菜单

## 重置开发数据库

```bash
npm run db:reset
```

用于清理独立开发模式下的本地模拟数据。

## 生命周期脚本

- `scripts/init.sql`：插件安装时执行
- `scripts/destroy.sql`：插件卸载时执行

生命周期脚本应保持幂等，避免重复导入或卸载时报错。
