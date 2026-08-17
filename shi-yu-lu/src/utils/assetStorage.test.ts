import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ list: vi.fn(), writeFile: vi.fn(), readFile: vi.fn(), remove: vi.fn(), writeLog: vi.fn() }));
const workspaceMock = vi.hoisted(() => ({ getOrCreateHiddenDirectory: vi.fn(), getLastError: vi.fn() }));
vi.mock('treasure-sdk', () => ({ directories: { list: sdk.list, remove: sdk.remove }, files: { writeFile: sdk.writeFile, readFile: sdk.readFile }, logs: { write: sdk.writeLog } }));
vi.mock('./workspace', () => ({ workspace: workspaceMock }));

import { clearAssetPreviewCache, normalizeAssetUrl, readAssetAsObjectUrl, saveAssetForMarkdown, writeAssetMetadata } from './assetStorage';

describe('workspace asset storage', () => {
  beforeEach(() => { clearAssetPreviewCache(); Object.values(sdk).forEach(mock => mock.mockReset()); Object.values(workspaceMock).forEach(mock => mock.mockReset()); sdk.writeLog.mockResolvedValue({ ok: true, value: undefined }); });

  it('writes images and the index into the same hidden .assets directory', async () => {
    const assets = { id: 'assets-grant', name: '.assets', kind: 'directory' as const };
    workspaceMock.getOrCreateHiddenDirectory.mockResolvedValue(assets);
    sdk.list.mockResolvedValue({ ok: true, value: [] });
    sdk.writeFile.mockResolvedValue({ ok: true, value: { id: 'asset-file', name: 'note__image_1234.png', kind: 'file' } });
    const file = new File([new Uint8Array([1, 2, 3])], 'image.png', { type: 'image/png' });
    await saveAssetForMarkdown('', 'note.md', file);
    await writeAssetMetadata('.asset-index.json', new TextEncoder().encode('{"version":1,"map":{}}'));
    expect(sdk.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: assets, fileName: expect.stringMatching(/^note__image_[a-f0-9]{8}\.png$/) }));
    expect(sdk.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: assets, fileName: '.asset-index.json' }));
  });

  it('overwrites an existing asset index through its authorized directory instead of a read-only listed file reference', async () => {
    const assets = { id: 'assets-grant', name: '.assets', kind: 'directory' as const };
    const indexFile = { id: 'read-only-index-ref', name: '.asset-index.json', kind: 'file' as const };
    workspaceMock.getOrCreateHiddenDirectory.mockResolvedValue(assets);
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: '.asset-index.json', kind: 'file', file: indexFile }] });
    sdk.writeFile.mockResolvedValue({ ok: true, value: indexFile });

    await writeAssetMetadata('.asset-index.json', new TextEncoder().encode('{"version":1,"map":{}}'));

    expect(sdk.writeFile).toHaveBeenCalledWith({
      directory: assets,
      fileName: '.asset-index.json',
      data: expect.any(Uint8Array),
    });
  });

  it('creates a self-contained preview data URL with the image MIME type inferred from the asset name', async () => {
    const assets = { id: 'assets-grant', name: '.assets', kind: 'directory' as const };
    const image = { id: 'image-ref', name: 'note__photo.png', kind: 'file' as const };
    const createObjectURL = vi.fn(() => 'blob:asset-preview');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    workspaceMock.getOrCreateHiddenDirectory.mockResolvedValue(assets);
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: image.name, kind: 'file', file: image }] });
    sdk.readFile.mockResolvedValue({ ok: true, value: new Uint8Array([137, 80, 78, 71]) });

    await expect(readAssetAsObjectUrl('', '', '@assets/note__photo.png')).resolves.toBe('data:image/png;base64,iVBORw==');
    expect(createObjectURL).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('decodes Cherry-encoded Unicode asset URLs before locating the physical file', async () => {
    const assets = { id: 'assets-grant', name: '.assets', kind: 'directory' as const };
    const image = { id: 'image-ref', name: 't__sql执行顺序_deca6cba.png', kind: 'file' as const };
    workspaceMock.getOrCreateHiddenDirectory.mockResolvedValue(assets);
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: image.name, kind: 'file', file: image }] });
    sdk.readFile.mockResolvedValue({ ok: true, value: new Uint8Array([137, 80, 78, 71]) });

    expect(normalizeAssetUrl('@assets/t__sql%E6%89%A7%E8%A1%8C%E9%A1%BA%E5%BA%8F_deca6cba.png')).toBe(image.name);
    await expect(readAssetAsObjectUrl('', '', '@assets/t__sql%E6%89%A7%E8%A1%8C%E9%A1%BA%E5%BA%8F_deca6cba.png')).resolves.toBe('data:image/png;base64,iVBORw==');
    expect(sdk.readFile).toHaveBeenCalledWith(image);
  });

  it('reuses a Data URL during one document session and clears it when the document changes', async () => {
    const assets = { id: 'assets-grant', name: '.assets', kind: 'directory' as const };
    const image = { id: 'image-ref', name: 'cache.png', kind: 'file' as const };
    workspaceMock.getOrCreateHiddenDirectory.mockResolvedValue(assets);
    sdk.list.mockResolvedValue({ ok: true, value: [{ name: image.name, kind: 'file', file: image }] });
    sdk.readFile.mockResolvedValue({ ok: true, value: new Uint8Array([137, 80, 78, 71]) });

    await readAssetAsObjectUrl('', '', '@assets/cache.png');
    await readAssetAsObjectUrl('', '', '@assets/cache.png');
    expect(sdk.list).toHaveBeenCalledTimes(1);
    clearAssetPreviewCache();
    await readAssetAsObjectUrl('', '', '@assets/cache.png');
    expect(sdk.list).toHaveBeenCalledTimes(2);
  });
});
