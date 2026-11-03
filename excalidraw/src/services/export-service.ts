import { files, type FileReference } from 'treasure-sdk';
import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
type CanvasElement = { id: string; [key: string]: unknown };
import { err, ok, sdkError, type Result } from '../domain/errors';
import { guardBytes } from './size-guard';
import type { ExportRequest } from '../domain/export';

export class ExportService {
  async render(request: ExportRequest, elements: readonly CanvasElement[], appState: AppState, binaryFiles: BinaryFiles): Promise<Result<Blob>> {
    const selected = request.selectedOnly ? elements.filter((element) => appState.selectedElementIds[element.id]) : elements;
    if (request.selectedOnly && !selected.length) return err('VALIDATION_FAILED', '请先选择要导出的元素', '导出');
    const exportState = { ...appState, exportBackground: !request.transparent, selectedElementIds: request.selectedOnly ? appState.selectedElementIds : {} };
    try { if (request.target === 'svg') return ok(await exportToSvg(selected as never, exportState as never, binaryFiles)); if (request.target === 'pdf') return err('UNSUPPORTED', 'PDF 导出将在后续版本提供', '导出'); return ok(await exportToBlob({ elements: selected as never, appState: exportState, files: binaryFiles, mimeType: 'image/png' })); } catch (cause) { return err('IO_ERROR', '生成导出内容失败', '导出', cause); }
  }
  async save(blob: Blob, request: ExportRequest, _directory?: FileReference): Promise<Result<FileReference>> { const bytes = new Uint8Array(await blob.arrayBuffer()); const size = guardBytes(bytes, '导出'); if (!size.ok) return size; const extension = request.target; const target = await files.saveDialog({ title: `导出 ${extension.toUpperCase()}`, defaultFileName: request.defaultFileName || `excalidraw-export.${extension}`, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] }); if (!target.ok) return target.error.code === 'CANCELLED' ? err('CANCELLED', '已取消导出', '导出') : { ok: false, error: sdkError(target.error, '选择导出位置') }; const saved = await files.writeFile({ file: target.value, data: bytes }); return saved.ok ? ok(saved.value) : { ok: false, error: sdkError(saved.error, '写入导出文件') }; }
}
