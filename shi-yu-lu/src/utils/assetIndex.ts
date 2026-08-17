import { extractAssetMarkdownUrls, readAssetMetadata, removeAssetFile, resolveAssetPath, writeAssetMetadata } from './assetStorage';
import { workspace, type WorkspaceEntry } from './workspace';

const INDEX_KEY = '.asset-index.json';
const INDEX_VERSION = 1;
export interface AssetIndex { version: number; map: Record<string, string[]>; }
export interface RebuildProgress { phase: 'scan' | 'index'; processed: number; total: number; current?: string; }
export interface RebuildSignal { aborted: boolean; }

function extract(content: string, root: string, markdownPath: string) { return extractAssetMarkdownUrls(content).map(url => resolveAssetPath(root, markdownPath, url)).filter((path): path is string => Boolean(path)); }
function flatten(entries: WorkspaceEntry[]): WorkspaceEntry[] { return entries.flatMap(entry => 'directory' in entry ? [entry, ...flatten(entry.children)] : [entry]); }

export async function loadAssetIndex(_root: string): Promise<AssetIndex | null> {
  const bytes = await readAssetMetadata(INDEX_KEY); if (!bytes) return null;
  try { const index = JSON.parse(new TextDecoder().decode(bytes)) as AssetIndex; return index.version === INDEX_VERSION && index.map ? index : null; } catch { return null; }
}
export async function saveAssetIndex(_root: string, index: AssetIndex): Promise<void> {
  await writeAssetMetadata(INDEX_KEY, new TextEncoder().encode(JSON.stringify(index)));
}
export async function addAssetRef(root: string, assetPath: string, markdownPath: string): Promise<void> {
  const index = await loadAssetIndex(root) || { version: INDEX_VERSION, map: {} };
  index.map[assetPath] = [...new Set([...(index.map[assetPath] || []), markdownPath])];
  try { await saveAssetIndex(root, index); } catch (error) { await removeAssetFile(assetPath).catch(() => undefined); throw error; }
}
export async function removeAssetRef(root: string, assetPath: string, markdownPath: string): Promise<boolean> {
  const index = await loadAssetIndex(root); if (!index) throw new Error('资产索引不可用，请先重建资产索引');
  const refs = (index.map[assetPath] || []).filter(ref => ref !== markdownPath);
  if (refs.length) index.map[assetPath] = refs; else delete index.map[assetPath];
  await saveAssetIndex(root, index); return refs.length === 0;
}
export async function rebuildAssetIndex(root: string, onProgress?: (value: RebuildProgress) => void, signal?: RebuildSignal): Promise<{ indexed: number; orphaned: number }> {
  onProgress?.({ phase: 'scan', processed: 0, total: 0 });
  const markdown = flatten(await workspace.refresh()).filter((entry): entry is Extract<WorkspaceEntry, { file: unknown }> => 'file' in entry && /\.(md|markdown)$/i.test(entry.name));
  const index: AssetIndex = { version: INDEX_VERSION, map: {} };
  for (let i = 0; i < markdown.length; i += 1) {
    if (signal?.aborted) return { indexed: 0, orphaned: 0 };
    const file = markdown[i], content = await workspace.readText(file.path) || '';
    for (const path of extract(content, root, file.path)) index.map[path] = [...new Set([...(index.map[path] || []), file.path])];
    onProgress?.({ phase: 'index', processed: i + 1, total: markdown.length, current: file.path });
  }
  await saveAssetIndex(root, index);
  return { indexed: Object.keys(index.map).length, orphaned: 0 };
}
