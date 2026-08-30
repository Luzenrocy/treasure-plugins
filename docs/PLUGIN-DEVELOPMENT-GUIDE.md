# Treasure 插件研发指南

> 本文定义插件从创建、开发、联调到发布的工程流程。本文中的“宿主”指负责加载插件页面并提供数据库、文件、设置和原生能力的 Treasure 桌面应用。SDK 方法签名请参阅 [SDK API 参考](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/API-REFERENCE.md)，底层通信契约请参阅[桥接协议](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/BRIDGE-PROTOCOL.md)。

## 1. 创建项目

插件模板将 `treasure-sdk` 写入生成项目的 `dependencies`。CLI 默认会在生成后执行 `npm install`，因此 SDK 会随项目依赖一并安装；不需要全局安装 CLI。

```bash
# npx 会按需下载并执行 treasure-sdk CLI
npx treasure-sdk create my-plugin --alias "我的插件"
cd my-plugin
npm run dev
```

如果三个仓库位于同级目录，业务插件可在本地使用 `"treasure-sdk": "file:../../treasure-sdk"` 联调 SDK 工作区源码；该写法不适合独立分发或 CI 从单仓安装。发布插件前应改为经过验证的 npm 版本范围（例如与最低宿主匹配的 `^2.0.0`），重新安装并提交 lockfile，再完成宿主联调。

如使用 `--no-install` 跳过自动安装，或自动安装失败，请在生成的插件目录中手动执行 `npm install`；该步骤会安装 `package.json` 中声明的 `treasure-sdk` 及其他依赖。CLI 会生成 Vue + Vite 项目、SDK 初始化、`manifest.json`、生命周期脚本和插件打包脚本。插件编码必须是小写 kebab-case，例如 `my-plugin`。

## 2. 插件工程结构与约束

| 文件或目录 | 必须承担的职责 |
| --- | --- |
| `manifest.json` | 声明编码、名称、版本、入口、菜单、图标、设置与最低宿主版本。 |
| `index.html` | 使用 `meta[name="treasure-plugin-code"]` 声明与 manifest 一致的编码。 |
| `src/main.ts` | 在挂载 Vue 应用前调用 `initTreasure()`。 |
| `src/` | 仅维护插件业务 UI、状态和业务逻辑。 |
| `scripts/init/<version>.sql` | 安装或升级时创建插件数据表；应保持幂等。 |
| `scripts/destroy.sql` | 卸载时清理插件专属资源；避免影响用户主动选择的外部文件。 |
| `README.md` | 记录该插件的产品定位、核心流程、架构、色彩方案、使用方式与构建命令。 |

## 3. SDK 接入与数据访问

在开始写业务前，先区分四种数据位置：

| 数据在哪里 | 用什么能力 | 适用内容 |
| --- | --- | --- |
| 用户选择的文件或目录 | `files`、`directories` | 用户的文档、项目目录、导入和导出目标。必须先由用户在系统窗口中选择。 |
| 插件自己管理的数据区域 | `storage` | 附件内容、缓存、索引等；以相对键访问，不面向用户直接管理。 |
| 插件自己的结构化数据表 | `database` | 任务、标签、附件元数据、业务关系和查询结果。 |
| 系统设置页面中的插件设置 | `settings` | 在 manifest 中声明主题、筛选、提醒等设置；由用户在 Treasure 系统设置页面管理，插件读取当前值。 |

当用户在系统窗口选择文件或目录后，SDK 返回一个“引用”。引用不是路径字符串，而是后续读写该资源所需的凭据。开发者只需把引用传给对应 SDK 方法；不要试图读取、保存或伪造电脑路径。

### 3.1 SDK 初始化与 Result 处理

这个最小示例说明 SDK 应在何时初始化，以及数据库和文件选择如何以 `Result<T>` 返回结果。

```ts
import { createApp } from 'vue';
import { initTreasure, database, files } from 'treasure-sdk';
import App from './App.vue';

initTreasure();
createApp(App).mount('#app');

const result = await database.query({ sql: 'SELECT * FROM notes', tables: ['notes'] });
if (!result.ok) console.error(result.error.code, result.error.message);

const selected = await files.openDialog({ kind: 'file', multiple: false });
```

插件业务代码只通过 SDK 调用宿主能力。不要直接 import Treasure 宿主源码、调用 Tauri API，或手写底层桥接消息。

所有 SDK 操作返回 `Result<T>`。普通失败（取消、未授权、校验失败、`FILE_TOO_LARGE`）必须检查 `result.ok` 与错误码，不能依赖异常；不使用 `request(action, payload)`。

### 3.2 数据库访问规则

- 插件的数据表由宿主统一保存并隔离；插件只允许访问自己定义的数据表。
- 先在 `scripts/init/<版本>.sql` 中定义表名，例如 `notes`；页面 SQL 中继续使用同一个表名即可，无需做任何前缀或其他修饰。
- 每条 SQL 的 `tables` 是“本条语句访问的表清单”；例如 JOIN、子查询、CTE 中出现的表也要列出。
- 仅使用参数化 SQL；禁止拼接用户输入。
- 不使用 `DROP TABLE`、`ALTER TABLE`、`RENAME TABLE` 等高风险 DDL。
- `query` 仅允许 `SELECT/WITH SELECT`；`execute` 仅允许单条 `INSERT/UPDATE/DELETE`，支持 CTE、JOIN、`EXISTS` 和 `RETURNING`。
- `CREATE`、索引等 DDL 只写入版本化迁移脚本，由宿主迁移流程执行。

### 3.3 文件、目录与插件私有数据

文件权限由用户选择和宿主授权决定；插件不接收也不构造绝对路径。`FileReference` 与 `DirectoryReference` 只可由 SDK 返回，并且仅在所属插件内有效。

| 场景 | 推荐 SDK 流程 | 不应做的事 |
| --- | --- | --- |
| 导入用户文件 | `files.openDialog({ kind: 'file' })` → `files.readFile(file)` | 传入本机绝对路径读取。 |
| 需要反复使用的用户目录 | 选择目录 → `settings.set({ key, directory })` → `permissions.grantDirectory`；启动时读取设置并用 `permissions.verifyDirectoryGrant` → `directories.list` | 将路径或子目录引用写入系统设置。 |
| 新建/删除用户目录中的文件夹 | `directories.create/remove` | 直接使用 Tauri fs 或删除绝对路径。 |
| 业务确定文件名的导出 | `openDialog({ kind: 'directory' })` → `writeFile({ directory, fileName, data })` | 在 `fileName` 内拼接目录。 |
| 用户可修改导出文件名 | `files.saveDialog` → `writeFile({ file, data })` | 二次弹窗输入名称，或复用过期目录引用。 |
| 插件管理的附件、缓存、索引 | `storage.read/write/remove` 使用相对键 | 将插件数据区域的绝对路径写入数据库或设置。 |

文件与私有存储单次读写上限为 32 MiB；超过时返回 `FILE_TOO_LARGE`，不能用 Base64 或内部 action 绕过。`directories.remove` 会将目标移入系统回收站。

#### 3.3.1 目录访问授权流程

这个流程适用于笔记库、项目文件夹、图片目录等需要在多次启动后继续使用同一目录的功能。`WORKSPACE_KEY` 是插件源码中固定的目录授权键，应与 manifest 中 `dir` 设置的 `param_key` 一致。目录设置不返回路径，只返回授权验证需要的 `accessGrantId` 和 `pathHash`。

```ts
import { directories, files, permissions, settings } from 'treasure-sdk';

const WORKSPACE_KEY = 'workspace_dir';

// 首次选择，或之前选择的目录已不可用时重新选择。
const selected = await files.openDialog({ kind: 'directory', title: '选择工作目录' });
if (selected.ok && !Array.isArray(selected.value)) {
  const configured = await settings.set({ key: WORKSPACE_KEY, directory: selected.value });
  if (!configured.ok) return showError(configured.error.message);
  const bound = await permissions.grantDirectory({ permissionKey: WORKSPACE_KEY, directory: selected.value });
  if (bound.ok) await directories.list(bound.value.directory);
  else showError(bound.error.message);
}

// 启动时读取设置并验证授权；失败时引导重新选择。
const saved = await settings.get(WORKSPACE_KEY);
if (saved.ok && saved.value.paramType === 'dir' && saved.value.accessGrantId && saved.value.pathHash) {
  const workspace = await permissions.verifyDirectoryGrant({ permissionKey: WORKSPACE_KEY, accessGrantId: saved.value.accessGrantId, pathHash: saved.value.pathHash });
  if (!workspace.ok) return showError(workspace.error.message);
  const entries = await directories.list(workspace.value.directory);
  if (!entries.ok) showError(entries.error.message);
}
```

用户直接选择的目录是“根目录”。宿主会保存目录授权记录；根目录中的 `.assets` 等子目录和文件则在需要时通过 `directories.list` 取得，不应单独保存。系统设置值与目录授权记录由宿主分别管理，插件只使用 SDK 返回的目录引用。

授权历史规则：更换目录、重新授权和主动撤销会把旧记录标为 `revoked` 并保留；只有插件卸载时，宿主才物理删除该插件的授权记录。

#### 3.3.2 插件私有数据导出流程

这个流程适用于下载附件、导出 PDF、导出图片等“用户希望在系统窗口中决定位置和文件名”的场景。它说明私有存储内容如何安全写到用户选择的保存位置。

```ts
const content = await storage.read(attachment.storageKey);
if (!content.ok) return showError(content.error.message);

const target = await files.saveDialog({
  title: '下载附件', defaultFileName: attachment.fileName,
});
if (!target.ok) return; // CANCELLED 时正常结束

const saved = await files.writeFile({ file: target.value, data: content.value });
if (!saved.ok) showError(saved.error.message);
```

`files.saveDialog` 是 SDK 2.0 正式接口。它是一个系统“另存为”窗口，用户可同时选位置并修改文件名；返回的是当前宿主会话中的只写文件引用，应直接用于 `writeFile({ file, data })`，不要持久化。

> 当前 `files.openDialog` 的 TypeScript 成功类型是 `FileReference[] | DirectoryReference`，尚未按 `options.kind` 自动收窄。选择目录后请像上例一样先用 `!Array.isArray(selected.value)` 收窄；选择文件后使用 `Array.isArray(selected.value)`。这是 SDK 类型体验限制，不代表运行时会返回错误形态。

## 4. Manifest、插件身份与数据迁移

`manifest.json` 是插件的安装契约。`name` 一旦冻结或发布，不应更改；它决定数据命名空间、设置归属和宿主识别身份。

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
- 菜单与系统设置项由宿主展示，文案应面向最终用户。
- 自定义图标应放在插件包内并使用相对路径引用。

### 4.1 插件身份冻结

插件脚手架会在**首次启动 `npm run dev`** 或**首次执行 `npm run build:plugin` / `npm run build:plugin:zip`** 时检查 `manifest.json`。若尚未冻结（没有 `_frozen: true`），它会：

1. 根据 `alias`（无法生成有效编码时使用项目目录名）生成 `name-随机后缀`；
2. 将该 `name` 和 `_frozen: true` 写回源码 `manifest.json`；
3. 同步源码 `index.html` 的 `<meta name="treasure-plugin-code">`，使其与 `manifest.name` 一致。

这不是第三种调试模式，也不产生浏览器模拟数据；它只是为注册调试和打包导入共同确定一次、可持续使用的插件身份。冻结后，后续启动开发服务和重复打包只读取既有身份，不会再次生成后缀。不要手动删除 `_frozen`、修改 `name` 或仅修改入口 meta；若确需新插件身份，应新建插件项目，而不是让已安装插件改名。

### 4.2 数据库操作与版本化迁移

业务运行时只使用 `database.query/execute/transaction`。下面的调用示例说明：更新语句既访问 `tasks`，又在子查询中访问 `task_tags`，因此 `tables` 同时写入两个业务表短名称。

```ts
const changed = await database.execute<{ id: number }>({
  sql: `UPDATE tasks SET status = ?
        WHERE EXISTS (SELECT 1 FROM task_tags WHERE task_id = tasks.id)
        RETURNING id`,
  tables: ['tasks', 'task_tags'],
  params: ['done'],
});
if (!changed.ok) showError(changed.error.message);
```

复杂查询和更新可使用 JOIN、CTE、`EXISTS`、`RETURNING`；不要为此在插件中拼接 SQL 字符串或绕过 SDK。运行时禁止 DDL 与多语句。

下面的 SQL 文件示例说明如何在安装时创建表、索引和自引用外键。它不在页面业务代码中执行；宿主会在安装或升级时执行它：

```sql
-- scripts/init/1.0.0.sql：定义插件要使用的数据表。页面 SQL 中继续使用 tasks 即可。
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  parent_id INTEGER REFERENCES tasks(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
```

- 一个已发布版本的迁移脚本不可修改；每次结构或数据修复新增更高的语义化版本文件。
- 迁移脚本和页面 SQL 使用同一套表名；开发者不需要做任何表名修饰。
- `scripts/destroy.sql` 仅清理插件自身资源，不删除用户选择的工作目录。
- 先写私有附件、后写附件元数据时，SQL 失败必须 `storage.remove` 回滚文件；删除时文件清理失败应记录待清理项并重试。

## 5. 视觉与产品设计

插件是独立产品页面，但处于 Treasure 工作区中：

- 插件 README 要说明自身的用户问题、核心页面/流程和视觉角色。
- 首先保证业务信息层级和可访问性，再选择独立配色；不要机械复制宿主侧边栏。
- 宿主色彩与布局约束见 [Treasure 宿主视觉参考](TREASURE-HOST-DESIGN.md)。
- 每个插件应在自己的 README 中列出主色、背景、文字、语义色及其用途，避免颜色只散落在源码中。

### 5.1 统一滚动条与页面滚动边界

插件中的可滚动业务区域必须使用 Treasure 系统设置页的滚动条样式；不要自定义颜色、悬停态、宽度或全局 `scrollbar-color`。仅为实际可滚动容器声明以下规则：

```css
.scrollable-region::-webkit-scrollbar { width: 6px; }
.scrollable-region::-webkit-scrollbar-track { background: transparent; }
.scrollable-region::-webkit-scrollbar-thumb {
  background: #d3d7da;
  border-radius: 3px;
}
```

页面级容器应固定在宿主 iframe 可用高度内并设为 `overflow: hidden`，再由唯一的主要数据区（例如列表、画布或瀑布流）承担 `overflow-y: auto`。不得让 `body`、插件根节点与业务列表同时出现滚动条；弹窗、抽屉等独立浮层可在自身内容溢出时使用同一滚动条规则。

## 6. 运行模式与验证路径

插件项目的 `npm run dev` 只启动供 Treasure 注册调试插件的本地开发服务。插件页面通过 Treasure 应用调试，SDK 能力也由该应用提供。

### 6.1 注册调试插件

```bash
npm install
npm run dev
```

1. 启动插件开发服务，默认地址通常为 `http://localhost:5173`。
   - 若这是该项目第一次启动，Vite 会先完成“插件身份冻结”，再向 Treasure 暴露 `manifest.json`；无需另行操作。
2. 启动 Treasure 桌面宿主：可以打开已安装应用，也可以在 Treasure 源码目录执行 `npm run tauri -- dev`。
3. 在插件中心开启“插件调试入口”，点击“注册调试插件”，填写开发地址。
4. Treasure 从 `/treasure-manifest.json` 与 `/scripts/init/` 读取插件契约，并在 iframe 中加载插件页面。
5. 在该桌面宿主中验证文件选择/取消、Unicode 文件名、大文件阈值、设置、菜单、授权撤销、导出覆盖、回收站和插件关闭后的清理行为。

### 6.2 打包导入

```bash
npm run build:plugin       # 生成目录包
npm run build:plugin:zip   # 同时生成 ZIP 包
```

在 Treasure 插件中心选择“导入目录包”或“导入 ZIP 文件”。两种载体使用相同的安装、校验、迁移和升级流程。

若从未运行过开发服务，打包脚本会在复制 `dist` 前完成同一套身份冻结；因此无论先走“注册调试插件”还是先走“打包导入”，得到的都是同一个 `manifest.name` 和入口页标识。

## 7. 构建与发布

```bash
npm run build
npm run build:plugin

# 如脚本支持，可额外生成 ZIP
npm run build:plugin:zip
```

打包以插件项目目录名作为**发布包名**：`build-output/<package-name>/` 是目录包，`build-output/<package-name>.zip` 是可导入 Treasure 的 ZIP 包。例如 `shi-yu-lu` 项目会生成 `build-output/shi-yu-lu/` 和 `build-output/shi-yu-lu.zip`。包根目录必须直接包含 `index.html`、静态资源、`manifest.json` 和 `scripts/`。

发布包名只用于分发和文件管理；Treasure 的插件身份仍由 `manifest.json` 中的 `name` 与入口页的 `treasure-plugin-code` 决定，两者必须一致。首次开发或打包时，脚手架会按既有规则为插件身份生成并固定随机后缀，以避免不同开发者的插件编码冲突；该身份生成机制不影响发布包名。打包脚本以冻结后的 manifest 生成包内 `plugin_uid`，因此不要在构建产物中用另一个 `name` 覆盖它。

### 7.1 发布检查清单

- [ ] `manifest.json`、入口 meta 标签和构建包编码一致。
- [ ] `manifest.json` 保留 `_frozen: true`，且 `name` 没有在已有安装或发布后改变。
- [ ] 插件 README 已更新产品功能、架构与色彩方案。
- [ ] 版本号和初始化脚本匹配，重复安装或升级不会导致已有数据丢失或不可用。
- [ ] 已通过“注册调试插件”在 Treasure 应用完成验证，并执行项目已配置的类型检查和测试脚本。
- [ ] `npm run build` 与 `npm run build:plugin` 成功。
- [ ] 已验证安装、启动、更新、卸载及失败提示。

## 8. 文档职责

| 内容 | 权威位置 |
| --- | --- |
| 插件研发流程、manifest、打包与联调 | 本文档。 |
| SDK 方法、类型与返回值 | [SDK API 参考](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/API-REFERENCE.md)。 |
| 请求/响应信封、operation、版本兼容 | [桥接协议](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/BRIDGE-PROTOCOL.md)。 |
| 宿主产品与内部实现 | [Treasure](https://github.com/Luzenrocy/treasure) README。 |
| 某一插件的功能与设计 | 对应插件目录的 README。 |

## 9. 当前公开契约限制

- `menus.register/unregister` 可以向宿主登记菜单，但 SDK 2.0 当前没有公开类型化的点击事件订阅或勾选状态更新接口。内置插件中出现的 `treasure-menu-event` 是宿主内部协议，不作为第三方稳定 API；需要交互菜单的新插件应等待 SDK 补齐事件接口，或在项目风险记录中明确版本绑定。
- `files.openDialog` 的成功类型暂未根据 `kind` 自动收窄，按本文示例使用 `Array.isArray` 判断。
- `dir` 设置不返回绝对路径；应使用其 `accessGrantId` 与 `pathHash` 调用 `permissions.verifyDirectoryGrant`。验证失败时记录诊断并允许用户重新选择；不要匹配错误消息文本。
- 文件/私有存储单次 32 MiB、数据库载荷 256 KiB、事务 50 条和查询结果 1,000 行是宿主硬限制；目前 SDK 不提供流式文件或自动分页接口，业务需自行拆分数据与分页查询。
