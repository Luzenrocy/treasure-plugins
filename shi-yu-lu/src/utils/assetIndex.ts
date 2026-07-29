import { file } from '@treasure/sdk';
import { extractAssetMarkdownUrls, resolveAssetPath } from './assetStorage';

const ASSET_DIR_NAME = '.assets';
const INDEX_FILE_NAME = '.asset-index.json';
const INDEX_VERSION = 1;

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile?: boolean;
}

export interface AssetIndex {
  version: number;
  map: Record<string, string[]>;
}

export interface RebuildProgress {
  phase: 'scan' | 'index';
  processed: number;
  total: number;
  current?: string;
}

export interface RebuildSignal {
  aborted: boolean;
}

function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

function getIndexPath(storageRootPath: string): string {
  return joinPath(joinPath(storageRootPath, ASSET_DIR_NAME), INDEX_FILE_NAME);
}

function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

async function readDirectoryEntries(path: string): Promise<DirectoryEntry[]> {
  const res = await file.readDir(path);
  return res.code === 1 ? res.data || [] : [];
}

async function readTextFile(path: string): Promise<string> {
  const res = await file.readFile(path);
  return res.code === 1 ? res.data || '' : '';
}

async function collectMarkdownFiles(dirPath: string, result: string[], signal?: RebuildSignal): Promise<void> {
  if (signal?.aborted) return;
  const entries = await readDirectoryEntries(dirPath);
  for (const entry of entries) {
    if (signal?.aborted) return;
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory) {
      await collectMarkdownFiles(entry.path, result, signal);
    } else if (isMarkdownPath(entry.path)) {
      result.push(entry.path);
    }
  }
}

function extractAssetPaths(content: string, storageRootPath: string, markdownPath: string): Set<string> {
  return new Set(extractAssetMarkdownUrls(content).map(url => resolveAssetPath(storageRootPath, markdownPath, url)).filter((path): path is string => Boolean(path)));
}

async function countOrphanedAssets(storageRootPath: string, index: AssetIndex): Promise<number> {
  const assetDir = joinPath(storageRootPath, ASSET_DIR_NAME);
  const entries = await readDirectoryEntries(assetDir);
  let orphaned = 0;
  for (const entry of entries) {
    if (entry.isDirectory || entry.name === INDEX_FILE_NAME) continue;
    if (!index.map[entry.path]?.length) orphaned += 1;
  }
  return orphaned;
}

export async function loadAssetIndex(storageRootPath: string): Promise<AssetIndex | null> {
  const res = await file.readFile(getIndexPath(storageRootPath));
  if (res.code !== 1 || !res.data) return null;
  try {
    const parsed = JSON.parse(res.data) as AssetIndex;
    if (!parsed || parsed.version !== INDEX_VERSION || !parsed.map || typeof parsed.map !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveAssetIndex(storageRootPath: string, index: AssetIndex): Promise<void> {
  const assetDir = joinPath(storageRootPath, ASSET_DIR_NAME);
  await file.createDir(assetDir, { recursive: true });
  const content = JSON.stringify(index, null, 2);
  const updateRes = await file.updateFile(getIndexPath(storageRootPath), content);
  if (updateRes.code === 1) return;
  const createRes = await file.createFile(getIndexPath(storageRootPath), content);
  if (createRes.code !== 1) throw new Error(createRes.msg || updateRes.msg || '写入资产索引失败');
}

export async function addAssetRef(storageRootPath: string, assetPath: string, markdownPath: string): Promise<void> {
  const index = await loadAssetIndex(storageRootPath) || { version: INDEX_VERSION, map: {} };
  const refs = new Set(index.map[assetPath] || []);
  refs.add(markdownPath);
  index.map[assetPath] = Array.from(refs);
  await saveAssetIndex(storageRootPath, index);
}

export async function removeAssetRef(storageRootPath: string, assetPath: string, markdownPath: string): Promise<boolean> {
  const index = await loadAssetIndex(storageRootPath);
  if (!index) throw new Error('资产索引不可用，请先重建资产索引');
  const refs = (index.map[assetPath] || []).filter(path => path !== markdownPath);
  if (refs.length === 0) {
    delete index.map[assetPath];
    await saveAssetIndex(storageRootPath, index);
    return true;
  }
  index.map[assetPath] = refs;
  await saveAssetIndex(storageRootPath, index);
  return false;
}

export async function rebuildAssetIndex(storageRootPath: string, onProgress?: (progress: RebuildProgress) => void, signal?: RebuildSignal): Promise<{ indexed: number; orphaned: number }> {
  const markdownFiles: string[] = [];
  onProgress?.({ phase: 'scan', processed: 0, total: 0 });
  await collectMarkdownFiles(storageRootPath, markdownFiles, signal);
  if (signal?.aborted) return { indexed: 0, orphaned: 0 };

  const index: AssetIndex = { version: INDEX_VERSION, map: {} };
  onProgress?.({ phase: 'index', processed: 0, total: markdownFiles.length });

  for (let i = 0; i < markdownFiles.length; i += 1) {
    if (signal?.aborted) return { indexed: 0, orphaned: 0 };
    const markdownPath = markdownFiles[i];
    const content = await readTextFile(markdownPath);
    for (const assetPath of extractAssetPaths(content, storageRootPath, markdownPath)) {
      const refs = new Set(index.map[assetPath] || []);
      refs.add(markdownPath);
      index.map[assetPath] = Array.from(refs);
    }
    onProgress?.({ phase: 'index', processed: i + 1, total: markdownFiles.length, current: markdownPath });
  }

  if (signal?.aborted) return { indexed: 0, orphaned: 0 };
  await saveAssetIndex(storageRootPath, index);
  return { indexed: Object.keys(index.map).length, orphaned: await countOrphanedAssets(storageRootPath, index) };
}
