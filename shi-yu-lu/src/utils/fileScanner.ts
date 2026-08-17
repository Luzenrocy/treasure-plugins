import { workspace, type WorkspaceEntry } from './workspace';

export interface FileEntry {
  name: string;
  /** Workspace-relative display key, never an absolute host path. */
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

function mapEntry(entry: WorkspaceEntry): FileEntry | null {
  if ('directory' in entry) return { name: entry.name, path: entry.path, isDirectory: true, children: entry.children.map(mapEntry).filter((value): value is FileEntry => value !== null) };
  return /\.(md|markdown)$/i.test(entry.name) ? { name: entry.name, path: entry.path, isDirectory: false } : null;
}

/** The path argument is retained only for UI compatibility; host access uses workspace references. */
export async function scanMarkdownDirectory(_path?: string): Promise<FileEntry[]> {
  return (await workspace.refresh()).map(mapEntry).filter((value): value is FileEntry => value !== null);
}
