import { describe, expect, it, vi } from 'vitest';

const { openDialog, readFile, writeFile } = vi.hoisted(() => ({
  openDialog: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(),
}));
vi.mock('treasure-sdk', () => ({ files: { openDialog, readFile, writeFile } }));

import App from './App.vue';

function model() {
  return { output: '', selectedFile: null as any, bytes: new Uint8Array() };
}

describe('SDK 2.0 template example', () => {
  it('initializes an empty reference-based view model', () => {
    expect((App as any).data()).toMatchObject({ output: '', selectedFile: null, bytes: new Uint8Array() });
  });

  it('reads a selected file through references and reports cancellation', async () => {
    const vm = model();
    openDialog.mockResolvedValueOnce({ ok: false, error: { code: 'CANCELLED', message: '取消' } });
    await (App as any).methods.chooseFile.call(vm);
    expect(vm.output).toBe('CANCELLED: 取消');

    openDialog.mockResolvedValueOnce({ ok: true, value: [{ id: 'file-1', name: '报告.txt', kind: 'file' }] });
    readFile.mockResolvedValueOnce({ ok: true, value: new Uint8Array([1, 2]) });
    await (App as any).methods.chooseFile.call(vm);
    expect(vm.selectedFile).toMatchObject({ id: 'file-1' });
    expect(vm.output).toContain('2 字节');
  });

  it('writes only to a selected directory reference', async () => {
    const vm = { ...model(), selectedFile: { id: 'file-1', name: '报告.txt', kind: 'file' }, bytes: new Uint8Array([1]) };
    openDialog.mockResolvedValueOnce({ ok: true, value: { id: 'dir-1', name: '导出', kind: 'directory' } });
    writeFile.mockResolvedValueOnce({ ok: true, value: { id: 'file-2', name: '报告.txt', kind: 'file' } });
    await (App as any).methods.chooseOutputDirectory.call(vm);
    expect(writeFile).toHaveBeenCalledWith({ directory: { id: 'dir-1', name: '导出', kind: 'directory' }, fileName: '报告.txt', data: vm.bytes });
    expect(vm.output).toBe('已导出 报告.txt');
  });

  it('surfaces invalid selection and read/write failures as Result messages', async () => {
    const vm = model();
    openDialog.mockResolvedValueOnce({ ok: true, value: { id: 'dir', name: '错误', kind: 'directory' } });
    await (App as any).methods.chooseFile.call(vm);
    expect(vm.output).toBe('选择结果无效');

    openDialog.mockResolvedValueOnce({ ok: true, value: [] });
    await (App as any).methods.chooseFile.call(vm);
    expect(vm.output).toBe('没有选择文件');

    openDialog.mockResolvedValueOnce({ ok: true, value: [{ id: 'file-1', name: '失败.txt', kind: 'file' }] });
    readFile.mockResolvedValueOnce({ ok: false, error: { code: 'IO_ERROR', message: '读取失败' } });
    await (App as any).methods.chooseFile.call(vm);
    expect(vm.output).toBe('IO_ERROR: 读取失败');

    const exportVm = { ...model(), selectedFile: { id: 'file-1', name: '失败.txt', kind: 'file' }, bytes: new Uint8Array([1]) };
    openDialog.mockResolvedValueOnce({ ok: true, value: [] });
    await (App as any).methods.chooseOutputDirectory.call(exportVm);
    expect(exportVm.output).toBe('选择结果无效');

    openDialog.mockResolvedValueOnce({ ok: false, error: { code: 'CANCELLED', message: '取消' } });
    await (App as any).methods.chooseOutputDirectory.call(exportVm);
    expect(exportVm.output).toBe('CANCELLED: 取消');

    openDialog.mockResolvedValueOnce({ ok: true, value: { id: 'dir-1', name: '导出', kind: 'directory' } });
    writeFile.mockResolvedValueOnce({ ok: false, error: { code: 'IO_ERROR', message: '写入失败' } });
    await (App as any).methods.chooseOutputDirectory.call(exportVm);
    expect(exportVm.output).toBe('IO_ERROR: 写入失败');
  });
});
