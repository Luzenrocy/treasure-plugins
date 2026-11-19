import { rootBranchCollapsed, rootChildSide, type Branch, type MindNode, type Sheet, type Theme } from './domain';

// 显示与导出使用原型的同一套布局和视觉数值。
export const themes = {
  violet: { name: '暖白紫藤', root: '#7656a7', fills: ['#eee7f7', '#e4f0ea', '#f5ecd9', '#f5e6eb'], lines: ['#967ab9', '#70a191', '#c29b61', '#bb8495'] },
  forest: { name: '松间清晨', root: '#486f65', fills: ['#e2eee8', '#e4edf2', '#f1ecd9', '#eae7ef'], lines: ['#779e8e', '#7d9bab', '#b3a169', '#9c8fae'] },
  ink: { name: '简约墨色', root: '#4b4b58', fills: ['#ebeaf0', '#e9e9ed', '#f1eeea', '#eeeaed'], lines: ['#9692a3', '#9293a0', '#aaa197', '#a79ba3'] },
  ocean: { name: '海蓝', root: '#146c94', fills: ['#e4edf6', '#e4f0ea', '#f5ecd9', '#eae7ef'], lines: ['#7b9dbb', '#70a191', '#c29b61', '#9c8fae'] },
  sunset: { name: '落日', root: '#ae5c35', fills: ['#f6e8dd', '#f5ecd9', '#f5e6eb', '#eee7f7'], lines: ['#be9476', '#c29b61', '#bb8495', '#967ab9'] },
} satisfies Record<Theme, { name: string; root: string; fills: string[]; lines: string[] }>;
export const primaryThemes: Theme[] = ['violet', 'forest', 'ink'];
export type MeasureText = (text: string, font: string) => number;
let context: CanvasRenderingContext2D | null | undefined;
const measureText: MeasureText = (text, font) => {
  if (context === undefined) context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (context) { context.font = font; return context.measureText(text).width; }
  const size = Number(font.match(/(\d+)px/)?.[1] ?? 15);
  return Array.from(text).reduce((width, char) => width + size * (char.charCodeAt(0) > 255 ? 1 : .56), 0);
};
export interface PositionedNode {
  node: MindNode; x: number; y: number; width: number; height: number;
  lines: string[]; depth: number; branch: number; side: Branch;
}
export interface Edge { from: PositionedNode; to: PositionedNode }

function wrapText(text: string, maxWidth: number, font: string, measure: MeasureText): string[] {
  return text.split('\n').flatMap((part) => {
    const lines: string[] = [];
    let line = '';
    Array.from(part).forEach((char) => {
      if (line && measure(line + char, font) > maxWidth) { lines.push(line); line = char; }
      else line += char;
    });
    lines.push(line);
    return lines;
  });
}

export function layoutSheet(sheet: Sheet, measure: MeasureText = measureText) {
  const nodes: PositionedNode[] = [], edges: Edge[] = [];
  function make(node: MindNode, depth: number, x: number, y: number, branch: number, parent?: PositionedNode, side: Branch = 'right') {
    const font = (depth === 0 ? '500 19px ' : '500 15px ') + 'Arial,"PingFang SC",sans-serif';
    const lines = wrapText(node.text, depth === 0 ? 174 : 150, font, measure);
    const width = Math.max(depth === 0 ? 140 : depth === 1 ? 120 : 80, Math.min(210, Math.max(...lines.map((line) => measure(line, font))) + 30));
    const height = Math.max(depth === 0 ? 58 : 42, lines.length * (depth === 0 ? 24 : 20) + 22);
    const item: PositionedNode = { node, depth, x, y, branch, side, width, height, lines };
    nodes.push(item);
    if (parent) edges.push({ from: parent, to: item });
    return item;
  }
  const root = make(sheet.root, 0, 0, 0, 0);
  const children = (node: MindNode) => node.collapsed ? [] : node.children;
  function span(node: MindNode, depth: number, down = false): number {
    const own = down ? 180 : Math.max(86, wrapText(node.text, 150, '500 15px Arial,"PingFang SC",sans-serif', measure).length * 20 + 46);
    return Math.max(own, children(node).reduce((sum, child) => sum + span(child, depth + 1, down), 0));
  }
  if (sheet.layout === 'down') {
    const kids = rootBranchCollapsed(sheet, 'down') ? [] : sheet.root.children;
    let cursor = -kids.reduce((sum, child) => sum + span(child, 1, true), 0) / 2;
    function visit(node: MindNode, depth: number, branch: number, parent: PositionedNode): PositionedNode {
      const item = make(node, depth, 0, depth * 145, branch, parent, 'down');
      const kids = children(node);
      if (kids.length) { const positions = kids.map((child) => visit(child, depth + 1, branch, item)); item.x = (positions[0].x + positions[positions.length - 1].x) / 2; }
      else { const space = span(node, depth, true); item.x = cursor + space / 2; cursor += space; }
      return item;
    }
    kids.forEach((child) => visit(child, 1, sheet.root.children.indexOf(child), root));
  } else {
    (['right', 'left'] as const).forEach((side) => {
      const kids = rootBranchCollapsed(sheet, side) ? [] : sheet.root.children.filter((child, index) => rootChildSide(sheet, child, index) === side);
      let cursor = -kids.reduce((sum, child) => sum + span(child, 1), 0) / 2;
      function visit(node: MindNode, depth: number, branch: number, parent: PositionedNode): PositionedNode {
        const item = make(node, depth, (side === 'right' ? 1 : -1) * depth * 235, 0, branch, parent, side);
        const kids = children(node);
        if (kids.length) { const positions = kids.map((child) => visit(child, depth + 1, branch, item)); item.y = (positions[0].y + positions[positions.length - 1].y) / 2; }
        else { const space = span(node, depth); item.y = cursor + space / 2; cursor += space; }
        return item;
      }
      kids.forEach((child) => visit(child, 1, sheet.root.children.indexOf(child), root));
    });
  }
  const minX = Math.min(...nodes.map((item) => item.x - item.width / 2)), maxX = Math.max(...nodes.map((item) => item.x + item.width / 2));
  const minY = Math.min(...nodes.map((item) => item.y - item.height / 2)), maxY = Math.max(...nodes.map((item) => item.y + item.height / 2));
  return { nodes, edges, theme: themes[sheet.theme] ?? themes.violet, bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY } };
}

export function edgePath(edge: Edge, layout: Sheet['layout']): string {
  const a = edge.from, b = edge.to;
  if (layout === 'down') {
    const start = a.y + a.height / 2, end = b.y - b.height / 2, mid = (start + end) / 2;
    return `M ${a.x} ${start} C ${a.x} ${mid} ${b.x} ${mid} ${b.x} ${end}`;
  }
  const direction = b.side === 'left' ? -1 : 1;
  const start = a.x + direction * a.width / 2, end = b.x - direction * b.width / 2, mid = (start + end) / 2;
  return `M ${start} ${a.y} C ${mid} ${a.y} ${mid} ${b.y} ${end} ${b.y}`;
}

export function nodeFill(item: PositionedNode, theme: typeof themes.violet): string {
  return item.node.style?.fill ?? (item.depth === 0 ? theme.root : item.depth > 1 ? 'transparent' : theme.fills[item.branch % 4]);
}
