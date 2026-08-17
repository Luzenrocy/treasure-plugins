import { extractAssetMarkdownUrls, removeAssetFile, resolveAssetPath } from './assetStorage';
import { addAssetRef, removeAssetRef } from './assetIndex';
import { workspace } from './workspace';

export function extractAssetPaths(content: string, root: string, markdownPath: string): Set<string> { return new Set(extractAssetMarkdownUrls(content).map(url => resolveAssetPath(root, markdownPath, url)).filter((path): path is string => Boolean(path))); }
export async function cleanupAssetsBeforeMarkdownDelete(root: string, markdownPath: string): Promise<void> {
  const content = await workspace.readText(markdownPath) || '';
  for (const path of extractAssetPaths(content, root, markdownPath)) if (await removeAssetRef(root, path, markdownPath)) await removeAssetFile(path);
}
export async function cleanupRemovedAssets(root: string, markdownPath: string, oldContent: string, newContent: string): Promise<void> {
  const oldAssets = extractAssetPaths(oldContent, root, markdownPath), newAssets = extractAssetPaths(newContent, root, markdownPath);
  for (const path of newAssets) if (!oldAssets.has(path)) await addAssetRef(root, path, markdownPath);
  for (const path of oldAssets) if (!newAssets.has(path) && await removeAssetRef(root, path, markdownPath)) await removeAssetFile(path);
}
