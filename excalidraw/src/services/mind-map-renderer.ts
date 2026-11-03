import type { MindMapNode } from './mind-map-import-service';
import type { MindMapDocument, MindMapElementData } from '../domain/mind-map';

type NodeBox = { id: string; title: string; x: number; y: number; width: number; height: number; children: NodeBox[] };
type Skeleton = Record<string, unknown>;
export interface MindMapRenderPlan { connectors: Skeleton[]; nodes: Skeleton[]; labels: Skeleton[]; }

const NODE_WIDTH = 276;
const NODE_GAP_X = 164;
const NODE_GAP_Y = 54;
const TEXT_PADDING_X = 28;
const TEXT_LINE_HEIGHT = 25;
const TEXT_MAX_CHARS = 12;

function id(prefix: string): string { return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }

function wrapTitle(title: string, maxChars = TEXT_MAX_CHARS): string {
  // Imported formats often carry paragraph/newline markup in topic titles.
  // Treat it as whitespace before measuring and wrapping; otherwise the text
  // renderer creates extra lines that the node-height calculation never saw.
  const chars = Array.from(title.replace(/\s+/gu, ' ').trim());
  const lines: string[] = [];
  for (let index = 0; index < chars.length; index += maxChars) lines.push(chars.slice(index, index + maxChars).join(''));
  return lines.join('\n') || '未命名主题';
}

function nodeHeight(title: string): number { return Math.max(72, wrapTitle(title).split('\n').length * TEXT_LINE_HEIGHT + 30); }

/** Build a fresh tree: imported-file coordinates are deliberately ignored. */
function layout(root: MindMapNode): NodeBox {
  let nextLeafY = 0;
  const visit = (node: MindMapNode, depth: number): NodeBox => {
    const height = nodeHeight(node.title);
    const children = node.children.map((child) => visit(child, depth + 1));
    const centerY = children.length
      ? (children[0].y + children[0].height / 2 + children[children.length - 1].y + children[children.length - 1].height / 2) / 2
      : nextLeafY + height / 2;
    if (!children.length) nextLeafY += height + NODE_GAP_Y;
    return { id: id('mind-node'), title: node.title, x: depth * (NODE_WIDTH + NODE_GAP_X), y: centerY - height / 2, width: NODE_WIDTH, height, children };
  };
  const tree = visit(root, 0);
  const top = Math.min(...flatten(tree).map((node) => node.y));
  if (top < 0) shiftY(tree, -top);
  return tree;
}

function shiftY(node: NodeBox, amount: number): void { node.y += amount; node.children.forEach((child) => shiftY(child, amount)); }
function flatten(root: NodeBox): NodeBox[] { return [root, ...root.children.flatMap(flatten)]; }

function rectangle(node: NodeBox): Skeleton {
  return {
    type: 'rectangle', id: node.id, x: node.x, y: node.y, width: node.width, height: node.height,
    strokeColor: '#1971c2', backgroundColor: '#e7f5ff', fillStyle: 'solid', strokeWidth: 2,
    roughness: 1, roundness: null,
  };
}

function label(node: NodeBox): Skeleton {
  const text = wrapTitle(node.title, Math.max(4, Math.floor((node.width - TEXT_PADDING_X * 2) / 18)));
  return {
    // Text skeletons use x as their alignment origin. For centered text that
    // origin is the node centre, not its left padding.
    type: 'text', x: node.x + node.width / 2, y: node.y + node.height / 2,
    text, fontSize: 18, strokeColor: '#1864ab', textAlign: 'center', verticalAlign: 'middle',
  };
}

/**
 * Samples a monotonic cubic Bezier. Excalidraw's proportional-roundness is a
 * rounded-polyline algorithm and can loop at tight turns, so the sampled arc
 * is rendered directly without applying that algorithm.
 */
function connector(parent: NodeBox, child: NodeBox): Skeleton {
  const startX = parent.x + parent.width;
  const startY = parent.y + parent.height / 2;
  const endX = child.x;
  const endY = child.y + child.height / 2;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const controlDistance = deltaX * 0.42;
  const points: Array<[number, number]> = [];
  for (let step = 0; step <= 16; step += 1) {
    const t = step / 16;
    const inverse = 1 - t;
    const x = inverse ** 3 * 0 + 3 * inverse ** 2 * t * controlDistance + 3 * inverse * t ** 2 * (deltaX - controlDistance) + t ** 3 * deltaX;
    const y = inverse ** 3 * 0 + 3 * inverse ** 2 * t * 0 + 3 * inverse * t ** 2 * deltaY + t ** 3 * deltaY;
    points.push([x, y]);
  }
  return {
    type: 'arrow', x: startX, y: startY, width: deltaX, height: deltaY,
    points, strokeColor: '#343a40', strokeWidth: 2, roughness: 0, roundness: null,
    startArrowhead: null, endArrowhead: 'arrow',
  };
}

/** Renders ordinary rectangular nodes and curved branches without external art assets. */
export function renderMindMap(root: MindMapNode): MindMapRenderPlan {
  const tree = layout(root);
  const nodeBoxes = flatten(tree);
  return {
    connectors: nodeBoxes.flatMap((node) => node.children.map((child) => connector(node, child))),
    nodes: nodeBoxes.map(rectangle),
    labels: nodeBoxes.map(label),
  };
}

type ManagedBox = NodeBox & { nodeId: string };
function editableLayout(document: MindMapDocument): ManagedBox {
  type MeasuredNode = { nodeId: string; title: string; height: number; children: MeasuredNode[]; subtreeHeight: number };
  const measure = (nodeId: string): MeasuredNode => {
    const node = document.nodes[nodeId]; const children = node.childIds.map(measure); const childrenHeight = children.reduce((sum, child) => sum + child.subtreeHeight, 0) + Math.max(0, children.length - 1) * document.layout.verticalGap;
    return { nodeId, title: node.title, height: nodeHeight(node.title), children, subtreeHeight: Math.max(nodeHeight(node.title), childrenHeight) };
  };
  const place = (measured: MeasuredNode, depth: number, top: number): ManagedBox => {
    const childrenHeight = measured.children.reduce((sum, child) => sum + child.subtreeHeight, 0) + Math.max(0, measured.children.length - 1) * document.layout.verticalGap;
    let cursor = top + (measured.subtreeHeight - childrenHeight) / 2;
    const children = measured.children.map((child) => { const placed = place(child, depth + 1, cursor); cursor += child.subtreeHeight + document.layout.verticalGap; return placed; });
    return { id: `mind-shape-${measured.nodeId}`, nodeId: measured.nodeId, title: measured.title, x: depth * (NODE_WIDTH + document.layout.horizontalGap), y: top + (measured.subtreeHeight - measured.height) / 2, width: NODE_WIDTH, height: measured.height, children };
  };
  const positioned = place(measure(document.rootId), 0, document.layout.originY || 0);
  const shiftX = document.layout.originX || 0;
  const shift = (node: NodeBox): void => { node.x += shiftX; node.children.forEach(shift); };
  shift(positioned);
  return positioned;
}
function metadata(document: MindMapDocument, kind: MindMapElementData['kind'], nodeId?: string, edge?: { parentId: string; childId: string }): Record<string, unknown> {
  const node = nodeId ? document.nodes[nodeId] : undefined;
  return { treasureMindMap: { namespace: 'treasure.mindmap', schema: 1, mindMapId: document.mindMapId, revision: document.revision, document: { rootId: document.rootId, layout: document.layout }, kind, ...(node ? { node } : {}), ...(kind === 'label' ? { nodeId } : {}), ...(edge ? { edge } : {}) } satisfies MindMapElementData };
}
/** Projects a persisted MindMapDocument into locked Excalidraw skeletons. */
export function renderEditableMindMap(document: MindMapDocument): MindMapRenderPlan {
  const tree = editableLayout(document); const boxes = flatten(tree) as ManagedBox[];
  const nodes = boxes.map((node) => ({ ...rectangle(node), id: `${document.mindMapId}:node:${node.nodeId}`, locked: false, customData: metadata(document, 'node', node.nodeId) }));
  const labels = boxes.map((node) => ({ ...label(node), id: `${document.mindMapId}:label:${node.nodeId}`, locked: false, customData: metadata(document, 'label', node.nodeId) }));
  const connectors = boxes.flatMap((node) => node.children.map((child) => ({ ...connector(node, child), id: `${document.mindMapId}:edge:${node.nodeId}:${(child as ManagedBox).nodeId}`, locked: false, customData: metadata(document, 'edge', undefined, { parentId: node.nodeId, childId: (child as ManagedBox).nodeId }) })));
  return { connectors, nodes, labels };
}
