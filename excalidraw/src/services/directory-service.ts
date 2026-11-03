import { files, permissions, settings, directories, type DirectoryReference, type FileReference, type DirectoryEntry } from 'treasure-sdk';
import { WORKSPACE_KEY } from '../adapters/treasure-sdk';
import { err, ok, sdkError, type Result } from '../domain/errors';
import type { DrawingDirectorySetting, DrawingFile } from '../domain/drawing';

export class DirectoryService {
  private root: DirectoryReference | null = null;
  get directory(): DirectoryReference | null { return this.root; }
  async restore(): Promise<Result<DrawingDirectorySetting>> {
    const saved = await settings.get(WORKSPACE_KEY);
    if (!saved.ok) return { ok: false, error: sdkError(saved.error, '恢复绘图目录') };
    if (saved.value.paramType !== 'dir' || !saved.value.accessGrantId || !saved.value.pathHash) return ok({ permissionKey: WORKSPACE_KEY, directory: null, directoryName: null, status: 'unconfigured' });
    const verified = await permissions.verifyDirectoryGrant({ permissionKey: WORKSPACE_KEY, accessGrantId: saved.value.accessGrantId, pathHash: saved.value.pathHash });
    if (!verified.ok) return { ok: false, error: { ...sdkError(verified.error, '验证绘图目录'), code: verified.error.code === 'GRANT_NOT_FOUND' ? 'GRANT_NOT_FOUND' : 'PERMISSION_DENIED' } };
    this.root = verified.value.directory;
    return ok({ permissionKey: WORKSPACE_KEY, directory: this.root, directoryName: saved.value.directoryName, status: 'ready' });
  }
  async choose(): Promise<Result<DrawingDirectorySetting>> {
    const selected = await files.openDialog({ kind: 'directory', title: '选择绘图目录' });
    if (!selected.ok) return selected.error.code === 'CANCELLED' ? ok({ permissionKey: WORKSPACE_KEY, directory: this.root, status: this.root ? 'ready' : 'unconfigured' }) : { ok: false, error: sdkError(selected.error, '选择绘图目录') };
    if (Array.isArray(selected.value)) return err('VALIDATION_FAILED', '系统选择器未返回目录', '选择绘图目录');
    const configured = await settings.set({ key: WORKSPACE_KEY, directory: selected.value });
    if (!configured.ok) return { ok: false, error: sdkError(configured.error, '保存绘图目录') };
    const grant = await permissions.grantDirectory({ permissionKey: WORKSPACE_KEY, directory: selected.value });
    if (!grant.ok) return { ok: false, error: sdkError(grant.error, '授权绘图目录') };
    this.root = grant.value.directory;
    return ok({ permissionKey: WORKSPACE_KEY, directory: this.root, directoryName: this.root.name, status: 'ready' });
  }
  async list(): Promise<Result<DrawingFile[]>> {
    if (!this.root) return ok([]);
    const response = await directories.list(this.root);
    if (!response.ok) return { ok: false, error: sdkError(response.error, '列举绘图文件') };
    return ok(response.value.filter((entry): entry is DirectoryEntry & { kind: 'file'; file: FileReference } => entry.kind === 'file' && !!entry.file && entry.name.toLowerCase().endsWith('.excalidraw')).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => ({ name: entry.name, file: entry.file })));
  }
  async remove(file: DrawingFile): Promise<Result<void>> {
    if (!this.root) return err('VALIDATION_FAILED', '请先选择绘图目录', '删除绘图');
    const response = await directories.remove({ directory: { id: this.root.id, name: this.root.name, kind: 'directory' }, name: file.name });
    return response.ok ? ok(undefined) : { ok: false, error: sdkError(response.error, '删除绘图') };
  }
}
