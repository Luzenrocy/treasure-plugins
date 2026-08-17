import { describe, expect, it } from 'vitest';
import { resolveContextPath } from './contextMenu';

describe('resolveContextPath', () => {
  it('uses the workspace root path for the sidebar root context menu', () => {
    expect(resolveContextPath(null)).toBe('');
  });

  it('preserves the workspace-relative path for a directory node', () => {
    expect(resolveContextPath({ path: '章节/第一章', isDirectory: true })).toBe('章节/第一章');
  });

  it('maps a file node to its containing directory for create actions', () => {
    expect(resolveContextPath({ path: '章节/第一章/笔记.md', isDirectory: false })).toBe('章节/第一章');
    expect(resolveContextPath({ path: '笔记.md', isDirectory: false })).toBe('');
  });
});
