import { directories, files, logs, type DirectoryReference } from 'treasure-sdk';
import { workspace } from './workspace';

const ASSET_ALIAS = '@assets';
const previewUrlCache = new Map<string, string>();
const mimeExtMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
const extensionMimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf' };

export interface SavedAsset { path: string; markdownUrl: string; }

function sanitize(name: string) { return name.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+|\.+$/g, '').trim() || 'asset'; }
function extension(source: File) { const suffix = source.name.split('.').pop(); return suffix && suffix !== source.name ? suffix.toLowerCase() : mimeExtMap[source.type] || 'bin'; }
function mimeForAsset(name: string) { return extensionMimeMap[name.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream'; }
const ASSET_DIRECTORY = '.assets';

function previewTrace(level: 'debug' | 'error', stage: string, details: Record<string, unknown>) {
  const event = { stage, ...details };
  (level === 'error' ? console.error : console.debug)('[asset-preview]', event);
  // Keep production host logs actionable. Development keeps the full trace;
  // normal desktop use records errors only.
  if (level === 'error' || import.meta.env.DEV) {
    void logs?.write({ level, category: 'asset-preview', message: stage, details: event }).catch(() => undefined);
  }
}

/** Cherry may render its preview in a separate document. Data URLs remain valid
 * across that boundary, unlike a Blob URL owned by the plugin document. */
function previewDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function normalizeAssetUrl(url: string): string | null {
  const source = url.trim().replace(/^<|>$/g, '').split(/[?#]/)[0].replace(/^\.\//, '');
  if (!source.startsWith(`${ASSET_ALIAS}/`)) return null;
  let name: string;
  try { name = decodeURIComponent(source.slice(ASSET_ALIAS.length + 1)); }
  catch { return null; }
  // Validate after decoding: `%2F` and `%2E%2E` must not turn an otherwise
  // harmless URL into a path outside the flat `.assets` directory.
  if (!name || name === '.' || name === '..' || name.includes('..') || name.includes('/') || name.includes('\\')) return null;
  return name;
}
export function extractAssetMarkdownUrls(content: string): string[] {
  const found = new Set<string>();
  const expression = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(content))) if (normalizeAssetUrl(match[1])) found.add(match[1]);
  return [...found];
}
export function isAssetMarkdownUrl(url: string) { return normalizeAssetUrl(url) !== null; }
/** Kept for callers; returned value is a private-storage relative key. */
export function resolveAssetPath(_root: string, _markdown: string, url: string): string | null {
  const name = normalizeAssetUrl(url); return name || null;
}

async function assetDirectory(): Promise<DirectoryReference> {
  const directory = await workspace.getOrCreateHiddenDirectory(ASSET_DIRECTORY);
  if (!directory) throw new Error(workspace.getLastError() || '资产目录不可用');
  return directory;
}

async function assetFile(directory: DirectoryReference, name: string) {
  const listed = await directories.list(directory);
  if (!listed.ok) throw new Error(listed.error.message);
  return listed.value.find(entry => entry.name === name && entry.kind === 'file')?.file;
}

export async function saveAssetForMarkdown(_root: string, markdownPath: string, source: File): Promise<SavedAsset> {
  if (!markdownPath) throw new Error('请先选择 Markdown 文件');
  const bytes = new Uint8Array(await source.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest)).slice(0, 4).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const host = sanitize(markdownPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'document');
  const origin = sanitize(source.name.replace(/\.[^.]+$/, ''));
  const name = `${host}__${origin}_${hash}.${extension(source)}`;
  const directory = await assetDirectory();
  const saved = await files.writeFile({ directory, fileName: name, data: bytes });
  if (!saved.ok) throw new Error(saved.error.message);
  return { path: name, markdownUrl: `${ASSET_ALIAS}/${name}` };
}

export async function readAssetAsObjectUrl(_root: string, _markdown: string, url: string): Promise<string | null> {
  const name = resolveAssetPath('', '', url);
  previewTrace('debug', 'preview-requested', { url, name });
  if (!name) { previewTrace('error', 'asset-url-invalid', { url }); return null; }
  const cached = previewUrlCache.get(name);
  if (cached) { previewTrace('debug', 'preview-cache-hit', { name }); return cached; }
  let directory: DirectoryReference;
  try {
    directory = await assetDirectory();
    previewTrace('debug', 'asset-directory-ready', { name, directoryId: directory.id });
  } catch (error) {
    previewTrace('error', 'asset-directory-unavailable', { name, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
  let file: import('treasure-sdk').FileReference | undefined;
  try { file = await assetFile(directory, name); } catch (error) {
    previewTrace('error', 'asset-directory-list-failed', { name, directoryId: directory.id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
  if (!file) { previewTrace('error', 'asset-file-not-found', { name, directoryId: directory.id }); return null; }
  previewTrace('debug', 'asset-file-reference-ready', { name, fileId: file.id });
  const value = await files.readFile(file);
  if (!value.ok) { previewTrace('error', 'asset-file-read-failed', { name, fileId: file.id, code: value.error.code, error: value.error.message }); return null; }
  const bytes = Uint8Array.from(value.value);
  if (!bytes.byteLength) { previewTrace('error', 'asset-file-empty', { name, fileId: file.id }); return null; }
  const objectUrl = previewDataUrl(bytes, mimeForAsset(name));
  previewUrlCache.set(name, objectUrl);
  previewTrace('debug', 'preview-data-url-ready', { name, fileId: file.id, bytes: bytes.byteLength, mime: mimeForAsset(name) });
  return objectUrl;
}
export async function readAssetMetadata(name: string): Promise<Uint8Array | null> {
  try { const directory = await assetDirectory(); const file = await assetFile(directory, name); if (!file) return null; const result = await files.readFile(file); return result.ok ? result.value : null; } catch { return null; }
}
export async function writeAssetMetadata(name: string, data: Uint8Array): Promise<void> {
  const directory = await assetDirectory();
  // Files discovered by `directories.list` are readable references. Updating
  // an index is an operation on the already-authorized `.assets` directory,
  // so retain the directory + plain filename form for both create and replace.
  const result = await files.writeFile({ directory, fileName: name, data });
  if (!result.ok) throw new Error(result.error.message);
}
export async function removeAssetFile(name: string): Promise<void> {
  const directory = await assetDirectory(); const result = await directories.remove({ directory, name }); if (!result.ok) throw new Error(result.error.message);
}
/** Data URLs have no browser resource to revoke; document changes only clear the cache. */
export function clearAssetPreviewCache() { previewUrlCache.clear(); }
