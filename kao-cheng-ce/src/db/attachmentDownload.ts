import { files, storage } from 'treasure-sdk';
import type { FileReference, Result } from 'treasure-sdk';

export interface DownloadableAttachment {
  file_path: string;
  file_name: string;
}

interface DownloadDependencies {
  storage: Pick<typeof storage, 'read'>;
  files: Pick<typeof files, 'saveDialog' | 'writeFile'>;
}

/** Saves a private attachment through one native Save As dialog.
 * The dialog returns a write-only file reference, so downloading never
 * depends on a durable directory grant or a path supplied by the plugin. */
export async function downloadAttachment(
  attachment: DownloadableAttachment,
  dependencies: DownloadDependencies = { storage, files },
): Promise<Result<void>> {
  const content = await dependencies.storage.read(attachment.file_path);
  if (!content.ok) return content;

  const target = await dependencies.files.saveDialog({
    title: '下载附件',
    defaultFileName: attachment.file_name,
  });
  if (!target.ok) return target;

  const saved = await dependencies.files.writeFile({
    file: target.value as FileReference,
    data: content.value,
  });
  if (!saved.ok) return saved;
  return { ok: true, value: undefined };
}
