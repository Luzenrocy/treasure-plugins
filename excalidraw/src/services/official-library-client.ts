import { DEFAULT_LIBRARY_STATS_URL, DEFAULT_LIBRARY_URL, getLibraryStatsUrl, getLibraryUrl } from '../adapters/treasure-sdk';
import { err, ok, type Result } from '../domain/errors';
import { mergeLibraryDownloadStats, normalizeLibraryRecords, isSafeRef, type LibraryDownloadStats, type LibraryItem } from '../domain/library';

const OFFICIAL_HOST = 'libraries.excalidraw.com';
const OFFICIAL_CONTENT_ROOT = `https://${OFFICIAL_HOST}/libraries/`;
const GITHUB_CATALOG_URL = 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json';
const GITHUB_CONTENT_ROOT = 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/';
type SourceMode = 'official' | 'github-fallback';

function errorMessage(cause: unknown): string { return cause instanceof Error && cause.message ? cause.message : String(cause || '未知网络错误'); }
function contentUrl(root: string, reference: string): string { if (!isSafeRef(reference)) throw new Error('素材引用不是安全的相对路径'); return `${root}${reference}`; }
function canUseGithubFallback(url: string): boolean { try { const parsed = new URL(url); return parsed.protocol === 'https:' && parsed.hostname === OFFICIAL_HOST && parsed.pathname === '/libraries.json'; } catch { return false; } }
function normalizeDownloadStats(input: unknown): Record<string, LibraryDownloadStats> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output: Record<string, LibraryDownloadStats> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const candidate = value as { total?: unknown; week?: unknown };
    const total = typeof candidate.total === 'number' && Number.isFinite(candidate.total) && candidate.total >= 0 ? Math.floor(candidate.total) : 0;
    const week = typeof candidate.week === 'number' && Number.isFinite(candidate.week) && candidate.week >= 0 ? Math.floor(candidate.week) : 0;
    output[key] = { total, week };
  }
  return output;
}

export class OfficialLibraryClient {
  private cache: LibraryItem[] | null = null;
  private fetchedAt = 0;
  private mode: SourceMode = 'official';
  private contentRoot = OFFICIAL_CONTENT_ROOT;
  private readonly fetcher: typeof fetch;
  constructor(fetcher?: typeof fetch) {
    // Window.fetch is a Web IDL method and must be called with Window as `this`.
    // Binding the default keeps the adapter safe when it is passed around as a callback.
    this.fetcher = fetcher || globalThis.fetch.bind(globalThis);
  }
  get cached(): LibraryItem[] | null { return this.cache; }
  get sourceMode(): SourceMode { return this.mode; }

  private async request(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(), 10000); const onAbort = () => timeout.abort(); signal?.addEventListener('abort', onAbort, { once: true });
    try { return await this.fetcher(url, { ...init, signal: timeout.signal }); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  }

  private async loadFrom(url: string, signal?: AbortSignal): Promise<Result<LibraryItem[]>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.request(url, { method: 'GET', headers: { Accept: 'application/json' } }, signal);
        if (!response.ok) throw new Error(`目录请求失败 (${response.status})`);
        return ok(normalizeLibraryRecords(await response.json()));
      } catch (cause) {
        lastError = cause;
        if (signal?.aborted) return err('CANCELLED', '已取消加载素材目录', '读取素材目录', cause);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    return err('IO_ERROR', `素材目录请求失败：${errorMessage(lastError)}`, '读取素材目录', lastError);
  }

  private async loadDownloadStats(signal?: AbortSignal): Promise<Record<string, LibraryDownloadStats>> {
    const configured = await getLibraryStatsUrl();
    const url = configured.ok ? configured.value || DEFAULT_LIBRARY_STATS_URL : DEFAULT_LIBRARY_STATS_URL;
    try {
      const response = await this.request(url, { method: 'GET', headers: { Accept: 'application/json' } }, signal);
      if (!response?.ok) return {};
      return normalizeDownloadStats(await response.json());
    } catch {
      return {};
    }
  }

  async load(signal?: AbortSignal): Promise<Result<LibraryItem[]>> {
    const configured = await getLibraryUrl(); if (!configured.ok) return configured;
    const url = configured.value || DEFAULT_LIBRARY_URL;
    const endpoints: Array<{ url: string; mode: SourceMode; contentRoot: string }> = [{ url, mode: 'official', contentRoot: OFFICIAL_CONTENT_ROOT }];
    if (canUseGithubFallback(url)) endpoints.push({ url: GITHUB_CATALOG_URL, mode: 'github-fallback', contentRoot: GITHUB_CONTENT_ROOT });
    let lastFailure: Result<LibraryItem[]> | null = null;
    for (const endpoint of endpoints) {
      const result = await this.loadFrom(endpoint.url, signal);
      if (result.ok) { const stats = await this.loadDownloadStats(signal); const enriched = mergeLibraryDownloadStats(result.value, stats); this.cache = enriched; this.fetchedAt = Date.now(); this.mode = endpoint.mode; this.contentRoot = endpoint.contentRoot; return ok(enriched); }
      if (result.error.code === 'CANCELLED') return result;
      lastFailure = result;
    }
    return lastFailure || err('IO_ERROR', '素材目录加载失败，请重试', '读取素材目录');
  }

  private async fetchContent(url: string, signal?: AbortSignal): Promise<Result<Uint8Array>> {
    try {
      const response = await this.request(url, { headers: { Accept: 'application/vnd.excalidrawlib+json, application/json' } }, signal);
      if (!response.ok) return err('IO_ERROR', `素材下载失败 (${response.status})`, '下载素材');
      return ok(new Uint8Array(await response.arrayBuffer()));
    } catch (cause) { return signal?.aborted ? err('CANCELLED', '已取消素材下载', '下载素材', cause) : err('IO_ERROR', `素材下载失败：${errorMessage(cause)}`, '下载素材', cause); }
  }

  async fetchSource(item: LibraryItem, signal?: AbortSignal): Promise<Result<Uint8Array>> {
    const roots = [this.contentRoot, ...(this.mode === 'official' ? [GITHUB_CONTENT_ROOT] : [])];
    let lastFailure: Result<Uint8Array> | null = null;
    for (const [index, root] of roots.entries()) { const result = await this.fetchContent(contentUrl(root, item.sourceRef), signal); if (result.ok || result.error.code === 'CANCELLED') { if (index > 0) { this.mode = 'github-fallback'; this.contentRoot = GITHUB_CONTENT_ROOT; } return result; } lastFailure = result; }
    return lastFailure || err('IO_ERROR', '素材下载失败，请重试', '下载素材');
  }

  resolvePreview(item: LibraryItem): Result<string> { try { return ok(contentUrl(this.contentRoot, item.previewRef)); } catch (cause) { return err('VALIDATION_FAILED', '素材预览引用无效', '解析预览', cause); } }
  get fetchedAtMs(): number { return this.fetchedAt; }
}
