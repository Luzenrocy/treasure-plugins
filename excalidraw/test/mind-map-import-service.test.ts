import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { MindMapImportService, mindMapToElements, positionMindMapLabels } from '../src/services/mind-map-import-service';

describe('MindMapImportService', () => {
  it('imports simple-mind-map .smm JSON and preserves the hierarchy', async () => {
    const result = await new MindMapImportService().parse('roadmap.smm', new TextEncoder().encode(JSON.stringify({ root: { data: { text: '路线图' }, children: [{ data: { text: '设计' } }, { data: { text: '交付' }, children: [{ data: { text: '验证' } }] }] } })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root.children[1].children[0].title).toBe('验证');
    expect(result.value.elements.filter((element) => element.type === 'rectangle')).toHaveLength(4);
    expect(result.value.elements.filter((element) => element.type === 'arrow')).toHaveLength(3);
  });

  it('imports modern XMind content.json from the ZIP container', async () => {
    const zip = new JSZip(); zip.file('content.json', JSON.stringify([{ rootTopic: { title: '发布', children: { attached: [{ title: '文档' }, { title: '版本' }] } } }]));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const result = await new MindMapImportService().parse('release.xmind', bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root.title).toBe('发布');
    expect(result.value.root.children.map((child) => child.title)).toEqual(['文档', '版本']);
  });

  it('makes editable rectangles linked with arrows at their distinct endpoints', () => {
    const elements = mindMapToElements({ title: 'Root', children: [{ title: 'First', children: [] }, { title: 'Second', children: [] }] });
    const arrows = elements.filter((element) => element.type === 'arrow');
    expect(elements).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'rectangle', label: expect.objectContaining({ text: 'Root' }) })]));
    expect(arrows).toHaveLength(2);
    expect(arrows.map((arrow) => arrow.end?.id)).toEqual(['mind-map-node-1', 'mind-map-node-2']);
    expect(arrows.map((arrow) => arrow.height)).not.toEqual([arrows[0].height, arrows[0].height]);
    expect(arrows.every((arrow) => arrow.width && arrow.start?.x !== undefined && arrow.end?.x !== undefined)).toBe(true);
  });

  it('turns XMind rich-text titles into plain node text', async () => {
    const result = await new MindMapImportService().parse('rich.smm', new TextEncoder().encode(JSON.stringify({ root: { title: '<p>数据 <strong>开发</strong></p>' } })));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.root.title).toBe('数据 开发');
  });

  it('centres generated label text using the final rectangle bounds', () => {
    const elements = positionMindMapLabels([
      { id: 'node', type: 'rectangle', x: 100, y: 200, width: 190, height: 100, boundElements: [{ id: 'label', type: 'text' }] },
      { id: 'label', type: 'text', x: 0, y: 0, width: 72, height: 24, containerId: 'node' },
    ]);
    expect(elements[0].boundElements).toEqual([]);
    expect(elements[1]).toMatchObject({ x: 159, y: 238, containerId: null, textAlign: 'center', verticalAlign: 'middle' });
  });
});
