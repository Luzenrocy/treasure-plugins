import { getTreasure } from 'treasure-sdk';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export async function scanMarkdownDirectory(dirPath: string): Promise<FileEntry[]> {
  const api = getTreasure();
  const entries: FileEntry[] = [];
  const dirEntries = await api.readDir(dirPath);
  console.log(dirPath + ' 下的文件列表：' + JSON.stringify(dirEntries));
  for (const entry of dirEntries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory) {
      entries.push({
        name: entry.name,
        path: entry.path,
        isDirectory: true,
        children: await scanMarkdownDirectory(entry.path),
      });
    } else if (entry.isFile && /\.(md|markdown)$/i.test(entry.name)) {
      entries.push({ name: entry.name, path: entry.path, isDirectory: false });
    }
  }

  return entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}
