import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';

// Mock treasure-sdk
const { mockQuery, mockExecute, mockSendNotification, mockStorageWrite, mockStorageRemove } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockExecute: vi.fn(),
  mockSendNotification: vi.fn(),
  mockStorageWrite: vi.fn(),
  mockStorageRemove: vi.fn(),
}));

vi.mock('treasure-sdk', () => ({
  database: {
    query: (statement: { sql: string; tables: string[]; params?: unknown[] }) => mockQuery(statement.sql, statement.tables, statement.params).then((legacy: any) => legacy.code === 1 ? ({ ok: true, value: { rows: legacy.data || [] } }) : ({ ok: false, error: { code: 'IO_ERROR', message: legacy.msg } })),
    execute: (statement: { sql: string; tables: string[]; params?: unknown[] }) => mockExecute(statement.sql, statement.tables, statement.params).then((legacy: any) => legacy.code === 1 ? ({ ok: true, value: { affectedRows: 1, rows: legacy.data } }) : ({ ok: false, error: { code: 'IO_ERROR', message: legacy.msg } })),
    transaction: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  },
  logs: { write: vi.fn().mockResolvedValue({ ok: true, value: undefined }) },
  storage: { read: vi.fn(), write: mockStorageWrite, remove: mockStorageRemove },
  notifications: { send: mockSendNotification },
}));

describe('启动通知', () => {
  beforeEach(() => {
    mockSendNotification.mockReset();
  });

  it('启动成功后调用通知 API 发送打开成功通知', async () => {
    const notifications = await import('treasure-sdk').then(m => m.notifications);
    await notifications.send({ title: '考成策', body: '打开成功' });
    
    expect(mockSendNotification).toHaveBeenCalledWith({ title: '考成策', body: '打开成功' });
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
    expect(tasks[0]!.tags).toHaveLength(1);
    expect(tasks[0]!.tags![0]!.name).toBe('Tag1');
    expect(tasks[1]!.tags).toHaveLength(1);
    expect(tasks[1]!.tags![0]!.name).toBe('Tag2');
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

describe('db.attachments compensation', () => {
  beforeEach(() => {
    mockQuery.mockReset(); mockExecute.mockReset(); mockStorageWrite.mockReset(); mockStorageRemove.mockReset();
  });

  it('removes a private file when the attachment INSERT fails', async () => {
    mockStorageWrite.mockResolvedValue({ ok: true, value: undefined });
    mockStorageRemove.mockResolvedValue({ ok: true, value: undefined });
    mockExecute.mockResolvedValue({ code: 0, msg: 'SQL failed' });
    const source = new File(['content'], '报告.txt', { type: 'text/plain' });
    await expect(db.attachments.create(1, source)).resolves.toBeNull();
    expect(mockStorageRemove).toHaveBeenCalledWith(expect.stringMatching(/^attachments\//));
  });

  it('queues cleanup when SQL deletion succeeds but private file removal fails', async () => {
    mockQuery.mockResolvedValue({ code: 1, data: [{ id: 7, task_id: 1, file_path: 'attachments/a.txt', file_name: 'a.txt', file_size: 1, created_at: Date.now() }] });
    mockExecute.mockResolvedValueOnce({ code: 1 }).mockResolvedValueOnce({ code: 1 });
    mockStorageRemove.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'disk' } });
    await expect(db.attachments.delete(7)).resolves.toBe(true);
    expect(mockExecute).toHaveBeenLastCalledWith(expect.stringContaining('attachment_cleanup_queue'), ['attachment_cleanup_queue'], expect.any(Array));
  });
});

describe('db.tags.list', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('counts only active tasks, excluding soft-deleted task-tag associations', async () => {
    mockQuery.mockResolvedValue({ code: 1, data: [{ id: 1, name: 'A', color: '#fff', created_at: 'now', task_count: 0 }] });

    await expect(db.tags.list()).resolves.toEqual([expect.objectContaining({ id: 1, task_count: 0 })]);
    const [sql, tables] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('LEFT JOIN tasks task ON task.id = tt.task_id AND task.is_deleted = 0');
    expect(sql).toContain('COUNT(task.id) as task_count');
    expect(tables).toEqual(['tags', 'task_tags', 'tasks']);
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

describe('db.tasks.toggleAtomic', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockExecute.mockReset();
  });

  it('uses a CTE and one transaction to cascade a complex status update', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT parent_id FROM tasks')) return Promise.resolve({ code: 1, data: [{ parent_id: 10 }] });
      if (sql.includes('ancestors AS')) return Promise.resolve({ code: 1, data: [{ id: 1, parent_id: 10 }, { id: 10, parent_id: null }] });
      if (sql.includes('descendants AS')) return Promise.resolve({ code: 1, data: [{ id: 2 }] });
      if (sql.includes('parent_id IN')) return Promise.resolve({ code: 1, data: [{ id: 1, parent_id: 10, status: 'todo', progress: 0 }] });
      return Promise.resolve({ code: 1, data: [] });
    });
    const database = await import('treasure-sdk').then(m => m.database);
    vi.mocked(database.transaction).mockResolvedValue({ ok: true, value: [{ affectedRows: 1 }] });

    await expect(db.tasks.toggleAtomic(1, 'done')).resolves.toMatchObject({
      updatedTaskIds: [1, 2, 10],
      statusMap: { 1: 'done', 2: 'done', 10: 'done' },
    });
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WITH RECURSIVE ancestors'), ['tasks'], [1]);
    expect(database.transaction).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ sql: expect.stringContaining('UPDATE tasks SET status = ?') }),
      expect.objectContaining({ sql: expect.stringContaining('CASE id') }),
    ]));
    const operations = vi.mocked(database.transaction).mock.calls[0]![0];
    const statusUpdate = operations.find(operation => operation.sql.includes('UPDATE tasks SET status = CASE'))!;
    expect(statusUpdate.sql).not.toContain("WHEN 10 THEN 'done'");
    expect(statusUpdate.params).toEqual(expect.arrayContaining([10, 'done']));
  });

  it('fails rather than updating when the target task cannot be read', async () => {
    mockQuery.mockResolvedValue({ code: 1, data: [] });
    await expect(db.tasks.toggleAtomic(404, 'done')).rejects.toThrow('任务不存在');
  });
});

describe('db public API regression paths', () => {
  const task = (id = 1) => ({ id, title: '任务', description: '', priority: 'P2' as const, status: 'todo' as const, progress: 0, due_date: null, start_date: null, parent_id: null, sort_order: 0, is_deleted: 0, created_at: '2024-01-01', updated_at: '2024-01-01', completed_at: null });

  beforeEach(() => {
    mockQuery.mockReset(); mockExecute.mockReset(); mockStorageWrite.mockReset(); mockStorageRemove.mockReset();
    mockStorageWrite.mockResolvedValue({ ok: true, value: undefined });
    mockStorageRemove.mockResolvedValue({ ok: true, value: undefined });
    mockExecute.mockImplementation((sql: string) => Promise.resolve({ code: 1, data: sql.includes('RETURNING') ? [{ id: 9 }] : [] }));
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*) as total')) return Promise.resolve({ code: 1, data: [{ total: 2, todo: 1, doing: 0, done: 1, cancelled: 0, overdue: 0 }] });
      if (sql.includes('SELECT MAX(id) as id FROM')) return Promise.resolve({ code: 1, data: [{ id: 1 }] });
      if (sql.startsWith('SELECT parent_id FROM tasks')) return Promise.resolve({ code: 1, data: [{ parent_id: null }] });
      if (sql.includes('RECURSIVE')) return Promise.resolve({ code: 1, data: [] });
      if (sql.includes('FROM tasks WHERE id =')) return Promise.resolve({ code: 1, data: [task()] });
      if (sql.includes('FROM task_attachments WHERE id =')) return Promise.resolve({ code: 1, data: [{ id: 7, task_id: 1, file_path: 'attachments/a.txt', file_name: 'a.txt', file_size: 1, created_at: Date.now() }] });
      if (sql.includes('FROM task_attachments')) return Promise.resolve({ code: 1, data: [] });
      if (sql.includes('FROM task_logs WHERE id =')) return Promise.resolve({ code: 1, data: [{ id: 1, task_id: 1, content: '记录', log_date: '2024-01-01', sort_order: 0, is_deleted: 0, created_at: '2024-01-01', updated_at: '2024-01-01' }] });
      if (sql.includes('FROM task_logs')) return Promise.resolve({ code: 1, data: [] });
      if (sql.includes('FROM tasks WHERE parent_id')) return Promise.resolve({ code: 1, data: [] });
      if (sql.includes('SELECT t.* FROM tasks t')) return Promise.resolve({ code: 1, data: [task()] });
      return Promise.resolve({ code: 1, data: [] });
    });
  });

  it('covers task CRUD, tree and atomic leaf update through typed SDK transport', async () => {
    await expect(db.tasks.list({ status: 'all', priority: 'all' })).resolves.toEqual([expect.objectContaining({ id: 1 })]);
    await expect(db.tasks.getById(1)).resolves.toEqual(expect.objectContaining({ id: 1 }));
    await expect(db.tasks.create({ title: '新增任务' })).resolves.toEqual(expect.objectContaining({ id: 1 }));
    await expect(db.tasks.update(1, { title: '更新', status: 'done', tag_ids: [] })).resolves.toBe(true);
    await expect(db.tasks.softDelete(1)).resolves.toBe(true);
    await expect(db.tasks.softDeleteRecursive(1)).resolves.toEqual([1]);
    await expect(db.tasks.hardDelete(1)).resolves.toBe(true);
    await expect(db.tasks.getSubtasks(1)).resolves.toEqual([]);
    await expect(db.tasks.getSubtaskCounts([])).resolves.toEqual({});
    await expect(db.tasks.getTree(1)).resolves.toEqual([]);
    await expect(db.tasks.toggleAtomic(1, 'done')).resolves.toMatchObject({ updatedTaskIds: [1], statusMap: { 1: 'done' } });
  });

  it('covers tags, logs, statistics and attachment retry public APIs', async () => {
    await expect(db.tags.list()).resolves.toEqual([]);
    await expect(db.tags.create('工作')).resolves.toMatchObject({ id: 1, name: '工作' });
    await expect(db.tags.delete(1)).resolves.toBe(true);
    await expect(db.taskTags.set(1, [2, 3])).resolves.toBe(true);
    await expect(db.taskTags.getByTask(1)).resolves.toEqual([]);
    await expect(db.taskLogs.list(1)).resolves.toEqual([]);
    await expect(db.taskLogs.create(1, { content: '记录', log_date: '2024-01-01' })).resolves.toMatchObject({ id: 1 });
    await expect(db.taskLogs.delete(1)).resolves.toBe(true);
    await expect(db.stats.get()).resolves.toEqual({ total: 2, todo: 1, doing: 0, done: 1, cancelled: 0, overdue: 0 });
    await expect(db.attachments.listByTask(1)).resolves.toEqual([]);
    await expect(db.attachments.getById(7)).resolves.toMatchObject({ id: 7 });
    await expect(db.attachments.delete(7)).resolves.toBe(true);
    await expect(db.attachments.retryPendingCleanup()).resolves.toBe(0);
  });

  it('covers row mapping, attachment persistence and public utility operations', async () => {
    mockQuery.mockImplementation((sql: string, _tables: string[], params: unknown[] = []) => {
      if (sql.includes('FROM tasks WHERE id =')) return Promise.resolve({ code: 1, data: [task(Number(params[0]) === 1 ? 1 : 2)] });
      if (sql.includes('FROM tasks WHERE parent_id')) return Promise.resolve({ code: 1, data: [{ ...task(3), parent_id: Number(params[0]), status: 'done' }] });
      if (sql.includes('AVG(progress)')) return Promise.resolve({ code: 1, data: [{ avg_progress: 55.5 }] });
      if (sql.includes('RECURSIVE')) return Promise.resolve({ code: 1, data: [{ id: 4 }] });
      if (sql.includes('COUNT(task.id)')) return Promise.resolve({ code: 1, data: [{ id: 2, name: '标签', color: '#fff', created_at: 'now', task_count: 1 }] });
      if (sql.includes('JOIN task_tags tt')) return Promise.resolve({ code: 1, data: [{ id: 2, name: '标签', color: '#fff', created_at: 'now', task_id: 1 }] });
      if (sql.includes('FROM task_logs')) return Promise.resolve({ code: 1, data: [{ id: 1, task_id: 1, content: '记录', log_date: 'now', sort_order: 0, is_deleted: 0, created_at: 'now', updated_at: 'now' }] });
      if (sql.includes('FROM task_attachments WHERE task_id')) return Promise.resolve({ code: 1, data: [{ id: 7, task_id: 1, file_path: 'attachments/a.txt', file_name: 'a.txt', file_size: 1, created_at: Date.now() }] });
      if (sql.includes('attachment_cleanup_queue')) return Promise.resolve({ code: 1, data: [{ id: 8, storage_key: 'attachments/orphan.txt' }] });
      return Promise.resolve({ code: 1, data: [] });
    });
    mockExecute.mockImplementation((sql: string) => Promise.resolve({ code: 1, data: sql.includes('RETURNING') ? [{ id: 9 }] : [] }));

    await expect(db.tags.list()).resolves.toEqual([expect.objectContaining({ task_count: 1 })]);
    await expect(db.taskTags.getByTask(1)).resolves.toEqual([expect.objectContaining({ id: 2 })]);
    await expect(db.taskLogs.list(1)).resolves.toEqual([expect.objectContaining({ content: '记录' })]);
    await expect(db.attachments.listByTask(1)).resolves.toEqual([expect.objectContaining({ file_name: 'a.txt' })]);
    await expect(db.attachments.create(1, new File(['x'], '附件.txt'))).resolves.toMatchObject({ id: 9, file_path: expect.stringMatching(/^attachments\//) });
    await expect(db.attachments.retryPendingCleanup()).resolves.toBe(1);
    await expect(db.tasks.updateTaskTags(1, [2])).resolves.toBe(true);
    expect(db.utils.computeAggregateStatus([{ ...task(1), status: 'done' }])).toBe('done');
    expect(db.utils.computeAggregateStatus([{ ...task(1), status: 'cancelled' }])).toBe('cancelled');
    await db.utils.syncAncestorStatus(1);
    await db.utils.cascadeStatus(1, 'done');
    await db.utils.recalcProgressBatch([1, 2]);
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks SET progress'), ['tasks'], expect.any(Array));
  });

  it('returns safe business defaults for database and storage failures', async () => {
    mockQuery.mockResolvedValue({ code: 0, msg: 'offline' });
    mockExecute.mockResolvedValue({ code: 0, msg: 'offline' });
    const database = await import('treasure-sdk').then(m => m.database);
    vi.mocked(database.transaction).mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'offline' } });
    mockStorageWrite.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'disk' } });
    mockStorageRemove.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'disk' } });

    await expect(db.tasks.list({ status: 'todo', priority: 'P1', search: 'x', tag_id: 1 })).resolves.toEqual([]);
    await expect(db.tasks.getById(1)).resolves.toBeNull();
    await expect(db.tasks.create({ title: '失败' })).resolves.toBeNull();
    await expect(db.tasks.update(1, { title: '失败' })).resolves.toBe(false);
    await expect(db.tasks.softDelete(1)).resolves.toBe(false);
    await expect(db.tasks.softDeleteRecursive(1)).resolves.toEqual([]);
    await expect(db.tasks.hardDelete(1)).resolves.toBe(false);
    await expect(db.tasks.getSubtasks(1)).resolves.toEqual([]);
    await expect(db.tasks.getSubtaskCounts([1])).resolves.toEqual({});
    await expect(db.tasks.getDescendantIds(1)).resolves.toEqual([]);
    await expect(db.tags.list()).resolves.toEqual([]);
    await expect(db.tags.create('失败')).resolves.toBeNull();
    await expect(db.tags.delete(1)).resolves.toBe(false);
    await expect(db.taskTags.set(1, [])).resolves.toBe(false);
    await expect(db.taskTags.getByTask(1)).resolves.toEqual([]);
    await expect(db.taskLogs.list(1)).resolves.toEqual([]);
    await expect(db.taskLogs.create(1, { content: '失败', log_date: 'now' })).resolves.toBeNull();
    await expect(db.taskLogs.delete(1)).resolves.toBe(false);
    await expect(db.attachments.listByTask(1)).resolves.toEqual([]);
    await expect(db.attachments.getById(1)).resolves.toBeNull();
    await expect(db.attachments.create(1, new File(['x'], '失败.txt'))).resolves.toBeNull();
    await expect(db.attachments.delete(1)).resolves.toBe(false);
    await expect(db.attachments.retryPendingCleanup()).resolves.toBe(0);
    await expect(db.stats.get()).resolves.toEqual({ total: 0, todo: 0, doing: 0, done: 0, cancelled: 0, overdue: 0 });
    await expect(db.tasks.toggleAtomic(1, 'done')).rejects.toThrow('任务不存在');
  });

  it('contains asynchronous logging failures at every logged public boundary', async () => {
    const logs = await import('treasure-sdk').then(m => m.logs);
    vi.mocked(logs.write).mockRejectedValue(new Error('logger unavailable'));
    mockQuery.mockResolvedValue({ code: 1, data: [] });
    mockExecute.mockResolvedValue({ code: 1, data: [] });
    const database = await import('treasure-sdk').then(m => m.database);
    vi.mocked(database.transaction).mockResolvedValue({ ok: true, value: [] });

    await Promise.all([
      db.tasks.list({}), db.tasks.getById(1), db.tasks.create({ title: 'x' }), db.tasks.update(1, {}), db.tasks.softDelete(1), db.tasks.softDeleteRecursive(1),
      db.tags.list(), db.tags.create('x'), db.tags.delete(1), db.taskTags.set(1, []), db.taskLogs.list(1), db.taskLogs.create(1, { content: 'x', log_date: 'now' }), db.taskLogs.delete(1),
      db.attachments.listByTask(1), db.attachments.getById(1), db.attachments.delete(1), db.tasks.getTree(1),
    ]);
    await db.utils.syncAncestorStatus(1);
    await db.utils.cascadeStatus(1, 'todo');
    await expect(db.tasks.toggleAtomic(1, 'todo')).rejects.toThrow('任务不存在');
  });

  it('covers filters, every editable field, tree truncation and cleanup retry branches', async () => {
    const logs = await import('treasure-sdk').then(m => m.logs);
    vi.mocked(logs.write).mockResolvedValue({ ok: true, value: undefined });
    mockStorageRemove.mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'busy' } });
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT task_id FROM task_tags')) return Promise.resolve({ code: 1, data: [{ task_id: 1 }] });
      if (sql.includes('SELECT t.* FROM tasks t')) return Promise.resolve({ code: 1, data: [task()] });
      if (sql.includes('FROM tags t') && sql.includes('IN')) return Promise.resolve({ code: 1, data: [{ task_id: 1, id: 2, name: '标签', color: '#fff', created_at: 'now' }] });
      if (sql.includes('FROM tasks WHERE parent_id')) return Promise.resolve({ code: 1, data: [task(3)] });
      if (sql.includes('attachment_cleanup_queue')) return Promise.resolve({ code: 1, data: [{ id: 8, storage_key: 'attachments/locked.txt' }] });
      return Promise.resolve({ code: 1, data: [] });
    });
    mockExecute.mockResolvedValue({ code: 1, data: [] });
    const database = await import('treasure-sdk').then(m => m.database);
    vi.mocked(database.transaction).mockResolvedValue({ ok: true, value: [] });

    await expect(db.tasks.list({ status: 'todo', priority: 'P1', search: '关键词', tag_id: 2, sort_by: 'invalid' as any, sort_order: 'asc' })).resolves.toEqual([expect.objectContaining({ tags: [expect.objectContaining({ id: 2 })] })]);
    await expect(db.tasks.update(1, {
      title: '标题', description: '描述', priority: 'P0', status: 'todo', progress: 25, due_date: '2025-01-01', start_date: '2024-01-01', parent_id: 2, sort_order: 3, tag_ids: [2, 3],
    })).resolves.toBe(true);
    await expect(db.tasks.getTree(1, 0, 0)).resolves.toEqual([expect.objectContaining({ children: [{ __truncated: true, task_id: 3 }] })]);
    await expect(db.attachments.retryPendingCleanup()).resolves.toBe(0);
    expect(db.utils.computeAggregateStatus([{ ...task(1), status: 'doing' }])).toBe('doing');
    expect(db.utils.computeAggregateStatus([{ ...task(1), status: 'done' }, { ...task(2), status: 'todo' }])).toBe('doing');
    expect(db.utils.computeAggregateStatus([{ ...task(1), status: 'todo' }])).toBe('todo');
  });

  it('covers empty and failed task-list responses plus failed tag synchronization', async () => {
    mockQuery.mockResolvedValueOnce({ code: 0, msg: 'offline' }).mockResolvedValueOnce({ code: 1 });
    await expect(db.tasks.list({})).resolves.toEqual([]);
    await expect(db.tasks.list({})).resolves.toEqual([]);
    mockExecute.mockResolvedValue({ code: 1, data: [] });
    const database = await import('treasure-sdk').then(m => m.database);
    vi.mocked(database.transaction).mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'rollback' } });
    await expect(db.tasks.update(1, { tag_ids: [2] })).resolves.toBe(false);
  });

  it('creates task-tag links when task creation supplies tag ids', async () => {
    mockExecute.mockResolvedValueOnce({ code: 1, data: [{ id: 3 }] });
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM tasks WHERE id')) return Promise.resolve({ code: 1, data: [task(3)] });
      return Promise.resolve({ code: 1, data: [] });
    });
    const database = await import('treasure-sdk').then(m => m.database);
    vi.mocked(database.transaction).mockResolvedValue({ ok: true, value: [] });
    await expect(db.tasks.create({ title: '带标签', tag_ids: [2] })).resolves.toMatchObject({ id: 3 });
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('RETURNING id'), ['tasks'], expect.any(Array));
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('SELECT MAX(id)'), expect.any(Array), expect.any(Array));
    expect(database.transaction).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ sql: expect.stringContaining('INSERT INTO task_tags') })]));
  });

  it('propagates an aggregate status once before an ancestor chain ends', async () => {
    mockExecute.mockResolvedValue({ code: 1, data: [] });
    mockQuery.mockImplementation((sql: string, _tables: string[], params: unknown[] = []) => {
      if (sql.includes('FROM tasks WHERE id')) return Promise.resolve(Number(params[0]) === 1
        ? { code: 1, data: [{ ...task(1), parent_id: 2 }] }
        : { code: 1, data: [] });
      if (sql.includes('FROM tasks WHERE parent_id')) return Promise.resolve({ code: 1, data: [{ ...task(1), parent_id: 2, status: 'done' }] });
      return Promise.resolve({ code: 1, data: [] });
    });
    await expect(db.utils.syncAncestorStatus(1)).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks SET status'), ['tasks'], expect.any(Array));
  });
});
