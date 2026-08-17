# 石玉录

> 面向本地 Markdown 文件的笔记编辑与资产管理插件。

石玉录将目录中的 Markdown 文件组织为可浏览、可编辑、可导出的笔记工作区。它使用 Cherry Markdown 提供编辑与预览能力，通过 `treasure-sdk` 调用宿主文件、系统设置、对话框和菜单能力。

## 产品原型与核心流程

```text
选择存储目录
  → 扫描 Markdown 文件树
  → 选择或新建笔记
  → 编辑、自动保存与资产索引维护
  → 需要时导出 PDF 或图片
```

| 区域 | 功能 |
| --- | --- |
| 目录侧栏 | 浏览 Markdown 文件树、新建文件/目录、删除、打开右键操作。 |
| 编辑区 | 使用 Cherry Markdown 提供双栏编辑、纯编辑和只读预览模式。 |
| 资产管理 | 保存和清理笔记附件，维护资产引用索引；支持重建索引。 |
| 导出 | 将当前笔记导出为 PDF 或图片。 |
| 原生菜单 | 注册编辑模式、导出和关闭当前文件等上下文菜单能力。 |

## 技术架构

```mermaid
flowchart LR
  A[目录与 Markdown 文件] --> B[文件扫描与树形视图]
  B --> C[Cherry Markdown 编辑器]
  C --> D[自动保存与附件清理]
  D --> E[资产索引]
  C --> F[PDF / 图片导出]
  G[treasure-sdk] --> A
  G --> H[插件设置与原生菜单]
```

- `src/App.vue`：页面编排、编辑器生命周期、文件树、导出与菜单协作。
- `src/utils/fileScanner.ts`：扫描与构建 Markdown 文件树。
- `src/utils/assetStorage.ts`、`assetIndex.ts`、`assetCleanup.ts`：附件存储、索引重建与删除清理。
- `scripts/`：插件包构建及生命周期脚本；当前版本不维护自建业务表。

## 色彩方案

石玉录使用与 Treasure 协调的“暖米纸张 + 紫墨强调”方案，突出安静阅读与长期书写。

| 角色 | 色值 | 使用位置 |
| --- | --- | --- |
| 页面纸张底 | `#FFF7EA → #F7F2FF → #EEF7FF` | 编辑器与欢迎区的低饱和渐变基底。 |
| 主文字 | `#4F463B` / `#554D43` | 标题、笔记内容与关键文字。 |
| 紫色交互 | `#7656A7` / `#9A84BD` | 选中态、工具图标与操作反馈。 |
| 装饰渐变 | `#FFB978 → #B69CFF` | 细分隔线和有限强调。 |
| 危险操作 | `#D36C6C` | 删除与错误提示。 |

深色导航属于宿主外壳，石玉录仅在自身页面内使用柔和的米色、紫灰与低对比度边界，避免产生第二层强导航。

## 系统设置与数据

| 系统设置项 | 用途 |
| --- | --- |
| `storage_dir` | manifest 中声明的目录展示项；Treasure 系统设置页面用于回显当前选择，插件不通过 `settings` 读取其中的路径或授权 ID。 |

笔记正文与附件存储在用户选择的目录中，不复制进插件数据库。首次选择时，业务代码以 `settings.set({ key: 'storage_dir', directory })` 保存设置，再调用 `permissions.grantDirectory` 建立目录授权；后续启动读取设置中的授权 ID 与路径摘要，并用 `permissions.verifyDirectoryGrant` 取得根目录引用。绝对路径及宿主授权记录不进入插件状态。更换目录、重新授权或主动撤销会保留旧授权并标记为 `revoked`；仅插件卸载会物理删除该插件的权限记录。插件通过 SDK 请求文件操作；资产索引用于判断附件引用并辅助安全清理。

## 开发、联调与打包

```bash
npm install
npm run dev

# 构建和生成插件目录包
npm run build:plugin

# 同时生成 ZIP 安装包
npm run build:plugin:zip
```

打包产物为 `build-output/shi-yu-lu/` 和 `build-output/shi-yu-lu.zip`。

`npm run dev` 只启动可注册的插件开发服务。石玉录应在 Treasure 中通过“注册调试插件”完成所有调试；打包后可导入目录包或 ZIP 包。完整流程见 [插件研发指南](../docs/PLUGIN-DEVELOPMENT-GUIDE.md)。

本插件要求 Treasure 2.0.0+。本地可验证工作区树、私有资产索引和错误处理；请人工验证原生文件/目录选择、重启后的授权、撤销授权、导出覆盖与回收站行为。

石玉录当前通过宿主内部 `treasure-menu-event` 接收原生菜单点击，因为 SDK 2.0 尚未公开类型化菜单事件订阅。该实现与 Treasure 2.0.0 宿主协议绑定；SDK 提供正式事件 API 后应优先迁移，不应复制到新的第三方插件。

## 关联文档

- [插件研发指南](../docs/PLUGIN-DEVELOPMENT-GUIDE.md)
- [Treasure 宿主视觉参考](../docs/TREASURE-HOST-DESIGN.md)
- [SDK API 参考](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/API-REFERENCE.md)
