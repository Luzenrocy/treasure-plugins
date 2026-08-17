import { describe, expect, it, vi } from 'vitest';
import { downloadAttachment } from './attachmentDownload';

describe('attachment download', () => {
  const attachment = { file_path: 'attachments/report.bin', file_name: '项目报告.pdf' };

  it('uses one native Save As dialog and writes through its writable file reference', async () => {
    const storage = { read: vi.fn().mockResolvedValue({ ok: true, value: new Uint8Array([1, 2, 3]) }) };
    const files = {
      saveDialog: vi.fn().mockResolvedValue({ ok: true, value: { id: 'file-1', name: '项目报告.pdf', kind: 'file' } }),
      writeFile: vi.fn().mockResolvedValue({ ok: true, value: { id: 'file-1', name: '项目报告.pdf', kind: 'file' } }),
    };

    await expect(downloadAttachment(attachment, { storage, files })).resolves.toEqual({ ok: true, value: undefined });
    expect(files.saveDialog).toHaveBeenCalledWith({ title: '下载附件', defaultFileName: '项目报告.pdf' });
    expect(files.writeFile).toHaveBeenCalledWith({ file: { id: 'file-1', name: '项目报告.pdf', kind: 'file' }, data: new Uint8Array([1, 2, 3]) });
  });

  it('does not attempt a write when the user cancels Save As', async () => {
    const storage = { read: vi.fn().mockResolvedValue({ ok: true, value: new Uint8Array([1]) }) };
    const files = {
      saveDialog: vi.fn().mockResolvedValue({ ok: false, error: { code: 'CANCELLED', message: '用户取消保存' } }),
      writeFile: vi.fn(),
    };

    await expect(downloadAttachment(attachment, { storage, files })).resolves.toEqual({ ok: false, error: { code: 'CANCELLED', message: '用户取消保存' } });
    expect(files.writeFile).not.toHaveBeenCalled();
  });
});
