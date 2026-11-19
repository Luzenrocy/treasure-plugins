# 窗口菜单动作契约

## 目的与边界

Excalidraw 插件通过公开 `treasure-sdk` 注册 `File` 菜单中的保存和导出动作，并通过 SDK 订阅点击事件。插件代码不得监听 `window`、调用 `postMessage`、导入宿主源码或依赖 `treasure-menu-event`。宿主内部可以继续保留该消息作为桥接实现细节，但只能由 SDK bridge 接收、校验和转换。

当前事实：SDK 2.1.1 的 `menus` 只公开 `register` 和 `unregister`；Treasure 当前 `dispatchMenuEvent` 仅向活动 iframe 发送 `{ type: 'treasure-menu-event', menuId, itemId }`。当前事实不构成插件可用契约。

## 推荐的公开 API

以下是本计划的 `[Decision]` 推荐形态；具体命名可在 SDK/宿主同步实现时做兼容性评审，但语义不得削弱：

```ts
export type MenuEventSource = 'treasure.window-menu';

export interface MenuClickEvent {
  eventId: string;
  menuId: string;
  itemId: string;
  pluginCode: string;
  source: MenuEventSource;
  occurredAt: string;
  platformVersion: string;
}

export interface MenuClickFilter {
  menuId?: string;
  itemIds?: string[];
}

export interface MenuSubscription {
  subscriptionId: string;
}

menus.register(registration: MenuRegistration): Promise<Result<void>>;
menus.update(input: { menuId: string; items: MenuItem[] }): Promise<Result<void>>;
menus.subscribe(
  filter: MenuClickFilter,
  listener: (event: MenuClickEvent) => void,
): Promise<Result<MenuSubscription>>;
menus.unsubscribe(subscriptionId: string): Promise<Result<void>>;
menus.unregister(menuId: string): Promise<Result<void>>;
```

`listener` 只进入 SDK iframe 内的本地 registry，绝不进入 `postMessage` 或其他 structured-clone payload。SDK bridge 只发送可序列化的 filter/token；订阅 token 只在当前页面会话有效，不写入 settings/storage。若 SDK 团队把更新并入 `register`，仍必须保留同样的幂等和状态语义。

## 事件字段与来源校验

宿主必须从 `MessageEvent.source` 和已登记 iframe 元数据解析 `pluginCode`，忽略 payload 中任何同名字段；同时校验来源窗口、登记 origin、活动插件和菜单注册归属。SDK bridge 只向已登记订阅者投递事件，并在回调前验证消息类型、字段类型、`menuId/itemId` 是否属于该插件注册、固定 `source`、`eventId` 去重窗口和能力版本。校验失败丢弃并写宿主日志，不调用插件回调。

`eventId` 用于去重和诊断，不保证跨宿主重启递增；`occurredAt` 是宿主观测时间，不是业务时间；插件不得据此做安全判断。

## 生命周期与版本兼容

插件初始化后先注册菜单，再订阅点击；任一步返回 `Result` 错误都进入“菜单能力不可用”状态。页面卸载、停用、重载和 `destroyTreasure()` 必须按“先 unsubscribe、再 unregister、最后销毁 bridge”顺序尽力清理，重复清理幂等。

活动 tab 切换采用“暂停投递、保留订阅”：宿主切出该插件时保留注册和 subscription token，只停止投递；切回时自动恢复投递，不创建第二个订阅。只有 iframe 销毁、插件卸载或 bridge 销毁才撤销订阅。若 SDK 观察到 `REFERENCE_EXPIRED`/bridge 重建，插件按“确认现有注册 → 幂等重订阅 → 恢复 enabled 状态”重试，失败才显示菜单不可用和手动重试入口。

当前 SDK 2.1.1/宿主 2.1.x 没有此公共订阅能力。菜单点击作为独立 capability 发布，建议首个 `capabilityVersion/minCapabilityVersion` 为 `1.0`；插件平台 `manifest.minPlatformVersion` 继续保持 2.1.0。当前 2.1.x 可加载核心绘图，但菜单动作保持不可用，直到 SDK/宿主发布并确认该 capability。当前旧 bridge 对未知 operation 的事实返回是 `VALIDATION_FAILED`；SDK adapter 对已知能力缺失统一映射为 `UNSUPPORTED`，同步后的宿主也应直接返回该结构化码。

## 插件映射与验收

插件注册稳定的 `excalidraw.file` 菜单及 `save`、`export` 两项；点击后根据当前 `DrawingFileSession` 和 `ExportRequest` 触发既有保存/导出服务。无目录、无内容、操作进行中或能力不可用时，通过 `menus.update` 设置 `enabled: false` 或使用宿主允许的明确不可用状态。插件卸载时注销全部订阅和菜单，不恢复页面标题行或浮动按钮。

- SDK mock 验证 register、update、subscribe、unsubscribe、unregister 的 `Result<T>` 错误、幂等、listener 本地 registry 和销毁顺序。
- 宿主手工验证活动 tab 路由、切出时暂停且切回自动恢复、伪造来源/错误 origin 被拒绝、重复事件去重、重载后无重复菜单，以及当前 2.1.x 的不可用提示和 `VALIDATION_FAILED` → `UNSUPPORTED` 适配结果。
- 插件源码搜索不得出现 `treasure-menu-event`、`window.addEventListener('message'` 或 `postMessage`。
