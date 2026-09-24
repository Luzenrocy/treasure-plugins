import { files } from 'treasure-sdk';

export interface FileMetadata {
  fileName: string;
  displayPath?: string;
  lineCount: number;
}

export type FileLoadResult =
  | { kind: 'success'; text: string; metadata: FileMetadata }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string; code?: string };

export interface FileApi {
  openDialog: typeof files.openDialog;
  readFile: typeof files.readFile;
}

function safeDisplayPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) return undefined;
  return value;
}

export function decodeUtf8(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  if (text.includes('\u0000')) throw new Error('文本包含 NUL 或明显二进制内容');
  return text;
}

export function metadataFor(file: { name: string; path?: unknown }, text: string): FileMetadata {
  const metadata: FileMetadata = { fileName: file.name, lineCount: text.length ? text.split(/\r?\n/).length : 0 };
  const displayPath = safeDisplayPath(file.path);
  if (displayPath) metadata.displayPath = displayPath;
  return metadata;
}

export async function chooseAndReadFile(api: FileApi = files): Promise<FileLoadResult> {
  const selected = await api.openDialog({ kind: 'file', multiple: false, title: '选择 UTF-8 文本文件' });
  if (!selected.ok) {
    const code = String(selected.error.code ?? '');
    return /CANCEL/i.test(code) ? { kind: 'cancelled' } : { kind: 'error', code, message: selected.error.message };
  }
  if (!Array.isArray(selected.value) || !selected.value[0]) return { kind: 'cancelled' };
  const file = selected.value[0];
  const content = await api.readFile(file);
  if (!content.ok) return { kind: 'error', code: String(content.error.code), message: content.error.message };
  try {
    const text = decodeUtf8(content.value);
    return { kind: 'success', text, metadata: metadataFor(file, text) };
  } catch (error) {
    return { kind: 'error', code: 'TEXT_ENCODING_UNSUPPORTED', message: error instanceof Error ? error.message : '文本编码不支持' };
  }
}
