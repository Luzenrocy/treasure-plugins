export const kinds = ['api-key', 'secret-key', 'token', 'password', 'prompt', 'text'] as const;
export type EntryKind = typeof kinds[number];

export interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  value: string;
  account: string;
  tags: string[];
  notes: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export function validateEntry(input: unknown): Entry {
  if (!input || typeof input !== 'object') throw new Error('条目格式无效');
  const entry = input as Partial<Entry>;
  if (!entry.id || typeof entry.id !== 'string' || !kinds.includes(entry.kind as EntryKind)) throw new Error('条目类型无效');
  if (typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 90) throw new Error('标题无效');
  if (typeof entry.value !== 'string' || !entry.value.trim()) throw new Error('内容不能为空');
  const multiline = entry.kind === 'prompt' || entry.kind === 'text';
  if (entry.value.length > (multiline ? 12_000 : 5_000) || (!multiline && /[\r\n]/.test(entry.value))) throw new Error('内容格式无效');
  if (typeof entry.account !== 'string' || entry.account.length > 250 || (entry.kind !== 'password' && entry.account !== '')) throw new Error('账号无效');
  if (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string') || entry.tags.join('，').length > 170) throw new Error('标签无效');
  if (typeof entry.notes !== 'string' || entry.notes.length > 1000 || typeof entry.favorite !== 'boolean') throw new Error('条目字段无效');
  if (!Number.isSafeInteger(entry.createdAt) || !Number.isSafeInteger(entry.updatedAt)) throw new Error('条目时间无效');
  if (new TextEncoder().encode(JSON.stringify(entry)).byteLength > 48 * 1024) throw new Error('条目超过容量限制');
  return entry as Entry;
}
