import { directories, files, permissions, settings, storage, menus, type DirectoryReference, type FileReference, type Result as SdkResult, type DirectoryEntry, type MenuRegistration } from 'treasure-sdk';
import { err, ok, sdkError, type Result } from '../domain/errors';

export const WORKSPACE_KEY = 'workspace_dir';
export const LIBRARY_URL_KEY = 'library_url';
export const DEFAULT_LIBRARY_URL = 'https://libraries.excalidraw.com/libraries.json';
export const LIBRARY_STATS_URL_KEY = 'library_stats_url';
export const DEFAULT_LIBRARY_STATS_URL = 'https://libraries.excalidraw.com/stats.json';
export type SdkBoundary = { directories: typeof directories; files: typeof files; permissions: typeof permissions; settings: typeof settings; storage: typeof storage; menus: typeof menus };
export const sdk: SdkBoundary = { directories, files, permissions, settings, storage, menus };
export function fromSdk<T>(result: SdkResult<T>, stage?: string): Result<T> { return result.ok ? ok(result.value) : { ok: false, error: sdkError(result.error, stage) }; }
export function isReference(value: unknown): value is FileReference | DirectoryReference { return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'; }
export type { DirectoryReference, FileReference, DirectoryEntry, MenuRegistration };

export async function getLibraryUrl(): Promise<Result<string>> {
  const response = await settings.get(LIBRARY_URL_KEY);
  if (!response.ok) return err('IO_ERROR', response.error.message, '读取素材库设置');
  if (response.value.paramType === 'dir') return err('VALIDATION_FAILED', '素材库地址设置类型无效', '读取素材库设置');
  const value = response.value.value;
  if (!value) return ok(DEFAULT_LIBRARY_URL);
  try { const parsed = new URL(value); return parsed.protocol === 'https:' ? ok(parsed.toString()) : err('VALIDATION_FAILED', '素材库地址必须使用 HTTPS', '读取素材库设置'); } catch { return err('VALIDATION_FAILED', '素材库地址无效', '读取素材库设置'); }
}

export async function getLibraryStatsUrl(): Promise<Result<string>> {
  const response = await settings.get(LIBRARY_STATS_URL_KEY);
  if (!response.ok) return ok(DEFAULT_LIBRARY_STATS_URL);
  if (response.value.paramType === 'dir') return err('VALIDATION_FAILED', '素材下载统计设置类型无效', '读取素材下载统计设置');
  const value = response.value.value;
  if (!value) return ok(DEFAULT_LIBRARY_STATS_URL);
  try { const parsed = new URL(value); return parsed.protocol === 'https:' ? ok(parsed.toString()) : err('VALIDATION_FAILED', '素材下载统计地址必须使用 HTTPS', '读取素材下载统计设置'); } catch { return err('VALIDATION_FAILED', '素材下载统计地址无效', '读取素材下载统计设置'); }
}
