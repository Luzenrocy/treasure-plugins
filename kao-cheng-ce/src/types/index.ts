/** 优先级：P0 紧急重要 — P3 低优 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/** 任务状态 */
export type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';

/** 任务实体 */
export interface Task {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;       // 0-100
  due_date: string | null; // ISO 8601
  start_date: string | null; // ISO 8601 ★ 新增
  parent_id: number | null;
  sort_order: number;
  is_deleted: number;     // 0 | 1
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** 关联标签（联表查询时填充） */
  tags?: Tag[];
  /** 关联附件（联表查询时填充） */
  attachments?: TaskAttachment[];
}

/** 创建任务输入 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  progress?: number;
  due_date?: string | null;
  start_date?: string | null;  // ★ 新增
  parent_id?: number | null;
  tag_ids?: number[];
}

/** 更新任务输入 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  progress?: number;
  due_date?: string | null;
  start_date?: string | null;  // ★ 新增
  parent_id?: number | null;
  sort_order?: number;
  completed_at?: string | null;
}

/** 标签实体 */
export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at?: string;       // ★ 新增
  /** 关联任务数（统计时填充） */
  task_count?: number;
}

/** 任务处理记录 */
export interface TaskLog {
  id: number;
  task_id: number;
  content: string;
  log_date: string;         // YYYYMMDD
  sort_order: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

/** 创建处理记录输入 */
export interface CreateTaskLogInput {
  content: string;
  log_date: string;
  sort_order?: number;
}

/** 任务筛选条件 */
export interface TaskFilter {
  status?: TaskStatus | 'all';
  priority?: Priority | 'all';
  tag_id?: number | null;
  search?: string;
  sort_by?: 'created_at' | 'due_date' | 'priority' | 'sort_order';
  sort_order?: 'asc' | 'desc';
}

/** 侧边栏统计 */
export interface SidebarStats {
  total: number;
  todo: number;
  doing: number;
  done: number;
  cancelled: number;
  overdue: number;
}

/** 任务-标签关联 */
export interface TaskTag {
  task_id: number;
  tag_id: number;
}

/** 任务附件 */
export interface TaskAttachment {
  id: number;
  task_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

/** 数据库响应包装 */
export interface DbResponse<T = any> {
  code: number;
  msg?: string;
  data?: T;
}

/** 默认筛选 */
export const DEFAULT_FILTER: TaskFilter = {
  status: 'all',
  priority: 'all',
  tag_id: null,
  search: '',
  sort_by: 'created_at',
  sort_order: 'desc',
};

/** 优先级标签配置 */
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  P0: { label: 'P0', color: '#d36c6c', bg: '#fcf5f5' },
  P1: { label: 'P1', color: '#f97316', bg: '#fff7ed' },
  P2: { label: 'P2', color: '#6366f1', bg: '#eef2ff' },
  P3: { label: 'P3', color: '#9ca3af', bg: '#f9fafb' },
};

/** 状态标签配置 */
export const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: string; color: string }> = {
  todo:      { label: '待办',   icon: 'circle',         color: '#9ca3af' },
  doing:     { label: '进行中', icon: 'loading',        color: '#6366f1' },
  done:      { label: '已完成', icon: 'circle-check',   color: '#22c55e' },
  cancelled: { label: '已取消', icon: 'circle-close',   color: '#d1d5db' },
};