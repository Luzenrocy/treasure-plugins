import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  openDialog: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(),
  list: vi.fn(), create: vi.fn(), remove: vi.fn(), get: vi.fn(), set: vi.fn(), verifyDirectoryGrant: vi.fn(), grantDirectory: vi.fn(), revokeDirectory: vi.fn(),
}));
vi.mock('treasure-sdk', () => ({
  files: { openDialog: sdk.openDialog, readFile: sdk.readFile, writeFile: sdk.writeFile },
  directories: { list: sdk.list, create: sdk.create, remove: sdk.remove },
  settings: { get: sdk.get, set: sdk.set },
  permissions: { verifyDirectoryGrant: sdk.verifyDirectoryGrant, grantDirectory: sdk.grantDirectory, revokeDirectory: sdk.revokeDirectory },
}));

import { Workspace } from './workspace';

describe('Workspace', () => {
  beforeEach(() => {
    Object.values(sdk).forEach(mock => mock.mockReset());
    sdk.get.mockResolvedValue({ ok: true, value: { key: 'storage_dir', paramType: 'dir', accessGrantId: 'grant-1', pathHash: 'hash', directoryName: '笔记' } });
  });

  it('persists only a directory reference after user selection', async () => {
    const selected = { id: 'temporary-grant', name: '笔记', kind: 'directory' as const };
    const root = { id: 'persistent-grant', name: '笔记', kind: 'directory' as const };
    sdk.openDialog.mockResolvedValue({ ok: true, value: selected });
    sdk.set.mockResolvedValue({ ok: true, value: undefined });
    sdk.grantDirectory.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockResolvedValue({ ok: true, value: [] });
    const workspace = new Workspace();
    await expect(workspace.choose()).resolves.toBe(true);
    expect(sdk.grantDirectory).toHaveBeenCalledWith({ permissionKey: 'storage_dir', directory: selected });
    expect(sdk.set).toHaveBeenCalledWith({ key: 'storage_dir', directory: selected });
    expect(workspace.getRoot()).toEqual(root);
    expect(JSON.stringify(sdk.grantDirectory.mock.calls)).not.toContain('/Users/');
  });

  it('treats a revoked persisted directory grant as unavailable so the UI can request a new selection', async () => {
    const root = { id: 'revoked-root', name: '笔记', kind: 'directory' as const };
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockResolvedValue({ ok: false, error: { code: 'PERMISSION_DENIED', message: '插件未获授权' } });
    const workspace = new Workspace();
    await expect(workspace.restore()).resolves.toBe(false);
    expect(workspace.getLastError()).toBe('插件未获授权');
  });

  it('refreshes a stale root reference from the persisted authorization before accessing assets', async () => {
    const staleRoot = { id: 'stale-grant', name: '笔记', kind: 'directory' as const };
    const restoredRoot = { id: 'persistent-grant', name: '笔记', kind: 'directory' as const };
    const assets = { id: 'asset-grant', name: '.assets', kind: 'directory' as const };
    sdk.verifyDirectoryGrant
      .mockResolvedValueOnce({ ok: true, value: { accessGrantId: 'grant-1', directory: staleRoot } })
      .mockResolvedValueOnce({ ok: true, value: { accessGrantId: 'grant-1', directory: restoredRoot } });
    sdk.list.mockImplementation((directory: any) => Promise.resolve(
      directory.id === 'stale-grant'
        ? { ok: false, error: { code: 'PERMISSION_DENIED', message: '目录未获得当前插件授权' } }
        : { ok: true, value: [] },
    ));
    sdk.create.mockResolvedValue({ ok: true, value: assets });

    const workspace = new Workspace();
    await expect(workspace.restore()).resolves.toBe(true);
    await expect(workspace.getOrCreateHiddenDirectory('.assets')).resolves.toEqual(assets);
    expect(workspace.getRoot()).toEqual(restoredRoot);
    expect(sdk.create).toHaveBeenCalledWith({ directory: restoredRoot, name: '.assets' });
  });

  it('recovers an expired root reference when upload accesses the hidden asset directory directly', async () => {
    const staleRoot = { id: 'stale-grant', name: '笔记', kind: 'directory' as const };
    const restoredRoot = { id: 'persistent-grant', name: '笔记', kind: 'directory' as const };
    const assets = { id: 'asset-grant', name: '.assets', kind: 'directory' as const };
    let staleReads = 0;
    sdk.verifyDirectoryGrant
      .mockResolvedValueOnce({ ok: true, value: { accessGrantId: 'grant-1', directory: staleRoot } })
      .mockResolvedValueOnce({ ok: true, value: { accessGrantId: 'grant-1', directory: restoredRoot } });
    sdk.list.mockImplementation((directory: any) => Promise.resolve(
      directory.id === 'stale-grant'
        ? (++staleReads === 1
          ? { ok: true, value: [] }
          : { ok: false, error: { code: 'PERMISSION_DENIED', message: '目录未获得当前插件授权' } })
        : { ok: true, value: [] },
    ));
    sdk.create.mockResolvedValue({ ok: true, value: assets });

    const workspace = new Workspace();
    await expect(workspace.restore()).resolves.toBe(true);
    await expect(workspace.getOrCreateHiddenDirectory('.assets')).resolves.toEqual(assets);
    expect(sdk.create).toHaveBeenCalledWith({ directory: restoredRoot, name: '.assets' });
  });

  it('reads a selected child reference and writes by parent reference plus file name', async () => {
    const root = { id: 'root', name: '笔记', kind: 'directory' as const };
    const note = { id: 'note', name: '你好.md', kind: 'file' as const };
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: '你好.md', kind: 'file', file: note }] });
    sdk.readFile.mockResolvedValue({ ok: true, value: new TextEncoder().encode('你好') });
    sdk.writeFile.mockResolvedValue({ ok: true, value: note });
    const workspace = new Workspace();
    await workspace.restore();
    expect(workspace.getRoot()).toEqual(root);
    await expect(workspace.readText('你好.md')).resolves.toBe('你好');
    await expect(workspace.writeText('', '新建.md', '# 新建')).resolves.toBe(true);
    expect(sdk.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: root, fileName: '新建.md' }));
  });

  it('recurses directories, skips hidden entries, and removes file or directory by granted reference', async () => {
    const root = { id: 'root', name: '笔记', kind: 'directory' as const };
    const chapter = { id: 'chapter', name: '章节', kind: 'directory' as const };
    const note = { id: 'note', name: '正文.md', kind: 'file' as const };
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockImplementation((directory: any) => Promise.resolve(directory.id === 'root'
      ? { ok: true, value: [{ name: '.git', kind: 'directory', directory: chapter }, { name: '章节', kind: 'directory', directory: chapter }, { name: '正文.md', kind: 'file', file: note }] }
      : { ok: true, value: [] }));
    sdk.create.mockResolvedValue({ ok: true, value: chapter });
    sdk.remove.mockResolvedValue({ ok: true, value: undefined });
    const workspace = new Workspace();
    await workspace.restore();
    expect(workspace.get('章节')).toBeDefined();
    await expect(workspace.createDirectory('', '新目录')).resolves.toBe(true);
    await expect(workspace.remove('正文.md')).resolves.toBe(true);
    await expect(workspace.remove('章节')).resolves.toBe(true);
    expect(sdk.remove).toHaveBeenCalledWith({ directory: root, name: '正文.md' });
    expect(sdk.remove).toHaveBeenCalledWith({ directory: chapter });
  });

  it('creates a file inside a directory created during the same session', async () => {
    const root = { id: 'root', name: '笔记', kind: 'directory' as const };
    const testDirectory = { id: 'test-dir', name: 'test', kind: 'directory' as const };
    let created = false;
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockImplementation((directory: any) => Promise.resolve(
      directory.id === 'root' && created
        ? { ok: true, value: [{ name: 'test', kind: 'directory', directory: testDirectory }] }
        : { ok: true, value: [] },
    ));
    sdk.create.mockImplementation(async () => { created = true; return { ok: true, value: testDirectory }; });
    sdk.writeFile.mockResolvedValue({ ok: true, value: { id: 'new-file', name: 'note.md', kind: 'file' } });

    const workspace = new Workspace();
    await workspace.restore();
    await expect(workspace.createDirectory('', 'test')).resolves.toBe(true);
    await expect(workspace.writeText('test', 'note.md', '# note')).resolves.toBe(true);
    expect(sdk.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: testDirectory, fileName: 'note.md' }));
  });

  it('finds or creates a hidden asset directory without exposing it in the workspace tree', async () => {
    const root = { id: 'root', name: '笔记', kind: 'directory' as const };
    const assets = { id: 'assets', name: '.assets', kind: 'directory' as const };
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: '.assets', kind: 'directory', directory: assets }] });
    const workspace = new Workspace(); await workspace.restore();
    await expect(workspace.getOrCreateHiddenDirectory('.assets')).resolves.toEqual(assets);
    expect(workspace.get('.assets')).toBeUndefined();
  });

  it('returns false for cancelled, invalid, ungranted and failed operations', async () => {
    sdk.openDialog.mockResolvedValue({ ok: false, error: { code: 'CANCELLED', message: '取消' } });
    const workspace = new Workspace();
    await expect(workspace.choose()).resolves.toBe(false);
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: false, error: { code: 'NOT_FOUND', message: 'none' } });
    await expect(workspace.restore()).resolves.toBe(false);
    await expect(workspace.writeText('', 'x.md', 'x')).resolves.toBe(false);
    await expect(workspace.createDirectory('', 'x')).resolves.toBe(false);
    await expect(workspace.remove('missing.md')).resolves.toBe(false);
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: false, error: { code: 'NOT_FOUND', message: 'none' } });
    await expect(new Workspace().restore()).resolves.toBe(false);
    sdk.openDialog.mockResolvedValue({ ok: true, value: [] });
    await expect(new Workspace().choose()).resolves.toBe(false);
  });

  it('handles read, write, create and remove capability failures as Result errors', async () => {
    const root = { id: 'root', name: '笔记', kind: 'directory' as const };
    const note = { id: 'note', name: '正文.md', kind: 'file' as const };
    sdk.verifyDirectoryGrant.mockResolvedValue({ ok: true, value: { accessGrantId: 'grant-1', directory: root } });
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: '正文.md', kind: 'file', file: note }] });
    const workspace = new Workspace(); await workspace.restore();
    sdk.readFile.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'read' } });
    sdk.writeFile.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'write' } });
    sdk.create.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'create' } });
    sdk.remove.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'remove' } });
    await expect(workspace.readText('正文.md')).resolves.toBeNull();
    await expect(workspace.writeText('', 'x.md', 'x')).resolves.toBe(false);
    expect(workspace.getLastError()).toBe('write');
    await expect(workspace.createDirectory('', 'x')).resolves.toBe(false);
    await expect(workspace.remove('正文.md')).resolves.toBe(false);
  });
});
