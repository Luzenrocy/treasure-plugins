import * as React from 'react';
import type { ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types';
import { displayDrawingName, type DrawingFile } from '../domain/drawing';
type CanvasElement = { id: string; type: string; customData?: Record<string, unknown>; [key: string]: unknown };

export interface ExcalidrawBridgeOptions {
  onError?: (error: unknown) => void;
  onChange?: (elements: readonly CanvasElement[], appState: AppState, files: BinaryFiles) => void;
  onLibraryChange?: (items: LibraryItems) => void;
  onApi?: (api: ExcalidrawImperativeAPI) => void;
  onLibraryToggle?: () => void;
  onDrawingOpen?: (file: DrawingFile) => void;
  onDrawingDelete?: (file: DrawingFile) => void;
  onDrawingNew?: () => void;
  onMindMapImport?: () => void;
  onMindMapEdit?: () => void;
  onDrawingSave?: () => void;
  onDrawingClose?: () => void;
  drawingFiles?: readonly DrawingFile[];
  drawingFilesLoading?: boolean;
  libraryOpen?: boolean;
  mindMapAvailable?: boolean;
  mindMapEditorOpen?: boolean;
}

export interface ExcalidrawBridge {
  unmount(): void;
  update(options: Pick<ExcalidrawBridgeOptions, 'drawingFiles' | 'drawingFilesLoading' | 'mindMapAvailable' | 'mindMapEditorOpen'>): void;
}

function keyedFragment(key: string, children: React.ReactNode[]): React.ReactElement {
  return React.createElement(React.Fragment, { key }, children);
}

class EditorErrorBoundary extends React.Component<{ onError?: (error: unknown) => void; children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
  componentDidCatch(error: unknown): void { this.props.onError?.(error); }
  render(): React.ReactNode {
    if (this.state.error) return React.createElement('div', { className: 'editor-error', role: 'alert' }, `编辑器加载失败：${this.state.error.message || '请重新打开插件'}`);
    return this.props.children;
  }
}

/**
 * Mounts the official React editor inside the minimal Vue shell. No custom
 * scene or filesystem state crosses this adapter.
 */
export function mountExcalidraw(container: HTMLElement, options: ExcalidrawBridgeOptions = {}): ExcalidrawBridge {
  let root: Root | null = createRoot(container);
  let libraryOpen = !!options.libraryOpen;
  let drawingFiles = options.drawingFiles ?? [];
  let drawingFilesLoading = !!options.drawingFilesLoading;
  let mindMapAvailable = !!options.mindMapAvailable;
  let mindMapEditorOpen = !!options.mindMapEditorOpen;
  const filePlusIcon = React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }, React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }), React.createElement('path', { d: 'M14 2v6h6M12 11v6M9 14h6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }))
  const fileCloseIcon = React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }, React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }), React.createElement('path', { d: 'M14 2v6h6M9 13l6 6M15 13l-6 6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }))
  const fileSaveIcon = React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }, React.createElement('path', { d: 'M5 3h12l2 2v16H5zM8 3v6h8V3M8 21v-7h8v7', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }))
  const fileDeleteIcon = React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }, React.createElement('path', { d: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }))
  const libraryIcon = React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }, React.createElement('path', { d: 'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13', fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round' }))
  const mindMapIcon = React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }, React.createElement('circle', { cx: 5, cy: 12, r: 2, fill: 'currentColor' }), React.createElement('circle', { cx: 19, cy: 5, r: 2, fill: 'currentColor' }), React.createElement('circle', { cx: 19, cy: 12, r: 2, fill: 'currentColor' }), React.createElement('circle', { cx: 19, cy: 19, r: 2, fill: 'currentColor' }), React.createElement('path', { d: 'M7 12h5m0 0 5-7m-5 7h5m-5 0 5 7', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))

  const render = (): void => {
    if (!root) return;
    const directoryItems = drawingFilesLoading
      ? [React.createElement(MainMenu.ItemCustom, { key: 'drawing-files-loading', children: '正在列举绘图…' })]
      : drawingFiles.length
        ? drawingFiles.map((file, index) => React.createElement(MainMenu.ItemCustom, {
          key: `drawing-file-${file.file.id}-${index}`,
          className: 'treasure-drawing-file-row',
          children: React.Children.toArray([
            React.createElement('button', { key: 'open', type: 'button', className: 'treasure-drawing-file-open', title: `打开 ${displayDrawingName(file.name)}`, onClick: () => options.onDrawingOpen?.(file) }, displayDrawingName(file.name)),
            React.createElement('button', { key: 'delete', type: 'button', className: 'treasure-drawing-file-delete', 'aria-label': `删除 ${displayDrawingName(file.name)}`, title: `删除 ${displayDrawingName(file.name)}`, onClick: () => options.onDrawingDelete?.(file) }, fileDeleteIcon),
          ]),
        }))
        : [React.createElement(MainMenu.ItemCustom, { key: 'drawing-files-empty', children: '目录中还没有 .excalidraw 文件' })];
    const drawingDirectory = React.createElement(MainMenu.Group, {
      key: 'drawing-directory', className: 'treasure-drawing-directory',
      children: keyedFragment('drawing-directory-items', [
        React.createElement('div', { key: 'drawing-directory-header', className: 'treasure-drawing-menu-header' },
          React.createElement('span', { className: 'treasure-drawing-menu-header__title' }, '绘图目录'),
        ),
        // Only the directory list itself scrolls. Keeping it in one custom
        // item prevents the surrounding canvas menu from gaining a global
        // scrollbar when a folder contains many drawings.
        React.createElement(MainMenu.ItemCustom, { key: 'drawing-files', className: 'treasure-drawing-file-list', children: keyedFragment('drawing-file-list-items', directoryItems) }),
      ]),
    });
    const mainMenu = React.createElement(MainMenu, {
      children: keyedFragment('main-menu-items', [
        React.createElement(MainMenu.DefaultItems.LoadScene, { key: 'load-scene' }),
        React.createElement(MainMenu.DefaultItems.SaveToActiveFile, { key: 'save-active-file' }),
        React.createElement(MainMenu.Item, { key: 'drawing-new', icon: filePlusIcon, 'aria-label': '新建文件', title: '新建文件', onSelect: () => options.onDrawingNew?.(), children: '新建文件' }),
        React.createElement(MainMenu.Item, { key: 'mind-map-import', icon: filePlusIcon, 'aria-label': '导入思维导图', title: '导入 XMind 或 SMM 思维导图', onSelect: () => options.onMindMapImport?.(), children: '导入思维导图' }),
        React.createElement(MainMenu.Item, { key: 'drawing-save', icon: fileSaveIcon, 'aria-label': '保存文件', title: '保存文件', onSelect: () => options.onDrawingSave?.(), children: '保存文件' }),
        React.createElement(MainMenu.Item, { key: 'drawing-close', icon: fileCloseIcon, 'aria-label': '关闭文件', title: '关闭文件', onSelect: () => options.onDrawingClose?.(), children: '关闭文件' }),
        React.createElement(MainMenu.DefaultItems.SearchMenu, { key: 'search' }),
        React.createElement(MainMenu.DefaultItems.Help, { key: 'help' }),
        React.createElement(MainMenu.DefaultItems.ClearCanvas, { key: 'clear-canvas' }),
        React.createElement(MainMenu.Separator, { key: 'before-theme' }),
        drawingDirectory,
        React.createElement(MainMenu.Separator, { key: 'after-drawing-directory' }),
        React.createElement(MainMenu.DefaultItems.ToggleTheme, { key: 'theme' }),
        React.createElement(MainMenu.DefaultItems.ChangeCanvasBackground, { key: 'canvas-background' }),
      ]),
    });
    const editor = React.createElement(Excalidraw as unknown as ComponentType<Record<string, unknown>>, {
      langCode: 'zh-CN',
      onChange: options.onChange,
      onLibraryChange: options.onLibraryChange,
      excalidrawAPI: options.onApi,
      renderTopRightUI: () => React.createElement('div', { className: 'treasure-top-right-actions' }, [
        React.createElement('button', {
          key: 'mind-map', type: 'button', className: 'treasure-mind-map-trigger', disabled: !mindMapAvailable, 'aria-label': '思维导图模式', 'aria-pressed': mindMapEditorOpen, title: mindMapAvailable ? (mindMapEditorOpen ? '思维导图编辑模式已打开' : '进入思维导图编辑模式') : '请先导入或打开思维导图', onClick: () => options.onMindMapEdit?.(),
        }, mindMapIcon),
        React.createElement('button', {
          key: 'library', type: 'button', className: 'treasure-library-trigger', 'aria-label': '素材库', 'aria-expanded': libraryOpen, 'aria-controls': 'treasure-library-drawer', onClick: () => { libraryOpen = !libraryOpen; container.querySelector('.treasure-library-trigger')?.setAttribute('aria-expanded', String(libraryOpen)); options.onLibraryToggle?.(); },
        }, libraryIcon, React.createElement('span', { className: 'treasure-library-trigger__label' }, '素材库')),
      ]),
      ['UI' + 'Options']: { canvasActions: { ['loadScene']: false, ['saveToActiveFile']: false, ['export']: false, ['saveAsImage']: false } },
      isCollaborating: false,
      children: mainMenu,
    });
    root.render(React.createElement(EditorErrorBoundary, { onError: options.onError, children: editor }));
  };

  render();
  return {
    unmount() {
      if (!root) return;
      root.unmount();
      root = null;
    },
    update(nextOptions) {
      drawingFiles = nextOptions.drawingFiles ?? [];
      drawingFilesLoading = !!nextOptions.drawingFilesLoading;
      mindMapAvailable = !!nextOptions.mindMapAvailable;
      mindMapEditorOpen = !!nextOptions.mindMapEditorOpen;
      render();
    },
  };
}

