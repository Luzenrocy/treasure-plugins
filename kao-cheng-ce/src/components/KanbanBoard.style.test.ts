import { describe, expect, it } from 'vitest';
import source from './KanbanBoard.vue?raw';

describe('KanbanBoard scrollbar styling', () => {
  it('uses the Shi Yu Lu horizontal scrollbar visual language', () => {
    expect(source).toContain('.kanban-board::-webkit-scrollbar');
    expect(source).toContain('height: 7px');
    expect(source).toContain('.kanban-board::-webkit-scrollbar-track');
    expect(source).toContain('background: transparent');
    expect(source).toContain('.kanban-board::-webkit-scrollbar-thumb');
    expect(source).toContain('background-color: #d3d7da');
    expect(source).toContain('border-radius: 4px');
    expect(source).toContain('.kanban-board::-webkit-scrollbar-thumb:hover');
  });
});
