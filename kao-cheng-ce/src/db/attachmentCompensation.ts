import type { Result } from 'treasure-sdk';

type Remove = (key: string) => Promise<Result<void>>;
type Enqueue = (key: string, reason: string) => Promise<boolean>;

/** Compensates the file-first attachment workflow without leaking storage implementation details. */
export async function compensateFailedAttachmentInsert(storageKey: string, remove: Remove): Promise<Result<void>> {
  return remove(storageKey);
}

/** Records a retryable cleanup item only when the post-SQL private-file removal failed. */
export async function queueFailedAttachmentRemoval(storageKey: string, removal: Result<void>, enqueue: Enqueue): Promise<boolean> {
  if (removal.ok) return false;
  return enqueue(storageKey, removal.error.message);
}
