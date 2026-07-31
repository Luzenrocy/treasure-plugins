import { file } from 'treasure-sdk';
import { extractAssetMarkdownUrls, resolveAssetPath } from './assetStorage';
import { addAssetRef, removeAssetRef } from './assetIndex';

export function extractAssetPaths(content: string, storageRootPath: string, markdownPath: string): Set<string> {
  return new Set(extractAssetMarkdownUrls(content).map(url => resolveAssetPath(storageRootPath, markdownPath, url)).filter((path): path is string => Boolean(path)));
}

async function readFileContent(path: string): Promise<string> {
  const res = await file.readFile(path);
  return res.code === 1 ? res.data || '' : '';
}

async function deleteAssetFile(path: string): Promise<void> {
  const res = await file.deleteFile(path);
  if (res.code !== 1) throw new Error(res.msg || `删除附件失败: ${path}`);
}

export async function cleanupAssetsBeforeMarkdownDelete(storageRootPath: string, markdownPath: string): Promise<void> {
  const content = await readFileContent(markdownPath);
  const currentAssets = extractAssetPaths(content, storageRootPath, markdownPath);
  for (const assetPath of currentAssets) {
    const shouldDelete = await removeAssetRef(storageRootPath, assetPath, markdownPath);
    if (shouldDelete) await deleteAssetFile(assetPath);
  }
}

export async function cleanupRemovedAssets(storageRootPath: string, markdownPath: string, oldContent: string, newContent: string): Promise<void> {
  const oldAssets = extractAssetPaths(oldContent, storageRootPath, markdownPath);
  const newAssets = extractAssetPaths(newContent, storageRootPath, markdownPath);

  for (const assetPath of newAssets) {
    if (!oldAssets.has(assetPath)) await addAssetRef(storageRootPath, assetPath, markdownPath);
  }

  for (const assetPath of oldAssets) {
    if (!newAssets.has(assetPath)) {
      const shouldDelete = await removeAssetRef(storageRootPath, assetPath, markdownPath);
      if (shouldDelete) await deleteAssetFile(assetPath);
    }
  }
}
