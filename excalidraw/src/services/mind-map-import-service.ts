import JSZip from 'jszip';
import { err, ok, type Result } from '../domain/errors';
import { guardBytes } from './size-guard';

type UnknownRecord = Record<string, unknown>;

export interface MindMapNode {
  title: string;
  children: MindMapNode[];
}

export interface MindMapElementSkeleton {
  type: 'rectangle' | 'arrow';
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  fillStyle?: 'solid';
  strokeColor?: string;
  roundness?: { type: 3 };
  label?: { text: string; textAlign: 'center'; verticalAlign: 'middle'; fontSize: number };
  start?: { id: string };
  end?: { id: string };
  endArrowhead?: 'arrow';
}

export interface ImportedMindMap {
  root: MindMapNode;
  elements: MindMapElementSkeleton[];
}

type ConvertedMindMapElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  containerId?: string | null;
  boundElements?: readonly { id: string; type: string }[] | null;
  [key: string]: unknown;
};

const MAX_NODES = 1_000;
const MAX_TITLE_LENGTH = 500;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function titleOf(value: UnknownRecord): string {
  const data = record(value.data);
  const candidate = data?.text ?? data?.title ?? value.title ?? value.text ?? value.label ?? value.name ?? value.content;
  if (typeof candidate !== 'string') return '未命名主题';
  // XMind can retain topic titles as a small HTML fragment (`<p>…</p>`).
  // Excalidraw text is plain text, so keep its readable content instead of
  // rendering the markup literally inside a node.
  const title = candidate.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&(nbsp|#160);/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
  return (title || '未命名主题').slice(0, MAX_TITLE_LENGTH);
}

function valuesAsArrays(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const object = record(value);
  return object ? Object.values(object).flatMap(valuesAsArrays) : [];
}

function childrenOf(value: UnknownRecord): unknown[] {
  const data = record(value.data);
  const children = valuesAsArrays(value.children);
  return children.length ? children : valuesAsArrays(data?.children);
}

function normaliseNode(value: unknown, state: { count: number }): MindMapNode | null {
  const node = record(value);
  if (!node) return null;
  state.count += 1;
  if (state.count > MAX_NODES) throw new Error(`思维导图超过 ${MAX_NODES} 个主题，暂不导入`);
  return { title: titleOf(node), children: childrenOf(node).map((child) => normaliseNode(child, state)).filter((child): child is MindMapNode => !!child) };
}

function rootFromJson(value: unknown): MindMapNode {
  const root = record(value);
  if (!root && !Array.isArray(value)) throw new Error('文件不包含可识别的思维导图数据');
  const sheets = Array.isArray(value) ? value : Array.isArray(root?.sheets) ? root.sheets : null;
  const candidate = sheets ? record(sheets[0])?.rootTopic : root?.root ?? root?.rootTopic ?? root?.data ?? root;
  const node = normaliseNode(candidate, { count: 0 });
  if (!node) throw new Error('文件不包含可识别的根主题');
  return node;
}

function childElements(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter((child) => child.localName === tag);
}

function rootFromLegacyXmindXml(xml: string): MindMapNode {
  if (typeof DOMParser === 'undefined') throw new Error('当前环境无法解析旧版 XMind 文件');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('旧版 XMind XML 格式无效');
  const topic = Array.from(document.getElementsByTagName('*')).find((element) => element.localName === 'sheet')?.children;
  const rootTopic = topic ? Array.from(topic).find((element) => element.localName === 'topic') : null;
  if (!rootTopic) throw new Error('旧版 XMind 文件不包含根主题');
  const readTopic = (element: Element, state: { count: number }): MindMapNode => {
    state.count += 1;
    if (state.count > MAX_NODES) throw new Error(`思维导图超过 ${MAX_NODES} 个主题，暂不导入`);
    const title = childElements(element, 'title')[0]?.textContent?.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH) || '未命名主题';
    const childrenContainer = childElements(element, 'children')[0];
    const children = childrenContainer ? childElements(childrenContainer, 'topics').flatMap((topics) => childElements(topics, 'topic')).map((child) => readTopic(child, state)) : [];
    return { title, children };
  };
  return readTopic(rootTopic, { count: 0 });
}

/** Turns hierarchy into editable Excalidraw node and arrow skeletons. */
export function mindMapToElements(root: MindMapNode): MindMapElementSkeleton[] {
  const nodes: MindMapElementSkeleton[] = [];
  const edges: Array<[string, string]> = [];
  let leaf = 0; let sequence = 0;
  const visit = (node: MindMapNode, depth: number, parent?: MindMapElementSkeleton): { element: MindMapElementSkeleton; y: number } => {
    const id = `mind-map-node-${sequence++}`;
    const element: MindMapElementSkeleton = { type: 'rectangle', id, x: depth * 260, y: 0, width: 190, height: 56, backgroundColor: depth === 0 ? '#a5d8ff' : '#e7f5ff', fillStyle: 'solid', strokeColor: '#1971c2', roundness: { type: 3 }, label: { text: node.title, textAlign: 'center', verticalAlign: 'middle', fontSize: depth === 0 ? 20 : 18 } };
    nodes.push(element);
    if (parent) edges.push([parent.id, id]);
    const childPositions = node.children.map((child) => visit(child, depth + 1, element));
    const y = childPositions.length ? (childPositions[0].y + childPositions[childPositions.length - 1].y) / 2 : leaf++ * 108;
    element.y = y;
    return { element, y };
  };
  visit(root, 0);
  const byId = new Map(nodes.map((element) => [element.id, element]));
  const arrows = edges.map(([parentId, childId], index) => {
    const parent = byId.get(parentId)!;
    const child = byId.get(childId)!;
    const startX = parent.x + (parent.width || 0);
    const startY = parent.y + (parent.height || 0) / 2;
    const endX = child.x;
    const endY = child.y + (child.height || 0) / 2;
    // The Skeleton API uses the arrow's geometry to resolve binding targets.
    // Supplying only IDs leaves every arrow at the parent's point, causing all
    // of them to resolve to the nearest child and overlap one another.
    return { type: 'arrow' as const, id: `mind-map-arrow-${index}`, x: startX, y: startY, width: endX - startX, height: endY - startY, start: { id: parentId, x: startX, y: startY }, end: { id: childId, x: endX, y: endY }, endArrowhead: 'arrow' as const };
  });
  return [...nodes, ...arrows];
}

/**
 * Excalidraw 0.18 can calculate a labelled rectangle's text position before
 * it expands the rectangle for its label. Detach those generated labels after
 * conversion and place them from the final rectangle dimensions instead.
 */
export function positionMindMapLabels<T extends ConvertedMindMapElement>(elements: readonly T[]): T[] {
  const containers = new Map(elements.filter((element) => element.type === 'rectangle').map((element) => [element.id, element]));
  const labelIds = new Set(elements.filter((element) => element.type === 'text' && element.containerId && containers.has(element.containerId)).map((element) => element.id));
  return elements.map((element) => {
    if (element.type === 'text' && element.containerId) {
      const container = containers.get(element.containerId);
      if (container) return { ...element, x: container.x + (container.width - element.width) / 2, y: container.y + (container.height - element.height) / 2, containerId: null, textAlign: 'center', verticalAlign: 'middle' } as T;
    }
    if (element.type === 'rectangle' && element.boundElements) return { ...element, boundElements: element.boundElements.filter((bound) => !labelIds.has(bound.id)) } as T;
    return element;
  });
}

export class MindMapImportService {
  async parse(fileName: string, bytes: Uint8Array): Promise<Result<ImportedMindMap>> {
    const guard = guardBytes(bytes, '读取思维导图'); if (!guard.ok) return guard as Result<ImportedMindMap>;
    const extension = fileName.split('.').pop()?.toLowerCase();
    try {
      let root: MindMapNode;
      if (extension === 'xmind') root = await this.parseXmind(bytes);
      else if (extension === 'smm' || extension === 'json') root = rootFromJson(JSON.parse(new TextDecoder().decode(bytes)));
      else return err('VALIDATION_FAILED', '仅支持 .xmind、.smm 和 JSON 思维导图文件', '解析思维导图');
      return ok({ root, elements: mindMapToElements(root) });
    } catch (cause) {
      return err('VALIDATION_FAILED', cause instanceof Error ? cause.message : '思维导图格式无效', '解析思维导图', cause);
    }
  }

  private async parseXmind(bytes: Uint8Array): Promise<MindMapNode> {
    const zip = await JSZip.loadAsync(bytes);
    const jsonEntry = zip.file('content.json');
    if (jsonEntry) return rootFromJson(JSON.parse(await jsonEntry.async('text')));
    const xmlEntry = zip.file('content.xml');
    if (xmlEntry) return rootFromLegacyXmindXml(await xmlEntry.async('text'));
    throw new Error('XMind 文件中找不到 content.json 或 content.xml');
  }
}
