import type { MindNode, Workbook } from './domain';

const MAX_BYTES = 32 * 1024 * 1024;

export class FormatError extends Error {}

function validNode(value: unknown, depth = 0): value is MindNode {
  if (depth > 200 || !value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  return typeof node.id === 'string'
    && typeof node.text === 'string'
    && Array.isArray(node.children)
    && node.children.every((child) => validNode(child, depth + 1));
}

export function encodeWorkbook(workbook: Workbook): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(workbook, null, 2));
}

export function decodeWorkbook(bytes: Uint8Array): Workbook {
  if (bytes.byteLength > MAX_BYTES) throw new FormatError('文件超过 32 MiB，无法安全打开。');
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new FormatError('不是有效的 .gxp JSON 工作簿。'); }
  const book = value as Partial<Workbook>;
  if (book.version !== 1 || typeof book.title !== 'string' || !Array.isArray(book.sheets) || !book.sheets.length) {
    throw new FormatError('该 .gxp 文件缺少必需的工作簿内容。');
  }
  if (!book.sheets.every((sheet) => sheet && typeof sheet.id === 'string' && typeof sheet.name === 'string'
    && ['both', 'right', 'down'].includes(sheet.layout as string) && validNode(sheet.root))) {
    throw new FormatError('该 .gxp 工作簿的画布结构无效。');
  }
  return book as Workbook;
}

export const GXP_FILTER = { name: '观象谱工作簿', extensions: ['gxp'] };
export const OPEN_FILTERS = [GXP_FILTER, { name: '思绪导图', extensions: ['smm'] }, { name: 'Xmind 导图', extensions: ['xmind'] }];
