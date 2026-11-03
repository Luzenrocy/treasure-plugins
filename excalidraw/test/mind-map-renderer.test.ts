import { describe, expect, it } from 'vitest';
import { renderMindMap } from '../src/services/mind-map-renderer';

describe('renderMindMap', () => {
  it('uses clean rectangular nodes and sampled monotonic curved arrows', () => {
    const output = renderMindMap({ title: '根主题', children: [{ title: '上级', children: [] }, { title: '下级', children: [] }] });
    const rectangles = output.nodes.filter((element) => element.type === 'rectangle');
    expect(rectangles).toHaveLength(3);
    expect(rectangles[0].x).toBe(0);
    expect(rectangles[1].x).toBeGreaterThan(rectangles[0].x);
    expect(output.connectors).toHaveLength(2);
    expect(output.connectors.every((arrow: any) => arrow.points.length === 17 && arrow.roundness === null)).toBe(true);
    expect(output.connectors.every((arrow: any) => arrow.points.every((point: [number, number], index: number, points: [number, number][]) => index === 0 || point[0] >= points[index - 1][0]))).toBe(true);
    expect(output.labels.every((text: any, index: number) => text.x === rectangles[index].x + rectangles[index].width / 2)).toBe(true);
  });

  it('normalizes imported line breaks before sizing and centering a node label', () => {
    const output = renderMindMap({ title: '原始标题\n包含多个\n换行符', children: [] });
    const rectangle = output.nodes[0] as any;
    const label = output.labels[0] as any;
    expect(label.text.replace(/\n/g, '')).toBe('原始标题 包含多个 换行符');
    expect(label.x).toBe(rectangle.x + rectangle.width / 2);
    expect(label.y).toBe(rectangle.y + rectangle.height / 2);

  });
});
