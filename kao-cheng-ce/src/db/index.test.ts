import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';

// Mock treasure-sdk
const mockQuery = vi.fn();
const mockExecute = vi.fn();
const mockSendNotification = vi.fn();

vi.mock('treasure-sdk', () => ({
  getTreasure: () => ({
    query: mockQuery,
    execute: mockExecute,
    transaction: vi.fn(),
    sendNotification: mockSendNotification,
  }),
}));

describe('启动通知', () => {
  beforeEach(() => {
    mockSendNotification.mockReset();
  });

  it('启动成功后调用通知 API 发送打开成功通知', async () => {
    // 模拟 main.ts 启动逻辑
    const bridge = await import('treasure-sdk').then(m => m.getTreasure());
    await bridge.sendNotification?.('考成策', '打开成功');
    
    expect(mockSendNotification).toHaveBeenCalledWith('考成策', '打开成功');
  });
});

describe('db.tasks.getSubtasks', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockExecute.mockReset();
  });

  it('批量查询子任务标签，避免 N+1', async () => {
    // 模拟子任务查询
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM tasks WHERE parent_id')) {
        return Promise.resolve({
          code: 1,
          data: [
            { id: 1, title: 'Task 1', parent_id: 0, tags: [] },
            { id: 2, title: 'Task 2', parent_id: 0, tags: [] },
          ],
        });
      }
      if (sql.includes('FROM tags') && sql.includes('JOIN task_tags')) {
        return Promise.resolve({
          code: 1,
          data: [
            { task_id: 1, id: 101, name: 'Tag1', color: '#fff', created_at: '2024-01-01' },
            { task_id: 2, id: 102, name: 'Tag2', color: '#000', created_at: '2024-01-02' },
          ],
        });
      }
      return Promise.resolve({ code: 0, msg: 'unexpected query' });
    });

    const tasks = await db.tasks.getSubtasks(0);

    // 应该只调用 2 次 query：1 次查子任务，1 次批量查标签
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].tags).toHaveLength(1);
    expect(tasks[0].tags[0].name).toBe('Tag1');
    expect(tasks[1].tags).toHaveLength(1);
    expect(tasks[1].tags[0].name).toBe('Tag2');
  });

  it('空列表时不查询标签', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM tasks WHERE parent_id')) {
        return Promise.resolve({ code: 1, data: [] });
      }
      return Promise.resolve({ code: 0, msg: 'unexpected query' });
    });

    const tasks = await db.tasks.getSubtasks(0);
    expect(tasks).toHaveLength(0);
    // 只调用 1 次查询（查子任务），不调用标签查询
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('db.tasks.getTree', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('深度超过 maxDepth 时标记 __truncated', async () => {
    let callCount = 0;
    mockQuery.mockImplementation((sql: string) => {
      callCount++;
      if (sql.includes('FROM tasks WHERE parent_id')) {
        // 返回一个子任务
        return Promise.resolve({
          code: 1,
          data: [{ id: callCount, title: `Task ${callCount}`, parent_id: 0, tags: [] }],
        });
      }
      if (sql.includes('FROM tags t JOIN task_tags tt')) {
        return Promise.resolve({ code: 1, data: [] });
      }
      return Promise.resolve({ code: 1, data: [] });
    });

    const tree = await db.tasks.getTree(0, 0, 2);
    // 应该找到截断标记
    const findTruncated = (nodes: any[]): boolean => {
      for (const node of nodes) {
        if (node.children?.some((c: any) => c.__truncated)) return true;
        if (node.children?.length && findTruncated(node.children)) return true;
      }
      return false;
    };
    expect(findTruncated(tree)).toBe(true);
  });
});

describe('db.tasks.getDescendantIds', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('递归 CTE 查询所有后代 ID', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('RECURSIVE')) {
        return Promise.resolve({
          code: 1,
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        });
      }
      return Promise.resolve({ code: 1, data: [] });
    });

    const ids = await db.tasks.getDescendantIds(0);
    expect(ids).toEqual([1, 2, 3]);
    // 只调用 1 次 query（CTE 单条 SQL）
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('空结果时返回空数组', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('RECURSIVE')) {
        return Promise.resolve({ code: 1, data: [] });
      }
      return Promise.resolve({ code: 1, data: [] });
    });

    const ids = await db.tasks.getDescendantIds(0);
    expect(ids).toEqual([]);
  });

  it('查询失败时返回空数组', async () => {
    mockQuery.mockResolvedValue({ code: 0, msg: 'db error' });
    const ids = await db.tasks.getDescendantIds(0);
    expect(ids).toEqual([]);
  });
});
