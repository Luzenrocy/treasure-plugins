import { menus, type MenuRegistration, type MenuClickEvent } from '@luzenrocy/treasure-sdk';
import type { Result } from '../domain/errors';
import { sdkError } from '../domain/errors';

export const FILE_MENU_ID = 'excalidraw.file';
export const VIEW_MENU_ID = 'excalidraw.view';
export type EditorMode = 'drawing' | 'mind-map';
export type MenuAction = 'new' | 'close' | 'save' | 'export' | 'drawing-mode' | 'mind-map-mode';
const fileRegistration = (enabled: { new: boolean; close: boolean; save: boolean; export: boolean }): MenuRegistration => ({ menuId: FILE_MENU_ID, rootLabel: 'File', items: [{ id: 'new', label: '新建', enabled: enabled.new }, { id: 'close', label: '关闭', enabled: enabled.close }, { id: 'save', label: '保存', enabled: enabled.save }, { id: 'export', label: '导出', enabled: enabled.export }] });
const viewRegistration = (mode: EditorMode, canEnterMindMap: boolean): MenuRegistration => ({ menuId: VIEW_MENU_ID, rootLabel: 'View', items: [{ id: 'drawing-mode', label: '普通绘图模式', type: 'check', checked: mode === 'drawing', enabled: true }, { id: 'mind-map-mode', label: '思维导图模式', type: 'check', checked: mode === 'mind-map', enabled: canEnterMindMap }] });
export class MenuActions {
  private tokens: string[] = [];
  private registeredMenuIds: string[] = [];
  async register(onAction: (action: MenuAction) => void, enabled: { new: boolean; close: boolean; save: boolean; export: boolean }, mode: EditorMode, canEnterMindMap: boolean): Promise<Result<void>> {
    const registrations = [fileRegistration(enabled), viewRegistration(mode, canEnterMindMap)];
    for (const registration of registrations) {
      const response = await menus.register(registration); if (!response.ok) { await this.unregister(); return { ok: false, error: sdkError(response.error, `注册 ${registration.rootLabel} 菜单`) }; }
      this.registeredMenuIds.push(registration.menuId);
      const subscription = menus.subscribe(registration.menuId, (event: MenuClickEvent) => { if (event.itemId === 'new' || event.itemId === 'close' || event.itemId === 'save' || event.itemId === 'export' || event.itemId === 'drawing-mode' || event.itemId === 'mind-map-mode') onAction(event.itemId); });
      if (!subscription.ok) { await this.unregister(); return { ok: false, error: sdkError(subscription.error, `订阅 ${registration.rootLabel} 菜单`) }; }
      this.tokens.push(subscription.value.token);
    }
    return { ok: true, value: undefined };
  }
  async syncViewMenu(mode: EditorMode, canEnterMindMap: boolean): Promise<Result<void>> {
    if (!this.registeredMenuIds.includes(VIEW_MENU_ID)) return { ok: true, value: undefined };
    // updateChecked 只能处理勾选状态；这里还要同步思维导图入口的 enabled 状态。
    const response = await menus.register(viewRegistration(mode, canEnterMindMap));
    return response.ok ? { ok: true, value: undefined } : { ok: false, error: sdkError(response.error, '同步 View 菜单') };
  }
  async unregister(): Promise<void> { for (const token of this.tokens) menus.unsubscribe(token); this.tokens = []; for (const menuId of this.registeredMenuIds) await menus.unregister(menuId); this.registeredMenuIds = []; }
}
