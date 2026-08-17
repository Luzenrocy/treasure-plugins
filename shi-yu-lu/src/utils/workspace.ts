import { directories, files, permissions, settings, type DirectoryReference, type FileReference } from 'treasure-sdk';

/** Stable permission binding, chosen by this plugin rather than generated at runtime. */
const DIRECTORY_PERMISSION_KEY = 'storage_dir';

export interface WorkspaceFile { name: string; path: string; file: FileReference; }
export interface WorkspaceDirectory { name: string; path: string; directory: DirectoryReference; children: WorkspaceEntry[]; }
export type WorkspaceEntry = WorkspaceFile | WorkspaceDirectory;

function isDirectory(entry: WorkspaceEntry): entry is WorkspaceDirectory { return 'directory' in entry; }

/** Maps display-relative workspace paths to host references without exposing absolute paths. */
export class Workspace {
  private root: DirectoryReference | null = null;
  private readonly entries = new Map<string, WorkspaceEntry>();
  private lastError = '';
  private lastErrorCode = '';

  async restore(): Promise<boolean> {
    const saved = await settings.get(DIRECTORY_PERMISSION_KEY);
    if (!saved.ok || saved.value.paramType !== 'dir' || !saved.value.accessGrantId || !saved.value.pathHash) return false;
    const verified = await permissions.verifyDirectoryGrant({ permissionKey: DIRECTORY_PERMISSION_KEY, accessGrantId: saved.value.accessGrantId, pathHash: saved.value.pathHash });
    if (!verified.ok) return false;
    try {
      this.root = verified.value.directory;
      await this.refresh();
      if (this.lastError) {
        this.root = null;
        this.entries.clear();
        return false;
      }
      return true;
    } catch { return false; }
  }

  async choose(): Promise<boolean> {
    const selected = await files.openDialog({ kind: 'directory', title: '选择石玉录工作目录' });
    if (!selected.ok) return false;
    if (Array.isArray(selected.value)) return false;
    const configured = await settings.set({ key: DIRECTORY_PERMISSION_KEY, directory: selected.value });
    if (!configured.ok) return false;
    const persisted = await permissions.grantDirectory({ permissionKey: DIRECTORY_PERMISSION_KEY, directory: selected.value });
    if (!persisted.ok) return false;
    this.root = persisted.value.directory;
    await this.refresh();
    return true;
  }

  async refresh(): Promise<WorkspaceEntry[]> {
    this.entries.clear();
    this.lastError = '';
    this.lastErrorCode = '';
    if (!this.root) return [];
    let roots = await this.scan(this.root, '');
    // The bridge can be recreated while a plugin iframe remains alive. Retry
    // once with the persisted root grant instead of treating that stale
    // in-memory reference as a revoked user authorization.
    if (this.lastErrorCode === 'PERMISSION_DENIED' && await this.restoreRootReference()) {
      this.entries.clear();
      this.lastError = '';
      this.lastErrorCode = '';
      roots = await this.scan(this.root!, '');
    }
    for (const entry of roots) this.index(entry);
    return roots;
  }

  getRoot() { return this.root; }
  get(path: string) { return this.entries.get(path); }
  getLastError() { return this.lastError; }

  /** Internal directories such as `.assets` stay out of the visible tree. */
  async getOrCreateHiddenDirectory(name: string): Promise<DirectoryReference | null> {
    if (!this.root || !name.startsWith('.') || name === '.' || name === '..') return null;
    let listed = await directories.list(this.root);
    if (!listed.ok && listed.error.code === 'PERMISSION_DENIED' && await this.restoreRootReference()) {
      listed = await directories.list(this.root);
    }
    if (!listed.ok) { this.lastError = listed.error.message; return null; }
    const existing = listed.value.find(entry => entry.name === name && entry.kind === 'directory')?.directory;
    if (existing) return existing;
    const created = await directories.create({ directory: this.root, name });
    if (!created.ok) { this.lastError = created.error.message; return null; }
    return created.value;
  }

  async readText(path: string): Promise<string | null> {
    const entry = this.entries.get(path);
    if (!entry || isDirectory(entry)) return null;
    const data = await files.readFile(entry.file);
    return data.ok ? new TextDecoder().decode(data.value) : null;
  }

  async writeText(parentPath: string, fileName: string, content: string): Promise<boolean> {
    const parent = parentPath ? this.entries.get(parentPath) : this.root && { directory: this.root } as WorkspaceDirectory;
    if (!parent || !isDirectory(parent)) { this.lastError = '目标目录不存在或授权已失效'; return false; }
    const saved = await files.writeFile({ directory: parent.directory, fileName, data: new TextEncoder().encode(content) });
    if (!saved.ok) { this.lastError = saved.error.message; return false; }
    this.lastError = '';
    await this.refresh();
    return true;
  }

  async createDirectory(parentPath: string, name: string): Promise<boolean> {
    const parent = parentPath ? this.entries.get(parentPath) : this.root && { directory: this.root } as WorkspaceDirectory;
    if (!parent || !isDirectory(parent)) return false;
    const created = await directories.create({ directory: parent.directory, name });
    if (!created.ok) return false;
    await this.refresh();
    return true;
  }

  async remove(path: string): Promise<boolean> {
    const entry = this.entries.get(path);
    if (!entry) return false;
    if (isDirectory(entry)) {
      const result = await directories.remove({ directory: entry.directory });
      if (!result.ok) return false;
    } else {
      const slash = path.lastIndexOf('/');
      const parentPath = slash < 0 ? '' : path.slice(0, slash);
      const parent = parentPath ? this.entries.get(parentPath) : this.root && { directory: this.root } as WorkspaceDirectory;
      if (!parent || !isDirectory(parent)) return false;
      const result = await directories.remove({ directory: parent.directory, name: entry.name });
      if (!result.ok) return false;
    }
    await this.refresh();
    return true;
  }

  private async scan(directory: DirectoryReference, parentPath: string): Promise<WorkspaceEntry[]> {
    const response = await directories.list(directory);
    if (!response.ok) {
      this.lastError ||= response.error.message;
      this.lastErrorCode ||= response.error.code;
      return [];
    }
    const entries: WorkspaceEntry[] = [];
    for (const entry of response.value) {
      if (entry.name.startsWith('.')) continue;
      const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'directory' && entry.directory) entries.push({ name: entry.name, path, directory: entry.directory, children: await this.scan(entry.directory, path) });
      if (entry.kind === 'file' && entry.file) entries.push({ name: entry.name, path, file: entry.file });
    }
    return entries.sort((a, b) => Number(isDirectory(b)) - Number(isDirectory(a)) || a.name.localeCompare(b.name));
  }

  private index(entry: WorkspaceEntry) {
    this.entries.set(entry.path, entry);
    if (isDirectory(entry)) entry.children.forEach(child => this.index(child));
  }

  private async restoreRootReference(): Promise<boolean> {
    const saved = await settings.get(DIRECTORY_PERMISSION_KEY);
    if (!saved.ok || saved.value.paramType !== 'dir' || !saved.value.accessGrantId || !saved.value.pathHash) return false;
    const verified = await permissions.verifyDirectoryGrant({ permissionKey: DIRECTORY_PERMISSION_KEY, accessGrantId: saved.value.accessGrantId, pathHash: saved.value.pathHash });
    if (!verified.ok) return false;
    this.root = verified.value.directory;
    return true;
  }
}

export const workspace = new Workspace();
