import type { MindMapNode } from '../services/mind-map-import-service';

export const MIND_MAP_NAMESPACE = 'treasure.mindmap';
export const MAX_MIND_MAP_NODES = 1_000;
export const MAX_MIND_MAP_TITLE_LENGTH = 500;
export type MindMapNodeRecord = { id: string; parentId: string | null; childIds: string[]; title: string };
export type MindMapDocument = { schema: 1; mindMapId: string; revision: string; rootId: string; nodes: Record<string, MindMapNodeRecord>; layout: { direction: 'right'; horizontalGap: number; verticalGap: number; originX?: number; originY?: number } };
export type MindMapElementData = { namespace: typeof MIND_MAP_NAMESPACE; schema: 1; mindMapId: string; revision: string; document: Pick<MindMapDocument, 'rootId' | 'layout'>; kind: 'node' | 'label' | 'edge'; node?: MindMapNodeRecord; nodeId?: string; edge?: { parentId: string; childId: string } };
type SceneElement = { id: string; type: string; x?: number; y?: number; width?: number; height?: number; points?: readonly (readonly [number, number])[]; text?: string; isDeleted?: boolean; customData?: Record<string, unknown> };
type Box = { id: string; x: number; y: number; width: number; height: number };
export type ManualTopicAdoption = { document: MindMapDocument; consumedElementIds: string[]; addedNodeIds: string[] };

const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const normalizeMindMapTitle = (value: string) => value.replace(/\s+/gu, ' ').trim().slice(0, MAX_MIND_MAP_TITLE_LENGTH);

export function createMindMapDocument(root: MindMapNode): MindMapDocument {
  const nodes: Record<string, MindMapNodeRecord> = {};
  const visit = (input: MindMapNode, parentId: string | null): string => {
    if (Object.keys(nodes).length >= MAX_MIND_MAP_NODES) throw new Error(`思维导图最多支持 ${MAX_MIND_MAP_NODES} 个主题`);
    const nodeId = id('mind-node');
    nodes[nodeId] = { id: nodeId, parentId, childIds: [], title: normalizeMindMapTitle(input.title) || '未命名主题' };
    nodes[nodeId].childIds = input.children.map((child) => visit(child, nodeId));
    return nodeId;
  };
  const rootId = visit(root, null);
  return { schema: 1, mindMapId: id('mind-map'), revision: id('revision'), rootId, nodes, layout: { direction: 'right', horizontalGap: 164, verticalGap: 54 } };
}

export function validateMindMap(document: MindMapDocument): void {
  const values = Object.values(document.nodes);
  if (!document.nodes[document.rootId] || document.nodes[document.rootId].parentId !== null) throw new Error('思维导图根节点无效');
  if (!values.length || values.length > MAX_MIND_MAP_NODES) throw new Error('思维导图节点数量无效');
  const seen = new Set<string>();
  const walk = (nodeId: string) => { if (seen.has(nodeId)) throw new Error('思维导图存在循环'); seen.add(nodeId); const node = document.nodes[nodeId]; if (!node) throw new Error('思维导图存在缺失节点'); if (!normalizeMindMapTitle(node.title)) throw new Error('主题标题不能为空'); for (const childId of node.childIds) { const child = document.nodes[childId]; if (!child || child.parentId !== nodeId) throw new Error('父子关系不一致'); walk(childId); } };
  walk(document.rootId); if (seen.size !== values.length) throw new Error('思维导图存在孤立节点');
}

function nextRevision(document: MindMapDocument): MindMapDocument { return { ...document, revision: id('revision'), nodes: Object.fromEntries(Object.entries(document.nodes).map(([key, value]) => [key, { ...value, childIds: [...value.childIds] }])) }; }
export function relayoutMindMap(document: MindMapDocument): MindMapDocument { validateMindMap(document); return nextRevision(document); }
export function addChild(document: MindMapDocument, parentId: string, title = '新主题', position?: number): MindMapDocument {
  validateMindMap(document); if (!document.nodes[parentId]) throw new Error('目标主题不存在'); if (Object.keys(document.nodes).length >= MAX_MIND_MAP_NODES) throw new Error(`思维导图最多支持 ${MAX_MIND_MAP_NODES} 个主题`);
  const next = nextRevision(document); const nodeId = id('mind-node'); next.nodes[nodeId] = { id: nodeId, parentId, childIds: [], title: normalizeMindMapTitle(title) || '新主题' };
  const childIds = next.nodes[parentId].childIds; const insertionIndex = position === undefined ? childIds.length : Math.max(0, Math.min(position, childIds.length)); childIds.splice(insertionIndex, 0, nodeId); return next;
}
export function renameNode(document: MindMapDocument, nodeId: string, title: string): MindMapDocument { const normalized = normalizeMindMapTitle(title); if (!normalized) throw new Error('主题标题不能为空'); const next = nextRevision(document); if (!next.nodes[nodeId]) throw new Error('目标主题不存在'); next.nodes[nodeId].title = normalized; return next; }
export function removeSubtree(document: MindMapDocument, nodeId: string): MindMapDocument { if (nodeId === document.rootId) throw new Error('不能删除根主题'); const next = nextRevision(document); const node = next.nodes[nodeId]; if (!node) throw new Error('目标主题不存在'); next.nodes[node.parentId!].childIds = next.nodes[node.parentId!].childIds.filter((id) => id !== nodeId); const remove = (id: string) => { for (const child of next.nodes[id].childIds) remove(child); delete next.nodes[id]; }; remove(nodeId); return next; }
export function reorderNode(document: MindMapDocument, nodeId: string, offset: -1 | 1): MindMapDocument { const next = nextRevision(document); const node = next.nodes[nodeId]; if (!node?.parentId) throw new Error('根主题不能调整顺序'); const siblings = next.nodes[node.parentId].childIds; const index = siblings.indexOf(nodeId); const target = index + offset; if (target < 0 || target >= siblings.length) throw new Error('已到达同级主题边界'); [siblings[index], siblings[target]] = [siblings[target], siblings[index]]; return next; }
export function mindMapData(element: { customData?: Record<string, unknown> }): MindMapElementData | null { const data = element.customData?.treasureMindMap as MindMapElementData | undefined; return data?.namespace === MIND_MAP_NAMESPACE && data.schema === 1 ? data : null; }
export function restoreMindMapDocument(elements: readonly { type: string; isDeleted?: boolean; customData?: Record<string, unknown> }[]): MindMapDocument | null {
  const entries = elements.map((element) => ({ data: mindMapData(element), deleted: !!element.isDeleted })).filter((entry): entry is { data: MindMapElementData; deleted: boolean } => !!entry.data);
  const first = entries.find((entry) => !entry.deleted && entry.data.kind === 'node' && !!entry.data.node)?.data; if (!first) return null;
  // Scene history may retain deleted elements from an older revision. They
  // must not invalidate the active revision, while deletions from the active
  // revision still carry semantic meaning below.
  const group = entries.filter((entry) => entry.data.mindMapId === first.mindMapId && entry.data.revision === first.revision && entry.data.document.rootId === first.document.rootId);
  const deletedNodeIds = new Set(group.filter((entry) => entry.deleted).map((entry) => entry.data.node?.id || entry.data.nodeId || entry.data.edge?.childId).filter((id): id is string => !!id));
  const nodeData = group.filter((entry) => !entry.deleted && entry.data.kind === 'node' && !!entry.data.node).map((entry) => entry.data);
  const rawNodes = Object.fromEntries(nodeData.map((data) => [data.node!.id, data.node!])) as Record<string, MindMapNodeRecord>;
  const nodes: Record<string, MindMapNodeRecord> = {};
  const visit = (nodeId: string): void => {
    if (deletedNodeIds.has(nodeId) || nodes[nodeId]) return;
    const node = rawNodes[nodeId]; if (!node) return;
    const childIds = node.childIds.filter((childId) => !deletedNodeIds.has(childId) && !!rawNodes[childId]);
    nodes[nodeId] = { ...node, childIds };
    childIds.forEach(visit);
  };
  visit(first.document.rootId);
  const document: MindMapDocument = { schema: 1, mindMapId: first.mindMapId, revision: first.revision, rootId: first.document.rootId, layout: first.document.layout, nodes };
  // Node records contain the complete tree. Text or arrow metadata can be
  // absent after a third-party Excalidraw migration, but entering edit mode
  // will regenerate those visual elements from the intact node records.
  try { validateMindMap(document); return document; } catch { return null; }
}

function distanceToBox(x: number, y: number, box: Box): number {
  const dx = Math.max(box.x - x, 0, x - (box.x + box.width)); const dy = Math.max(box.y - y, 0, y - (box.y + box.height)); return Math.hypot(dx, dy);
}
function nearestBox(x: number, y: number, boxes: readonly Box[]): Box | null {
  const ranked = boxes.map((box) => ({ box, distance: distanceToBox(x, y, box) })).sort((left, right) => left.distance - right.distance)[0]; return ranked && ranked.distance <= 48 ? ranked.box : null;
}
function isCanonicalElement(element: SceneElement, document: MindMapDocument): boolean {
  const data = mindMapData(element); if (!data || data.mindMapId !== document.mindMapId) return false;
  if (data.kind === 'node' && data.node) return element.id === `${document.mindMapId}:node:${data.node.id}`;
  if (data.kind === 'label' && data.nodeId) return element.id === `${document.mindMapId}:label:${data.nodeId}`;
  if (data.kind === 'edge' && data.edge) return element.id === `${document.mindMapId}:edge:${data.edge.parentId}:${data.edge.childId}`;
  return false;
}
function titleForBox(box: Box, textElements: readonly SceneElement[]): { title: string; id?: string } {
  const candidates = textElements.map((element) => {
    const x = (element.x || 0) + (element.width || 0) / 2; const y = (element.y || 0) + (element.height || 0) / 2;
    return { element, distance: distanceToBox(x, y, box) };
  }).filter((candidate) => candidate.distance <= 6).sort((left, right) => left.distance - right.distance);
  const best = candidates[0]; return best ? { title: normalizeMindMapTitle(best.element.text || '') || '新主题', id: best.element.id } : { title: '新主题' };
}

/**
 * Adopts manually drawn rectangular child topics when an arrow connects an
 * existing managed topic to that rectangle. Unconnected freehand content is
 * deliberately left untouched.
 */
export function adoptConnectedManualTopics(document: MindMapDocument, scene: readonly SceneElement[]): ManualTopicAdoption {
  validateMindMap(document);
  const visible = scene.filter((element) => !element.isDeleted);
  const manualBoxes = visible.filter((element) => element.type === 'rectangle' && !isCanonicalElement(element, document) && typeof element.x === 'number' && typeof element.y === 'number').map((element) => ({ id: element.id, x: element.x!, y: element.y!, width: element.width || 0, height: element.height || 0 }));
  if (!manualBoxes.length) return { document, consumedElementIds: [], addedNodeIds: [] };
  const textElements = visible.filter((element) => element.type === 'text' && !isCanonicalElement(element, document));
  const arrows = visible.filter((element) => element.type === 'arrow' && !isCanonicalElement(element, document) && element.points && element.points.length > 1);
  const nodeByBoxId = new Map<string, string>();
  const canonicalBoxes = visible.filter((element) => element.type === 'rectangle' && isCanonicalElement(element, document)).map((element) => ({ id: element.id, x: element.x || 0, y: element.y || 0, width: element.width || 0, height: element.height || 0 }));
  for (const box of canonicalBoxes) { const data = mindMapData(visible.find((element) => element.id === box.id)!); if (data?.node) nodeByBoxId.set(box.id, data.node.id); }
  let next = document; const consumed = new Set<string>(); const addedNodeIds: string[] = []; const pending = [...arrows];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const arrow = pending[index]; const points = arrow.points!; const start = points[0]; const end = points[points.length - 1];
      const availableBoxes = [...canonicalBoxes, ...manualBoxes];
      const parentBox = nearestBox((arrow.x || 0) + start[0], (arrow.y || 0) + start[1], availableBoxes);
      const childBox = nearestBox((arrow.x || 0) + end[0], (arrow.y || 0) + end[1], manualBoxes);
      const parentId = parentBox && nodeByBoxId.get(parentBox.id);
      if (!parentId || !childBox || nodeByBoxId.has(childBox.id)) continue;
      const title = titleForBox(childBox, textElements);
      const childCenterY = childBox.y + childBox.height / 2;
      const insertionIndex = [...nodeByBoxId.entries()].map(([boxId, nodeId]) => ({ box: availableBoxes.find((box) => box.id === boxId), nodeId })).filter((entry) => entry.box && next.nodes[entry.nodeId]?.parentId === parentId && entry.box!.y + entry.box!.height / 2 < childCenterY).length;
      next = addChild(next, parentId, title.title, insertionIndex); const nodeId = next.nodes[parentId].childIds[insertionIndex];
      nodeByBoxId.set(childBox.id, nodeId); addedNodeIds.push(nodeId); consumed.add(childBox.id); consumed.add(arrow.id); if (title.id) consumed.add(title.id); pending.splice(index, 1); progressed = true;
    }
  }
  return { document: next, consumedElementIds: [...consumed], addedNodeIds };
}
