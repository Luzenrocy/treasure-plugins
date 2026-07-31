/**
 * 数据库操作层 —— 通过 treasure-sdk 桥接执行 SQL
 *
 * 所有 SQL 中的表名使用裸名，宿主侧的 rewriteWithDeclaredTables
 * 会自动添加 plugin_{pluginCode}_ 前缀。
 *
 * 声明的表名列表：['tasks', 'tags', 'task_tags']
 */

import { getTreasure, file } from 'treasure-sdk';
import type {
  Task, CreateTaskInput, UpdateTaskInput,
  Tag, TaskTag, TaskLog, CreateTaskLogInput,
  DbResponse, TaskFilter, TaskStatus, Priority,
  TaskAttachment,
} from '@/types';

const TABLES = { tasks: ['tasks'], tags: ['tags'], task_tags: ['task_tags'], task_logs: ['task_logs'], task_attachments: ['task_attachments'] };

/** 当前时间 ISO 字符串 */
function now(): string {
  return new Date().toISOString();
}

// ──────────────────────────────────────────────
// 任务 CRUD
// ──────────────────────────────────────────────

async function listTasks(filter: TaskFilter): Promise<Task[]> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'listTasks', { filter }).catch(() => {})
  const conditions: string[] = ['t.is_deleted = 0'];
  const params: any[] = [];

  if (filter.status && filter.status !== 'all') {
    conditions.push('t.status = ?');
    params.push(filter.status);
  }
  if (filter.priority && filter.priority !== 'all') {
    conditions.push('t.priority = ?');
    params.push(filter.priority);
  }
  if (filter.search) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }
  if (filter.tag_id != null) {
    // 先查 task_tags 获取匹配的 task_id 列表，避免 SQL 子查询中的裸表名被 Rust 校验拒绝
    const tagRes = await bridge.query(
      'SELECT task_id FROM task_tags WHERE tag_id = ?',
      ['task_tags'],
      [filter.tag_id]
    );
    if (tagRes.code !== 1 || !tagRes.data?.length) {
      return [];
    }
    const taskIds = tagRes.data.map((r: any) => r.task_id);
    conditions.push(`t.id IN (${taskIds.map(() => '?').join(',')})`);
    params.push(...taskIds);
  }

  const sortBy = filter.sort_by || 'created_at';
  const sortOrder = filter.sort_order || 'desc';
  // 防止 SQL 注入：排序字段白名单校验
  const allowedSorts = ['created_at', 'due_date', 'priority', 'sort_order'];
  const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const sql = `SELECT t.* FROM tasks t WHERE ${conditions.join(' AND ')} ORDER BY t.${safeSort} ${safeOrder}`;

  const res = await bridge.query(sql, ['tasks'], params);
  if (res.code !== 1) {
    console.error('listTasks failed:', res.msg);
    return [];
  }
  const tasks = (res.data || []).map(parseTaskRow);

  // 批量加载关联标签，避免前端逐个查询
  const ids = tasks.map(t => t.id);
  if (ids.length) {
    const tagsMap = await getTagsByTaskIds(ids);
    for (const task of tasks) {
      task.tags = tagsMap[task.id] || [];
    }
  }

  return tasks;
}

async function getTaskById(id: number): Promise<Task | null> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'getTaskById', { id }).catch(() => {})
  const res = await bridge.query('SELECT * FROM tasks WHERE id = ?', ['tasks'], [id]);
  if (res.code !== 1 || !res.data?.length) return null;
  const task = parseTaskRow(res.data[0]);
  // 加载关联标签
  task.tags = await getTagsByTaskId(id);
  // 加载关联附件
  task.attachments = await getAttachmentsByTaskId(id);
  return task;
}

async function createTask(input: CreateTaskInput): Promise<Task | null> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'createTask', { title: input.title, status: input.status }).catch(() => {})
  const ts = now();
  const { tag_ids, ...fields } = input;

  const sql = `INSERT INTO tasks (title, description, priority, status, progress, due_date, start_date, parent_id, sort_order, is_deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`;

  const params: any[] = [
    fields.title,
    fields.description || '',
    fields.priority || 'P2',
    fields.status || 'todo',
    fields.progress ?? 0,
    fields.due_date || null,
    fields.start_date || null,
    fields.parent_id || null,
    0,
    ts,
    ts,
  ];

  const res = await bridge.execute(sql, ['tasks'], params);
  if (res.code !== 1) {
    console.error('createTask failed:', res.msg);
    return null;
  }

  // 获取新插入的 ID
  const idRes = await bridge.query('SELECT MAX(id) as id FROM tasks', ['tasks']);
  const newId = idRes.data?.[0]?.id;
  if (!newId) return null;

  // 关联标签
  if (tag_ids?.length) {
    await setTaskTags(newId, tag_ids);
  }

  return getTaskById(newId);
}

async function updateTask(id: number, input: UpdateTaskInput): Promise<boolean> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'updateTask', { id, fields: Object.keys(input) }).catch(() => {})
  const sets: string[] = [];
  const params: any[] = [];

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
  if (input.priority !== undefined) { sets.push('priority = ?'); params.push(input.priority); }
  if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status); }
  if (input.progress !== undefined) { sets.push('progress = ?'); params.push(input.progress); }
  if (input.due_date !== undefined) { sets.push('due_date = ?'); params.push(input.due_date); }
  if (input.start_date !== undefined) { sets.push('start_date = ?'); params.push(input.start_date); }
  if (input.parent_id !== undefined) { sets.push('parent_id = ?'); params.push(input.parent_id); }
  if (input.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(input.sort_order); }

  // 状态变为 done 时自动记录完成时间
  if (input.status === 'done') {
    sets.push('completed_at = ?');
    params.push(now());
  }
  // 从 done 改回其他状态时清除完成时间
  if (input.status && input.status !== 'done') {
    sets.push('completed_at = NULL');
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  const sql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`;
  const res = await bridge.execute(sql, ['tasks'], params);
  if (res.code !== 1) return false;

  // ★ 新增：若输入包含 tag_ids，同步更新任务-标签关联
  if (input.tag_ids !== undefined) {
    const ok = await setTaskTags(id, input.tag_ids);
    if (!ok) return false;
  }

  return true;
}

async function softDeleteTask(id: number): Promise<boolean> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'softDeleteTask', { id }).catch(() => {})
  const res = await bridge.execute(
    'UPDATE tasks SET is_deleted = 1, updated_at = ? WHERE id = ?',
    ['tasks'],
    [now(), id]
  );
  return res.code === 1;
}

/** 获取任务的所有后代 ID（递归 CTE） */
async function getDescendantIds(parentId: number): Promise<number[]> {
  const bridge = getTreasure();
  const res = await bridge.query(
    `WITH RECURSIVE descendants AS (
      SELECT id FROM tasks WHERE parent_id = ? AND is_deleted = 0
      UNION ALL
      SELECT t.id FROM tasks t
      INNER JOIN descendants d ON t.parent_id = d.id
      WHERE t.is_deleted = 0
    )
    SELECT id FROM descendants`,
    ['tasks'],
    [parentId]
  );
  if (res.code !== 1) return [];
  return (res.data || []).map((row: any) => row.id);
}

/** 递归软删除任务及其所有子任务 */
async function softDeleteTaskRecursive(id: number): Promise<number[]> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'softDeleteTaskRecursive', { id }).catch(() => {})
  const allIds = await getDescendantIds(id);
  allIds.push(id);
  const ts = now();
  const placeholders = allIds.map(() => '?').join(',');
  const res = await bridge.execute(
    `UPDATE tasks SET is_deleted = 1, updated_at = ? WHERE id IN (${placeholders})`,
    ['tasks'],
    [ts, ...allIds]
  );
  if (res.code !== 1) return [];
  return allIds;
}

/**
 * 根据子任务列表计算父任务应有的聚合状态
 */
function computeAggregateStatus(children: Task[]): TaskStatus {
  let hasDone = false, hasDoing = false, hasTodo = false, hasCancelled = false;
  for (const c of children) {
    if (c.status === 'done') hasDone = true;
    else if (c.status === 'doing') hasDoing = true;
    else if (c.status === 'todo') hasTodo = true;
    else hasCancelled = true;
  }
  if (hasDoing) return 'doing';
  if (hasDone && !hasTodo && !hasCancelled) return 'done';
  if (hasCancelled && !hasDone && !hasTodo) return 'cancelled';
  if (hasDone && (hasTodo || hasCancelled)) return 'doing';
  return 'todo';
}

/**
 * 递归更新所有祖先任务的状态（基于子任务状态计算）
 */
async function syncAncestorStatus(taskId: number): Promise<void> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'syncAncestorStatus', { taskId }).catch(() => {})
  const task = await getTaskById(taskId);
  if (!task || !task.parent_id) return;
  const children = await getSubtasks(task.parent_id);
  const effectiveStatus = computeAggregateStatus(children);
  const ts = now();
  await bridge.execute(
    'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
    ['tasks'],
    [effectiveStatus, ts, task.parent_id]
  );
  // 继续向上递归
  await syncAncestorStatus(task.parent_id);
}

/** 用分数表示progress，级联时统一处理 */
function cascadeProgress(status: TaskStatus): number {
  if (status === 'done') return 100;
  return 0;
}

/**
 * 递归级联状态到所有后代子任务（批量 SQL）
 */
async function cascadeStatus(taskId: number, status: TaskStatus): Promise<void> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'cascadeStatus', { taskId, status }).catch(() => {})
  const allIds = await getDescendantIds(taskId);
  if (!allIds.length) return;
  const ts = now();
  const placeholders = allIds.map(() => '?').join(',');
  await bridge.execute(
    `UPDATE tasks SET status = ?, progress = ?, completed_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
    ['tasks'],
    [status, cascadeProgress(status), status === 'done' ? ts : null, ts, ...allIds]
  );
}

/**
 * 批量重算指定祖先 ID 的进度（基于其直接子任务 progress 平均值）
 *
 * 注意：必须从叶子到根逐层更新（ancestorIds 由近到远），
 * 因为父节点的 AVG 依赖于子节点的最新 progress 值，
 * 如果使用单次批量查询所有祖先，祖父节点会基于父节点的旧值计算，导致结果错误。
 */
async function recalcProgressBatch(ancestorIds: number[]): Promise<void> {
  if (!ancestorIds.length) return;
  const bridge = getTreasure();
  const ts = now();

  for (const id of ancestorIds) {
    const res = await bridge.query(
      `SELECT AVG(progress) as avg_progress
       FROM tasks
       WHERE parent_id = ? AND is_deleted = 0`,
      ['tasks'],
      [id]
    );
    const avgProgress = Math.round(res.data?.[0]?.avg_progress ?? 0);
    await bridge.execute(
      'UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?',
      ['tasks'],
      [avgProgress, ts, id]
    );
  }
}

async function hardDeleteTask(id: number): Promise<boolean> {
  const bridge = getTreasure();
  const res = await bridge.transaction([
    { sql: 'DELETE FROM task_tags WHERE task_id = ?', tables: ['task_tags'], params: [id] },
    { sql: 'DELETE FROM tasks WHERE id = ?', tables: ['tasks'], params: [id] },
  ]);
  return res.code === 1;
}

// ──────────────────────────────────────────────
// 标签 CRUD
// ──────────────────────────────────────────────

async function listTags(): Promise<Tag[]> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'listTags', {}).catch(() => {})
  const res = await bridge.query(
    `SELECT t.*, COUNT(tt.task_id) as task_count FROM tags t LEFT JOIN task_tags tt ON t.id = tt.tag_id GROUP BY t.id ORDER BY t.name`,
    ['tags', 'task_tags']
  );
  if (res.code !== 1) return [];
  return (res.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    created_at: r.created_at,
    task_count: r.task_count ?? 0,
  }));
}

async function createTag(name: string, color: string = '#6366f1'): Promise<Tag | null> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'createTag', { name, color }).catch(() => {})
  const ts = now();
  const res = await bridge.execute(
    'INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)',
    ['tags'],
    [name, color, ts]
  );
  if (res.code !== 1) {
    // 可能是 UNIQUE 冲突
    return null;
  }
  const idRes = await bridge.query('SELECT MAX(id) as id FROM tags', ['tags']);
  const id = idRes.data?.[0]?.id;
  if (!id) return null;
  return { id, name, color, created_at: ts };
}

async function deleteTag(id: number): Promise<boolean> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'deleteTag', { id }).catch(() => {})
  const res = await bridge.execute('DELETE FROM tags WHERE id = ?', ['tags'], [id]);
  return res.code === 1;
}

// ──────────────────────────────────────────────
// 任务-标签关联
// ──────────────────────────────────────────────

async function setTaskTags(taskId: number, tagIds: number[]): Promise<boolean> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'setTaskTags', { taskId, tagIds }).catch(() => {})
  const ops: { sql: string; tables: string[]; params: any[] }[] = [
    { sql: 'DELETE FROM task_tags WHERE task_id = ?', tables: ['task_tags'], params: [taskId] },
  ];
  for (const tagId of tagIds) {
    ops.push({ sql: 'INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', tables: ['task_tags'], params: [taskId, tagId] });
  }
  const res = await bridge.transaction(ops);
  return res.code === 1;
}

async function updateTaskTags(taskId: number, tagIds: number[]): Promise<boolean> {
  return setTaskTags(taskId, tagIds);
}

async function getTagsByTaskId(taskId: number): Promise<Tag[]> {
  const bridge = getTreasure();
  const res = await bridge.query(
    `SELECT t.* FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ?`,
    ['tags', 'task_tags'],
    [taskId]
  );
  if (res.code !== 1) return [];
  return (res.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    created_at: r.created_at,
  }));
}

// 批量查询多个任务的标签
async function getTagsByTaskIds(taskIds: number[]): Promise<Record<number, Tag[]>> {
  if (!taskIds.length) return {};
  const bridge = getTreasure();
  const placeholders = taskIds.map(() => '?').join(',');
  const res = await bridge.query(
    `SELECT tt.task_id, t.id, t.name, t.color, t.created_at
     FROM tags t
     JOIN task_tags tt ON t.id = tt.tag_id
     WHERE tt.task_id IN (${placeholders})`,
    ['tags', 'task_tags'],
    taskIds
  );
  if (res.code !== 1) return {};

  const map: Record<number, Tag[]> = {};
  for (const row of res.data || []) {
    if (!map[row.task_id]) map[row.task_id] = [];
    map[row.task_id].push({
      id: row.id,
      name: row.name,
      color: row.color,
      created_at: row.created_at,
    });
  }
  return map;
}

// ──────────────────────────────────────────────
// 统计
// ──────────────────────────────────────────────

async function getStats(): Promise<{ total: number; todo: number; doing: number; done: number; cancelled: number; overdue: number }> {
  const bridge = getTreasure();
  const res = await bridge.query(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'doing' THEN 1 ELSE 0 END) as doing,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status != 'done' AND status != 'cancelled' AND due_date IS NOT NULL AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue
    FROM tasks WHERE is_deleted = 0`,
    ['tasks']
  );
  if (res.code !== 1 || !res.data?.length) {
    return { total: 0, todo: 0, doing: 0, done: 0, cancelled: 0, overdue: 0 };
  }
  const row = res.data[0];
  return {
    total: row.total ?? 0,
    todo: row.todo ?? 0,
    doing: row.doing ?? 0,
    done: row.done ?? 0,
    cancelled: row.cancelled ?? 0,
    overdue: row.overdue ?? 0,
  };
}

// ──────────────────────────────────────────────
// 辅助
// ──────────────────────────────────────────────

function parseTaskRow(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    priority: row.priority as Priority,
    status: row.status as TaskStatus,
    progress: row.progress ?? 0,
    due_date: row.due_date || null,
    start_date: row.start_date || null,
    parent_id: row.parent_id || null,
    sort_order: row.sort_order ?? 0,
    is_deleted: row.is_deleted ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at || null,
    tags: [],
  };
}

// ──────────────────────────────────────────────
// 子任务
// ──────────────────────────────────────────────

async function getSubtasks(parentId: number): Promise<Task[]> {
  const bridge = getTreasure();
  const res = await bridge.query(
    'SELECT * FROM tasks WHERE parent_id = ? AND is_deleted = 0 ORDER BY sort_order, created_at',
    ['tasks'],
    [parentId]
  );
  if (res.code !== 1) return [];
  const tasks: Task[] = (res.data || []).map(parseTaskRow);

  // 批量查询所有子任务的标签（1 次 IN 查询替代 N 次单独查询）
  if (tasks.length > 0) {
    const taskIds = tasks.map(t => t.id);
    const tagsMap = await getTagsByTaskIds(taskIds);
    for (const t of tasks) {
      t.tags = tagsMap[t.id] || [];
    }
  }

  return tasks;
}

async function getSubtaskCounts(taskIds: number[]): Promise<Record<number, number>> {
  if (!taskIds.length) return {};
  const bridge = getTreasure();
  const placeholders = taskIds.map(() => '?').join(',');
  const res = await bridge.query(
    `SELECT parent_id, COUNT(*) as cnt FROM tasks WHERE parent_id IN (${placeholders}) AND is_deleted = 0 GROUP BY parent_id`,
    ['tasks'],
    taskIds
  );
  if (res.code !== 1) return {};
  const counts: Record<number, number> = {};
  for (const row of res.data || []) {
    counts[row.parent_id] = row.cnt;
  }
  return counts;
}

// ──────────────────────────────────────────────
// 处理记录 CRUD
// ──────────────────────────────────────────────

async function getTaskLogs(taskId: number): Promise<TaskLog[]> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'getTaskLogs', { taskId }).catch(() => {})
  const res = await bridge.query(
    'SELECT * FROM task_logs WHERE task_id = ? AND is_deleted = 0 ORDER BY log_date DESC, sort_order ASC',
    ['task_logs'],
    [taskId]
  );
  if (res.code !== 1) return [];
  return (res.data || []).map(parseTaskLogRow);
}

async function getTaskLog(taskId: number, logId: number): Promise<TaskLog | null> {
  const bridge = getTreasure();
  const res = await bridge.query(
    'SELECT * FROM task_logs WHERE id = ? AND task_id = ? AND is_deleted = 0',
    ['task_logs'],
    [logId, taskId]
  );
  if (res.code !== 1 || !res.data?.length) return null;
  return parseTaskLogRow(res.data[0]);
}

async function createTaskLog(taskId: number, input: CreateTaskLogInput): Promise<TaskLog | null> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'createTaskLog', { taskId, content: input.content }).catch(() => {})
  const ts = now();
  const res = await bridge.execute(
    `INSERT INTO task_logs (task_id, content, log_date, sort_order, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    ['task_logs'],
    [taskId, input.content, input.log_date, input.sort_order ?? 0, ts, ts]
  );
  if (res.code !== 1) return null;
  const idRes = await bridge.query('SELECT MAX(id) as id FROM task_logs', ['task_logs']);
  return idRes.data?.[0]?.id ? getTaskLog(taskId, idRes.data[0].id) : null;
}

async function deleteTaskLog(logId: number): Promise<boolean> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'deleteTaskLog', { logId }).catch(() => {})
  const res = await bridge.execute(
    'UPDATE task_logs SET is_deleted = 1, updated_at = ? WHERE id = ?',
    ['task_logs'],
    [now(), logId]
  );
  return res.code === 1;
}

function parseTaskLogRow(row: any): TaskLog {
  return {
    id: row.id,
    task_id: row.task_id,
    content: row.content,
    log_date: row.log_date,
    sort_order: row.sort_order ?? 0,
    is_deleted: row.is_deleted ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ──────────────────────────────────────────────
// 附件 CRUD
// ──────────────────────────────────────────────

/** 附件表初始化（幂等） */
async function initAttachmentsTable(): Promise<void> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'initAttachmentsTable', {}).catch(() => {})
  await bridge.execute(
    `CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`,
    ['task_attachments']
  );
  await bridge.execute(
    `CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id)`,
    ['task_attachments']
  );
}

/** 按任务 ID 查询附件列表 */
async function getAttachmentsByTaskId(taskId: number): Promise<TaskAttachment[]> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'getAttachmentsByTaskId', { taskId }).catch(() => {})
  const res = await bridge.query(
    'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC',
    ['task_attachments'],
    [taskId]
  );
  if (res.code !== 1) return [];
  return (res.data || []).map(parseAttachmentRow);
}

/** 获取插件数据目录（生产环境返回 appDataDir 下的绝对路径，开发环境回退到相对路径） */
async function getPluginDataDir(): Promise<string> {
  const bridge = getTreasure();
  try {
    const res = await bridge.request('getPluginDataDir');
    if (res?.code === 1 && res.data) return res.data;
  } catch {
    // 开发模式或旧版宿主不支持此 action，回退到相对路径
  }
  return 'plugins/kao-cheng-ce';
}

/** 上传附件（写入文件 + 数据库记录） */
async function createAttachment(taskId: number, sourceFile: File): Promise<TaskAttachment | null> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'createAttachment', { taskId, fileName: sourceFile.name }).catch(() => {})
  const ts = Date.now();
  const ext = sourceFile.name.split('.').pop() || 'bin';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const pluginDir = await getPluginDataDir();
  const dirPath = `${pluginDir}/attachments`;
  const filePath = `${dirPath}/${fileName}`;

  // 确保目录存在（createDir 在目录已存在时可能返回空消息错误，需额外校验）
  const dirRes = await file.createDir(dirPath, { recursive: true });
  if (dirRes.code !== 1) {
    const existsRes = await file.readDir(dirPath);
    if (existsRes.code !== 1) {
      console.error('createAttachment: 创建目录失败', dirRes.msg || existsRes.msg || dirPath);
      return null;
    }
  }

  const base64 = await fileToBase64(sourceFile);
  const writeRes = await file.writeBinaryFile(filePath, base64);
  if (writeRes.code !== 1) {
    console.error('createAttachment: 写入文件失败', writeRes.msg);
    return null;
  }

  // 使用 RETURNING 子句获取新插入 ID，避免竞态
  const res = await bridge.execute(
    `INSERT INTO task_attachments (task_id, file_path, file_name, file_size, created_at)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    ['task_attachments'],
    [taskId, filePath, sourceFile.name, sourceFile.size, ts]
  );
  if (res.code !== 1 || !res.data?.[0]) return null;

  const id = res.data[0].id;
  return { id, task_id: taskId, file_path: filePath, file_name: sourceFile.name, file_size: sourceFile.size, created_at: new Date(ts).toISOString() };
}

/** 删除附件（数据库记录 + 物理文件） */
async function deleteAttachment(id: number): Promise<boolean> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'deleteAttachment', { id }).catch(() => {})
  // 1. 先查记录获取 file_path
  const existing = await getAttachmentById(id);
  if (!existing) return false;

  // 2. 删除数据库记录
  const res = await bridge.execute(
    'DELETE FROM task_attachments WHERE id = ?',
    ['task_attachments'],
    [id]
  );
  if (res.code !== 1) return false;

  // 3. 删除物理文件（忽略错误，记录存在但文件缺失是可接受的最终状态）
  try { await file.deleteFile(existing.file_path); } catch {}
  return true;
}

/** 按 ID 查询单个附件 */
async function getAttachmentById(id: number): Promise<TaskAttachment | null> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'getAttachmentById', { id }).catch(() => {})
  const res = await bridge.query(
    'SELECT * FROM task_attachments WHERE id = ?',
    ['task_attachments'],
    [id]
  );
  if (res.code !== 1 || !res.data?.length) return null;
  return parseAttachmentRow(res.data[0]);
}

/** 将数据库行映射为 TaskAttachment */
function parseAttachmentRow(row: any): TaskAttachment {
  return {
    id: row.id,
    task_id: row.task_id,
    file_path: row.file_path,
    file_name: row.file_name,
    file_size: row.file_size,
    created_at: new Date(row.created_at).toISOString(),
  };
}

/** 将 File 对象转换为 base64 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ──────────────────────────────────────────────
// 无限层级子任务树
// ──────────────────────────────────────────────

async function getTaskTree(
  parentId: number,
  depth = 0,
  maxDepth = 5
): Promise<(Task & { children: any[] })[]> {
  if (depth > maxDepth) return [];

  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'getTaskTree', { parentId, depth, maxDepth }).catch(() => {})
  const res = await bridge.query(
    'SELECT * FROM tasks WHERE parent_id = ? AND is_deleted = 0 ORDER BY sort_order, created_at',
    ['tasks'],
    [parentId]
  );
  const tasks = (res.data || []).map(parseTaskRow);
  const result: any[] = [];

  for (const t of tasks) {
    if (depth < maxDepth) {
      t.children = await getTaskTree(t.id, depth + 1, maxDepth);
      t.tags = await getTagsByTaskId(t.id);
    } else {
      t.children = [{ __truncated: true, task_id: t.id }];
    }
    result.push({ ...t });
  }

  return result;
}

/**
 * toggleAtomic 操作结果
 */
interface ToggleTaskResult {
  updatedTaskIds: number[];   // 所有被更新的任务 ID（含后代与祖先）
  statusMap: Record<number, TaskStatus>;
  progressMap: Record<number, number>;
}

/**
 * 原子操作：切换任务状态并同步所有相关数据
 *
 * 事务内完成：
 *  1. 更新当前任务状态
 *  2. 级联更新所有后代状态
 *  3. 递归同步所有祖先状态（从叶子到根）
 *  4. 批量重算所有祖先进度
 *
 * 返回所有受影响的任务 ID 及最新状态/进度，供前端乐观更新使用。
 */
async function toggleAtomic(taskId: number, nextStatus: TaskStatus): Promise<ToggleTaskResult> {
  const bridge = getTreasure();
  bridge.log?.('info', 'biz', 'toggleAtomic', { taskId, nextStatus }).catch(() => {})
  const ts = now();

  // ── 快速路径：叶子节点且无祖先，仅需单条 UPDATE ──
  // 先查 parent_id 判断是否为叶子节点，避免不必要的 CTE 和级联查询
  const quickRes = await bridge.query(
    'SELECT parent_id FROM tasks WHERE id = ? AND is_deleted = 0',
    ['tasks'],
    [taskId]
  );
  if (quickRes.code !== 1 || !quickRes.data?.length) throw new Error('任务不存在');
  const parentId = quickRes.data[0].parent_id as number | null;

  // 无父节点且无后代：最简情况，1 次 UPDATE 即可
  if (!parentId) {
    const descendantIds = await getDescendantIds(taskId);
    if (descendantIds.length === 0) {
      const progress = nextStatus === 'done' ? 100 : 0;
      const updateOp = {
        sql: `UPDATE tasks SET status = ?, progress = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
        tables: ['tasks'],
        params: [nextStatus, progress, nextStatus === 'done' ? ts : null, ts, taskId],
      };
      const txResult = await bridge.transaction([updateOp]);
      if (txResult.code !== 1) throw new Error(txResult.msg || '事务执行失败');
      return { updatedTaskIds: [taskId], statusMap: { [taskId]: nextStatus }, progressMap: { [taskId]: progress } };
    }
  }

  // ── 完整路径：有祖先或后代，需要级联处理 ──
  // ── 第 1 步：一次性获取当前任务及所有祖先链（递归 CTE，避免逐层查询） ──
  const ancestorRes = await bridge.query(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id FROM tasks WHERE id = ? AND is_deleted = 0
       UNION ALL
       SELECT t.id, t.parent_id FROM tasks t
       INNER JOIN ancestors a ON t.id = a.parent_id
       WHERE t.is_deleted = 0
     )
     SELECT id, parent_id FROM ancestors`,
    ['tasks'],
    [taskId]
  );
  if (!ancestorRes.code === 1 || !ancestorRes.data?.length) throw new Error('任务不存在');
  const ancestorRows = (ancestorRes.data || []) as any[];
  const currentTask = { id: ancestorRows[0].id, parent_id: ancestorRows[0].parent_id } as { id: number; parent_id: number | null };
  const ancestorChain = ancestorRows.slice(1).map((r: any) => ({ id: r.id, parent_id: r.parent_id }));
  const ancestorIds = ancestorChain.map(a => a.id);

  // ── 第 2 步：获取所有后代 ID ──
  const descendantIds = await getDescendantIds(taskId);

  // ── 第 4 步：获取所有祖先的直接子任务（仅必要字段） ──
  const allAncestorChildrenMap = new Map<number, Task[]>();
  if (ancestorIds.length > 0) {
    const placeholders = ancestorIds.map(() => '?').join(',');
    const res = await bridge.query(
      `SELECT id, parent_id, status, progress FROM tasks WHERE parent_id IN (${placeholders}) AND is_deleted = 0 ORDER BY sort_order, created_at`,
      ['tasks'],
      ancestorIds
    );
    const allChildren = (res.data || []).map((row: any) => ({
      id: row.id,
      parent_id: row.parent_id,
      status: row.status as TaskStatus,
      progress: row.progress ?? 0,
    }));
    for (const aId of ancestorIds) {
      allAncestorChildrenMap.set(aId, allChildren.filter(c => c.parent_id === aId));
    }
  }

  // ── 第 5 步：计算每个祖先应有的 effectiveStatus 和 progress（从叶子到根） ──
  const statusMap: Record<number, TaskStatus> = {};
  const progressMap: Record<number, number> = {};

  // 当前任务与后代
  statusMap[taskId] = nextStatus;
  progressMap[taskId] = nextStatus === 'done' ? 100 : 0;
  for (const did of descendantIds) {
    statusMap[did] = nextStatus;
    progressMap[did] = nextStatus === 'done' ? 100 : 0;
  }

  // 祖先状态与进度：从最近的祖先开始向上计算
  for (const ancestor of ancestorChain) {
    const children = allAncestorChildrenMap.get(ancestor.id) || [];
    const effectiveChildren = children.map(c => ({
      ...c,
      status: statusMap[c.id] ?? c.status,
      progress: progressMap[c.id] ?? c.progress,
    }));
    const effectiveStatus = computeAggregateStatus(effectiveChildren);
    statusMap[ancestor.id] = effectiveStatus;
    const totalProgress = effectiveChildren.reduce((sum, c) => sum + (c.progress || 0), 0);
    progressMap[ancestor.id] = effectiveChildren.length > 0 ? Math.round(totalProgress / effectiveChildren.length) : 0;
  }

  // ── 第 6 步：构建事务操作列表 ──
  const ops: Array<{ sql: string; tables: string[]; params: any[] }> = [];

  // 6.1 更新当前任务
  ops.push({
    sql: `UPDATE tasks SET status = ?, progress = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
    tables: ['tasks'],
    params: [
      nextStatus,
      progressMap[taskId],
      nextStatus === 'done' ? ts : null,
      ts,
      taskId,
    ],
  });

  // 6.2 级联更新所有后代
  if (descendantIds.length > 0) {
    const placeholders = descendantIds.map(() => '?').join(',');
    ops.push({
      sql: `UPDATE tasks SET status = ?, progress = ?, completed_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
      tables: ['tasks'],
      params: [
        nextStatus,
        progressMap[taskId],
        nextStatus === 'done' ? ts : null,
        ts,
        ...descendantIds,
      ],
    });
  }

  // 6.3 批量更新祖先状态（CASE WHEN）
  if (ancestorIds.length > 0) {
    const statusCases = ancestorIds.map(id => `WHEN ${id} THEN '${statusMap[id]}'`).join(' ');
    ops.push({
      sql: `UPDATE tasks SET status = CASE id ${statusCases} END, updated_at = ? WHERE id IN (${ancestorIds.map(() => '?').join(',')})`,
      tables: ['tasks'],
      params: [ts, ...ancestorIds],
    });
  }

  // 6.4 批量重算祖先进度（已在第 5 步内存中计算完成，直接更新）
  if (ancestorIds.length > 0) {
    const progressCases = ancestorIds.map(id => `WHEN ${id} THEN ${progressMap[id]}`).join(' ');
    ops.push({
      sql: `UPDATE tasks SET progress = CASE id ${progressCases} END, updated_at = ? WHERE id IN (${ancestorIds.map(() => '?').join(',')})`,
      tables: ['tasks'],
      params: [ts, ...ancestorIds],
    });
  }

  // ── 第 7 步：执行事务 ──
  const txResult = await bridge.transaction(ops);
  if (txResult.code !== 1) {
    throw new Error(txResult.msg || '事务执行失败');
  }

  // ── 第 8 步：返回受影响数据 ──
  const updatedTaskIds = [taskId, ...descendantIds, ...ancestorIds];
  return { updatedTaskIds, statusMap, progressMap };
}

// ──────────────────────────────────────────────
// 导出统一接口
// ──────────────────────────────────────────────

export const db = {
  tasks: {
    list: listTasks,
    getById: getTaskById,
    create: createTask,
    update: updateTask,
    updateTaskTags, // ★ 新增
    softDelete: softDeleteTask,
    softDeleteRecursive: softDeleteTaskRecursive,
    getDescendantIds,
    hardDelete: hardDeleteTask,
    getSubtasks,
    getSubtaskCounts,
    getTree: getTaskTree,
    toggleAtomic,
  },
  tags: {
    list: listTags,
    create: createTag,
    delete: deleteTag,
  },
  taskTags: {
    set: setTaskTags,
    getByTask: getTagsByTaskId,
  },
  taskLogs: {
    list: getTaskLogs,
    create: createTaskLog,
    delete: deleteTaskLog,
  },
  attachments: {
    init: initAttachmentsTable,
    listByTask: getAttachmentsByTaskId,
    create: createAttachment,
    delete: deleteAttachment,
    getById: getAttachmentById,
  },
  stats: {
    get: getStats,
  },
  utils: {
    syncAncestorStatus,
    cascadeStatus,
    computeAggregateStatus,
    recalcProgressBatch,
  },
};