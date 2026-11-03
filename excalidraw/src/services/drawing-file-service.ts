import { files, directories, type DirectoryReference, type FileReference } from 'treasure-sdk';
import { loadFromBlob, serializeAsJSON } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
type CanvasElement = { id: string; [key: string]: unknown };
import { err, ok, sdkError, type Result } from '../domain/errors';
import { guardBytes } from './size-guard';

function plainFileReference(file: FileReference): FileReference {
  return { id: file.id, name: file.name, kind: 'file' };
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) { const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }
  let hash = 2166136261; for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619); return (hash >>> 0).toString(16);
}
export interface LoadedDrawing { elements: readonly CanvasElement[]; appState: Partial<AppState>; files: BinaryFiles; hash: string; }
export class DrawingFileService {
  async read(file: FileReference): Promise<Result<LoadedDrawing>> {
    // File references can arrive from Vue as reactive proxies. Always send a
    // plain structured-clone-safe reference across the Treasure bridge.
    const response = await files.readFile(plainFileReference(file)); if (!response.ok) return { ok: false, error: sdkError(response.error, '读取绘图') };
    const size = guardBytes(response.value, '绘图读取'); if (!size.ok) return size;
    try { const hash = await hashBytes(response.value); const restored = await loadFromBlob(new Blob([response.value], { type: 'application/vnd.excalidraw+json' }), null, null); return ok({ elements: (restored.elements || []) as CanvasElement[], appState: restored.appState || {}, files: restored.files || {}, hash }); } catch (cause) { return err('VALIDATION_FAILED', '绘图文件格式无效，当前画布未改变', '解析绘图', cause); }
  }
  serialize(elements: readonly CanvasElement[], appState: Partial<AppState>, binaryFiles: BinaryFiles): Result<Uint8Array> { try { const json = serializeAsJSON(elements as never, appState, binaryFiles, 'local'); const bytes = new TextEncoder().encode(json); const guard = guardBytes(bytes, '保存绘图'); return guard.ok ? ok(bytes) : guard as Result<Uint8Array>; } catch (cause) { return err('VALIDATION_FAILED', '无法序列化当前绘图', '序列化绘图', cause); } }
  async save(directory: DirectoryReference, fileName: string, data: Uint8Array): Promise<Result<FileReference>> { const size = guardBytes(data, '保存绘图'); if (!size.ok) return size; const safeDirectory = { id: directory.id, name: directory.name, kind: 'directory' as const }; const response = await files.writeFile({ directory: safeDirectory, fileName: fileName.toLowerCase().endsWith('.excalidraw') ? fileName : `${fileName}.excalidraw`, data: new Uint8Array(data) }); return response.ok ? ok(response.value) : { ok: false, error: sdkError(response.error, '写入绘图') }; }
  async saveExisting(file: FileReference, data: Uint8Array): Promise<Result<FileReference>> { const size = guardBytes(data, '保存绘图'); if (!size.ok) return size; const response = await files.writeFile({ file: plainFileReference(file), data: new Uint8Array(data) }); return response.ok ? ok(response.value) : { ok: false, error: sdkError(response.error, '更新绘图') }; }
  async remove(directory: DirectoryReference, fileName: string): Promise<Result<void>> { const response = await directories.remove({ directory, name: fileName }); return response.ok ? ok(undefined) : { ok: false, error: sdkError(response.error, '删除绘图') }; }
}
