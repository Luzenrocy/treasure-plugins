import { describe, expect, it, vi } from 'vitest';
import { compensateFailedAttachmentInsert, queueFailedAttachmentRemoval } from './attachmentCompensation';

describe('attachment compensation', () => {
  it('removes the private file when the SQL insert failed', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    await expect(compensateFailedAttachmentInsert('attachments/a.txt', remove)).resolves.toEqual({ ok: true, value: undefined });
    expect(remove).toHaveBeenCalledWith('attachments/a.txt');
  });

  it('does not queue successful file deletion', async () => {
    const enqueue = vi.fn();
    await expect(queueFailedAttachmentRemoval('attachments/a.txt', { ok: true, value: undefined }, enqueue)).resolves.toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('queues failed deletion with the original error', async () => {
    const enqueue = vi.fn().mockResolvedValue(true);
    await expect(queueFailedAttachmentRemoval('attachments/a.txt', { ok: false, error: { code: 'IO_ERROR', message: 'disk full' } }, enqueue)).resolves.toBe(true);
    expect(enqueue).toHaveBeenCalledWith('attachments/a.txt', 'disk full');
  });
});
