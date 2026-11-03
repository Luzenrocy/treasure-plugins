import { files, storage, type FileReference } from 'treasure-sdk';
import { loadLibraryFromBlob, serializeLibraryAsJSON } from '@excalidraw/excalidraw';
import type { LibraryItems } from '@excalidraw/excalidraw/types';
import { err, ok, sdkError, type Result } from '../domain/errors';
import { guardBytes } from './size-guard';
import { hashBytes } from './drawing-file-service';
import type { LibraryInstallSession, LibraryItem } from '../domain/library';

const keyFor = (id: string) => `libraries/packages/${encodeURIComponent(id)}.excalidrawlib`;
const indexKey = 'libraries/index.json';
export class LibraryService {
  async install(item: LibraryItem, bytes: Uint8Array): Promise<Result<LibraryInstallSession>> {
    const size = guardBytes(bytes, '安装素材'); if (!size.ok) return size;
    let parsed: LibraryItems;
    try { parsed = await loadLibraryFromBlob(new Blob([bytes], { type: 'application/vnd.excalidrawlib+json' })); } catch (cause) { return err('VALIDATION_FAILED', '素材包格式无效', '校验素材', cause); }
    const checksum = await hashBytes(bytes); const key = keyFor(item.stableId); const previousIndex = await storage.read(indexKey); const previousBlob = await storage.read(key); let index: Record<string, { stableId: string; version: number; checksum: string; storageKey: string; status: string }> = {}; if (previousIndex.ok) { try { index = JSON.parse(new TextDecoder().decode(previousIndex.value)); } catch { index = {}; } } const written = await storage.write({ key, data: bytes });
    if (!written.ok) return { ok: false, error: sdkError(written.error, '写入素材') };
    index[item.stableId] = { stableId: item.stableId, version: item.version, checksum, storageKey: key, status: 'installed' }; const indexResponse = await storage.write({ key: indexKey, data: new TextEncoder().encode(JSON.stringify(index)) });
    if (!indexResponse.ok) { if (previousBlob.ok) await storage.write({ key, data: previousBlob.value }); else await storage.remove(key); if (previousIndex.ok) await storage.write({ key: indexKey, data: previousIndex.value }); return { ok: false, error: sdkError(indexResponse.error, '更新素材索引') }; }
    void parsed;
    return ok({ stableId: item.stableId, stage: 'complete', mode: 'direct-file', checksum });
  }
  async uninstall(stableId: string): Promise<Result<void>> {
    try {
      const previousIndex = await storage.read(indexKey);
      if (!previousIndex.ok) return previousIndex.error.code === 'NOT_FOUND' ? ok(undefined) : { ok: false, error: sdkError(previousIndex.error, '读取素材索引') };
      let index: Record<string, { stableId: string; version: number; checksum: string; storageKey: string; status?: string }>;
      try { index = JSON.parse(new TextDecoder().decode(previousIndex.value)); } catch (cause) { return err('VALIDATION_FAILED', '素材索引损坏', '卸载素材', cause); }
      const entry = index[stableId];
      if (!entry) return ok(undefined);
      delete index[stableId];
      const updated = await storage.write({ key: indexKey, data: new TextEncoder().encode(JSON.stringify(index)) });
      if (!updated.ok) return { ok: false, error: sdkError(updated.error, '更新素材索引') };
      // The index is authoritative for readInstalled(). Clean up the package
      // asynchronously so a slow or unavailable remove RPC cannot block the UI.
      void storage.remove(entry.storageKey).catch(() => undefined);
      return ok(undefined);
    } catch (cause) {
      return err('IO_ERROR', '卸载素材失败', '卸载素材', cause);
    }
  }
  async importLocal(file: FileReference): Promise<Result<{ bytes: Uint8Array; items: LibraryItems; checksum: string }>> { const response = await files.readFile(file); if (!response.ok) return { ok: false, error: sdkError(response.error, '读取本地素材') }; const size = guardBytes(response.value, '导入素材'); if (!size.ok) return size; try { const items = await loadLibraryFromBlob(new Blob([response.value], { type: 'application/vnd.excalidrawlib+json' })); return ok({ bytes: response.value, items, checksum: await hashBytes(response.value) }); } catch (cause) { return err('VALIDATION_FAILED', '本地素材格式无效', '校验本地素材', cause); } }
  async readInstalled(): Promise<Result<{ index: Record<string, { stableId: string; version: number; checksum: string; storageKey: string }>; libraries: LibraryItems }>> { const index = await storage.read(indexKey); if (!index.ok) return index.error.code === 'NOT_FOUND' ? ok({ index: {}, libraries: [] }) : { ok: false, error: sdkError(index.error, '读取素材索引') }; try { const parsed = JSON.parse(new TextDecoder().decode(index.value)) as Record<string, { stableId: string; version: number; checksum: string; storageKey: string }>; const libraries = [] as Array<LibraryItems[number]>; for (const entry of Object.values(parsed)) { const blob = await storage.read(entry.storageKey); if (!blob.ok) continue; try { libraries.push(...await loadLibraryFromBlob(new Blob([blob.value], { type: 'application/vnd.excalidrawlib+json' }))); } catch { /* 保留其他可用素材 */ } } return ok({ index: parsed, libraries }); } catch (cause) { return err('VALIDATION_FAILED', '素材索引损坏', '恢复素材', cause); } }
  serialize(items: LibraryItems): Result<Uint8Array> { try { return ok(new TextEncoder().encode(serializeLibraryAsJSON(items))); } catch (cause) { return err('VALIDATION_FAILED', '无法序列化素材', '序列化素材', cause); } }
}
