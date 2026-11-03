import { describe, expect, it } from 'vitest';
import { addChild, adoptConnectedManualTopics, createMindMapDocument, removeSubtree, restoreMindMapDocument } from '../../src/domain/mind-map';
import { renderEditableMindMap } from '../../src/services/mind-map-renderer';

describe('editable mind map model', () => {
  it('adds a child through the model and emits recoverable controlled elements', () => {
    const initial = createMindMapDocument({ title: '根', children: [{ title: '已有', children: [] }] });
    const next = addChild(initial, initial.rootId, '新增');
    expect(next.revision).not.toBe(initial.revision);
    expect(next.nodes[next.rootId].childIds).toHaveLength(2);
    const plan = renderEditableMindMap(next);
    const metadata = [...plan.nodes, ...plan.labels, ...plan.connectors].map((element: any) => ({ type: element.type, customData: element.customData }));
    const restored = restoreMindMapDocument(metadata);
    expect(restored?.nodes).toEqual(next.nodes);
    expect(restored?.revision).toBe(next.revision);
    expect(plan.nodes.every((element: any) => !element.locked && element.customData.treasureMindMap.kind === 'node')).toBe(true);
  });

  it('recovers a map from its node records and protects the root from deletion', () => {
    const document = createMindMapDocument({ title: '根', children: [] });
    const plan = renderEditableMindMap(document);
    expect(restoreMindMapDocument(plan.nodes as any)?.nodes).toEqual(document.nodes);
    expect(() => removeSubtree(document, document.rootId)).toThrow('不能删除根主题');
  });

  it('adopts a manually drawn rectangle only when an arrow connects it to a managed topic', () => {
    const document = createMindMapDocument({ title: '根', children: [] });
    const plan = renderEditableMindMap(document);
    const root = plan.nodes[0] as any;
    const adopted = adoptConnectedManualTopics(document, [
      root,
      { id: 'manual-node', type: 'rectangle', x: 440, y: 0, width: 276, height: 72 },
      { id: 'manual-label', type: 'text', x: 530, y: 26, width: 90, height: 20, text: '手工子主题' },
      { id: 'manual-arrow', type: 'arrow', x: 276, y: 36, points: [[0, 0], [164, 0]] },
      { id: 'unconnected', type: 'rectangle', x: 900, y: 300, width: 100, height: 50 },
    ] as any);
    const childId = adopted.document.nodes[document.rootId].childIds[0];
    expect(adopted.document.nodes[childId].title).toBe('手工子主题');
    expect(adopted.consumedElementIds).toEqual(expect.arrayContaining(['manual-node', 'manual-label', 'manual-arrow']));
    expect(adopted.consumedElementIds).not.toContain('unconnected');
  });

  it('inserts an adopted topic according to its visual position among siblings', () => {
    const document = createMindMapDocument({ title: '根', children: [{ title: '上方', children: [] }, { title: '下方', children: [] }] });
    const plan = renderEditableMindMap(document);
    const root = plan.nodes.find((element: any) => element.customData.treasureMindMap.node.id === document.rootId) as any;
    const adopted = adoptConnectedManualTopics(document, [
      ...plan.nodes,
      { id: 'middle-node', type: 'rectangle', x: 440, y: 63, width: 276, height: 72 },
      { id: 'middle-label', type: 'text', x: 530, y: 88, width: 90, height: 20, text: '中间主题' },
      { id: 'middle-arrow', type: 'arrow', x: root.x + root.width, y: root.y + root.height / 2, points: [[0, 0], [164, 0]] },
    ] as any);
    expect(adopted.document.nodes[document.rootId].childIds.map((id) => adopted.document.nodes[id].title)).toEqual(['上方', '中间主题', '下方']);
  });

  it('does not restore a child whose topic element or incoming arrow was deleted', () => {
    const document = createMindMapDocument({ title: '根', children: [{ title: '待删除', children: [] }] });
    const plan = renderEditableMindMap(document);
    const childId = document.nodes[document.rootId].childIds[0];
    const deletedNode = plan.nodes.map((element: any) => element.customData.treasureMindMap.node.id === childId ? { ...element, isDeleted: true } : element);
    expect(restoreMindMapDocument(deletedNode as any)?.nodes[document.rootId].childIds).toEqual([]);
    const deletedArrow = plan.connectors.map((element: any) => element.customData.treasureMindMap.edge.childId === childId ? { ...element, isDeleted: true } : element);
    expect(restoreMindMapDocument([...plan.nodes, ...deletedArrow] as any)?.nodes[document.rootId].childIds).toEqual([]);
  });
});
