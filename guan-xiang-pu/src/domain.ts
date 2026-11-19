export type Layout = 'both' | 'right' | 'down';
export type Branch = 'left' | 'right' | 'down';
export type Theme = 'violet' | 'forest' | 'ink' | 'ocean' | 'sunset';

export interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
  collapsed?: boolean;
  collapsedLeft?: boolean;
  collapsedRight?: boolean;
  collapsedDown?: boolean;
  side?: 'left' | 'right';
  note?: string;
  style?: { color?: string; fill?: string };
}

export interface Sheet {
  id: string;
  name: string;
  layout: Layout;
  theme: Theme;
  root: MindNode;
}

export interface Workbook {
  version: 1;
  title: string;
  sheets: Sheet[];
  source?: { format: 'smm' | 'xmind'; name: string };
}

export type SessionMode = 'editable' | 'external';

export const newId = (prefix = 'id') => `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export function newNode(text = '新主题'): MindNode {
  return { id: newId('node'), text, children: [] };
}

export function newSheet(name = '画布 1'): Sheet {
  return { id: newId('sheet'), name, layout: 'both', theme: 'violet', root: newNode('中心主题') };
}

export function newWorkbook(title = '未命名导图'): Workbook {
  return { version: 1, title, sheets: [newSheet()] };
}

export function cloneWorkbook(workbook: Workbook): Workbook {
  // 工作簿是纯 JSON 数据；这也能复制 Vue 会话中的响应式 Proxy。
  return JSON.parse(JSON.stringify(workbook)) as Workbook;
}

export function rootChildSide(sheet: Sheet, child: MindNode, index: number): Branch {
  if (sheet.layout === 'down') return 'down';
  if (sheet.layout === 'right') return 'right';
  return child.side ?? (index < Math.ceil(sheet.root.children.length / 2) ? 'right' : 'left');
}

export function collapseKey(branch: Branch) {
  return branch === 'left' ? 'collapsedLeft' : branch === 'down' ? 'collapsedDown' : 'collapsedRight';
}

export function rootBranchCollapsed(sheet: Sheet, branch: Branch): boolean {
  return !!(sheet.root.collapsed || sheet.root[collapseKey(branch)]);
}

export function nodeCollapsed(sheet: Sheet, node: MindNode): boolean {
  if (node !== sheet.root) return !!node.collapsed;
  return node.children.length > 0 && node.children.every((child, index) => rootBranchCollapsed(sheet, rootChildSide(sheet, child, index)));
}

export function outlineForSheet(sheet: Sheet): { node: MindNode; depth: number }[] {
  const result: { node: MindNode; depth: number }[] = [];
  function visit(node: MindNode, depth: number) {
    result.push({ node, depth });
    if (node.collapsed) return;
    node.children.forEach((child, index) => {
      if (depth === 0 && rootBranchCollapsed(sheet, rootChildSide(sheet, child, index))) return;
      visit(child, depth + 1);
    });
  }
  visit(sheet.root, 0);
  return result;
}

/**
 * 侧栏大纲是导航工具，不是画布内容状态的镜像。
 * 它总能列出完整主题树，并且只接受调用方持有的临时展开集合。
 */
export function navigationOutlineForSheet(sheet: Sheet, collapsedIds: ReadonlySet<string> = new Set()): { node: MindNode; depth: number }[] {
  const result: { node: MindNode; depth: number }[] = [];
  function visit(node: MindNode, depth: number) {
    result.push({ node, depth });
    if (collapsedIds.has(node.id)) return;
    node.children.forEach((child) => visit(child, depth + 1));
  }
  visit(sheet.root, 0);
  return result;
}

export function findNode(root: MindNode, id: string): MindNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
}

export function findParent(root: MindNode, id: string): MindNode | undefined {
  if (root.children.some((child) => child.id === id)) return root;
  for (const child of root.children) {
    const found = findParent(child, id);
    if (found) return found;
  }
}

export function visibleNodes(root: MindNode): MindNode[] {
  const result: MindNode[] = [];
  const visit = (node: MindNode) => {
    result.push(node);
    if (!node.collapsed) node.children.forEach(visit);
  };
  visit(root);
  return result;
}

export function makeEditableCopy(workbook: Workbook): Workbook {
  const copy = cloneWorkbook(workbook);
  delete copy.source;
  copy.title = `${copy.title.replace(/\.(smm|xmind)$/i, '')} 副本`;
  return copy;
}
