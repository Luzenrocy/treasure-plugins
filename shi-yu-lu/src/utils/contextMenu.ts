import type { FileEntry } from './fileScanner';

/** Returns the workspace-relative parent path used by tree context actions. */
export function resolveContextPath(data: Pick<FileEntry, 'path' | 'isDirectory'> | null, rootPath = ''): string {
  if (!data) return rootPath;
  if (data.isDirectory) return data.path;
  const slash = data.path.lastIndexOf('/');
  return slash < 0 ? '' : data.path.slice(0, slash);
}
