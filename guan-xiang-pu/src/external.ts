import JSZip from 'jszip';
import { newId, type MindNode, type Sheet, type Workbook } from './domain';
import { FormatError } from './format';

function toText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, '').trim() || '未命名主题';
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return toText(item.text ?? item.title ?? String(item.data ?? ''));
  }
  return '未命名主题';
}

function smmNode(value: unknown): MindNode {
  const item = value as Record<string, unknown>;
  const data = item.data as Record<string, unknown> | undefined;
  const sourceChildren = (item.children ?? item.child ?? data?.children) as unknown;
  const children = Array.isArray(sourceChildren) ? sourceChildren.map(smmNode) : [];
  return { id: newId('node'), text: toText(item.data ?? item.text ?? item.title), children };
}

export function parseSmm(bytes: Uint8Array, name: string): Workbook {
  let source: unknown;
  try { source = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new FormatError('该 .smm 文件不是有效 JSON。'); }
  const root = (source as Record<string, unknown>).root ?? source;
  if (!root || typeof root !== 'object') throw new FormatError('该 .smm 文件未包含主题树。');
  const sheet: Sheet = { id: newId('sheet'), name: name.replace(/\.smm$/i, ''), layout: 'both', theme: 'violet', root: smmNode(root) };
  return { version: 1, title: name, sheets: [sheet], source: { format: 'smm', name } };
}

function xmindTopic(value: unknown): MindNode {
  const topic = value as Record<string, unknown>;
  const attached = (topic.children as Record<string, unknown> | undefined)?.attached;
  const children = Array.isArray(attached) ? attached.map(xmindTopic) : [];
  return { id: newId('node'), text: typeof topic.title === 'string' ? topic.title : '未命名主题', children };
}

export async function parseXmind(bytes: Uint8Array, name: string): Promise<Workbook> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); }
  catch { throw new FormatError('该 .xmind 文件不是有效的 Xmind 压缩包。'); }
  const content = zip.file('content.json');
  if (!content) throw new FormatError('目前只支持含 content.json 的 Xmind 文件。');
  let source: unknown;
  try { source = JSON.parse(await content.async('string')); }
  catch { throw new FormatError('Xmind 的 content.json 无法读取。'); }
  if (!Array.isArray(source) || !source.length) throw new FormatError('Xmind 文件中没有可显示的画布。');
  const sheets: Sheet[] = source.map((item, index) => {
    const sheet = item as Record<string, unknown>;
    return {
      id: newId('sheet'), name: typeof sheet.title === 'string' ? sheet.title : `画布 ${index + 1}`,
      layout: 'both', theme: 'violet', root: xmindTopic(sheet.rootTopic),
    };
  });
  return { version: 1, title: name, sheets, source: { format: 'xmind', name } };
}
