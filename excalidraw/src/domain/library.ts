export interface LibraryAuthor { name: string; url?: string; [key: string]: unknown }
export interface LibraryRecord { name: string; description?: string; authors: LibraryAuthor[]; source: string; preview: string; created: string; updated: string; version: number; id?: string; itemNames?: string[]; [key: string]: unknown }
export interface LibraryDownloadStats { total: number; week: number }
export interface LibraryItem { stableId: string; statsKey: string; name: string; description: string; authors: LibraryAuthor[]; sourceRef: string; previewRef: string; created: string; updated: string; version: number; itemNames: string[]; downloadsTotal: number; downloadsWeek: number; installed: boolean; installedVersion?: number; invalidReason?: string }
export interface LibraryQuery { keyword?: string; author?: string; version?: number; createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string; sortBy?: 'name' | 'created' | 'updated' | 'version' | 'author' | 'id' | 'downloadsTotal' | 'downloadsWeek'; direction?: 'asc' | 'desc'; page?: number; pageSize?: number }
export interface LibraryPage { items: LibraryItem[]; total: number; page: number; pageSize: number }
export type LibraryInstallStage = 'idle' | 'downloading' | 'validating' | 'writing' | 'complete' | 'failed' | 'cancelled';
export interface LibraryInstallSession { stableId: string; stage: LibraryInstallStage; error?: string; mode?: 'direct-file' | 'install-package'; checksum?: string; }

export function libraryStatsKey(source: string): string { return source.replace(/\.excalidrawlib$/i, '').replace(/\//g, '-').toLowerCase(); }

const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
function generatedStableId(name: string, source: string): string {
  let hash = 2166136261;
  for (const char of `${source}\u0000${name}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `generated-${(hash >>> 0).toString(36)}`;
}
export function normalizeLibraryRecords(input: unknown): LibraryItem[] {
  if (!Array.isArray(input)) throw new Error('素材库目录必须是数组');
  return input.map((record, index) => {
    const value = record && typeof record === 'object' ? record as Partial<LibraryRecord> : {};
    if ((value.id != null && (typeof value.id !== 'string' || !value.id || /[^A-Za-z0-9_-]/.test(value.id))) || typeof value.name !== 'string' || !value.name.trim() || !Array.isArray(value.authors) || typeof value.source !== 'string' || !isSafeRef(value.source) || typeof value.preview !== 'string' || !isSafeRef(value.preview) || !date(value.created) || !date(value.updated) || !Number.isInteger(value.version)) throw new Error(`第 ${index + 1} 条素材记录无效`);
    const authors = value.authors.filter((author): author is LibraryAuthor => !!author && typeof author === 'object' && typeof author.name === 'string').map((author) => ({ name: author.name, ...(typeof author.url === 'string' ? { url: author.url } : {}) }));
    if (!authors.length) throw new Error(`第 ${index + 1} 条素材缺少作者`);
    return { stableId: value.id || generatedStableId(value.name!, value.source!), statsKey: libraryStatsKey(value.source!), name: value.name!, description: typeof value.description === 'string' ? value.description : '', authors, sourceRef: value.source!, previewRef: value.preview!, created: value.created!, updated: value.updated!, version: value.version!, itemNames: Array.isArray(value.itemNames) ? value.itemNames.filter((item): item is string => typeof item === 'string') : [], downloadsTotal: 0, downloadsWeek: 0, installed: false };
  });
}
export function mergeLibraryDownloadStats(items: LibraryItem[], stats: Record<string, LibraryDownloadStats>): LibraryItem[] { return items.map((item) => ({ ...item, downloadsTotal: stats[item.statsKey]?.total ?? 0, downloadsWeek: stats[item.statsKey]?.week ?? 0 })); }
export function isSafeRef(value: string): boolean { return !!value && !value.startsWith('/') && !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.includes('..') && !value.includes('?') && !value.includes('#'); }
export function queryLibraries(items: LibraryItem[], query: LibraryQuery = {}): LibraryPage {
  const keyword = (query.keyword || '').trim().toLocaleLowerCase();
  const filtered = items.filter((item) => {
    const searchable = [item.name, item.description, ...item.authors.map((author) => author.name), ...item.itemNames].join('\n').toLocaleLowerCase();
    return (!keyword || searchable.includes(keyword)) && (!query.author || item.authors.some((author) => author.name === query.author)) && (query.version == null || item.version === query.version) && (!query.createdFrom || item.created >= query.createdFrom) && (!query.createdTo || item.created <= query.createdTo) && (!query.updatedFrom || item.updated >= query.updatedFrom) && (!query.updatedTo || item.updated <= query.updatedTo);
  });
  const sortBy = query.sortBy || 'downloadsTotal'; const direction = query.direction === 'desc' || (query.direction == null && (sortBy === 'downloadsTotal' || sortBy === 'downloadsWeek')) ? -1 : 1;
  const sorted = filtered.map((item, index) => ({ item, index })).sort((a, b) => {
    if (a.item.installed !== b.item.installed) return a.item.installed ? -1 : 1;
    const av = sortBy === 'author' ? a.item.authors[0]?.name || '' : sortBy === 'id' ? a.item.stableId : a.item[sortBy]; const bv = sortBy === 'author' ? b.item.authors[0]?.name || '' : sortBy === 'id' ? b.item.stableId : b.item[sortBy]; const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv)); return result * direction || a.index - b.index;
  }).map(({ item }) => item);
  const page = Math.max(1, query.page || 1); const pageSize = Math.max(1, query.pageSize || 24);
  return { items: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page, pageSize };
}
