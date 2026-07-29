import { ref, computed, watch } from 'vue';
import { db } from '@/db';
import { TaskCache } from './useTaskCache';
import type { Task, TaskFilter, UpdateTaskInput, CreateTaskInput, TaskStatus } from '@/types';
import { DEFAULT_FILTER } from '@/types';

export function useTasks() {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref('');
  const filter = ref<TaskFilter>({ ...DEFAULT_FILTER });
  const editingId = ref<number | null>(null);
  const showCreator = ref(false);

  /** 前端缓存：维护任务图谱，用于乐观更新 */
  const cache = new TaskCache();

  /** 按筛选条件加载任务 */
  async function loadTasks() {
    loading.value = true;
    error.value = '';
    try {
      tasks.value = await db.tasks.list(filter.value);
      cache.init(tasks.value);
    } catch (e: any) {
      error.value = e.message || '加载任务失败';
      console.error('loadTasks error:', e);
    } finally {
      loading.value = false;
    }
  }

  /** 创建任务 */
  async function createTask(input: CreateTaskInput): Promise<Task | null> {
    const task = await db.tasks.create(input);
    if (task) {
      if (!input.parent_id) {
        await loadTasks();
      }
      showCreator.value = false;
    }
    return task;
  }

  /** 更新任务 */
  async function updateTask(id: number, input: UpdateTaskInput): Promise<boolean> {
    const ok = await db.tasks.update(id, input);
    if (ok) {
      const idx = tasks.value.findIndex(t => t.id === id);
      if (idx >= 0) {
        const updated = { ...tasks.value[idx], ...input, updated_at: new Date().toISOString() };
        if (input.status === 'done') {
          updated.completed_at = new Date().toISOString();
          updated.progress = 100;
        }
        if (input.status && input.status !== 'done' && tasks.value[idx].status === 'done') {
          updated.completed_at = null;
        }
        tasks.value = [...tasks.value.slice(0, idx), updated, ...tasks.value.slice(idx + 1)];
        // 同步缓存
        const cached = cache.get(id);
        if (cached) {
          Object.assign(cached, updated);
        }
      }
    }
    return ok;
  }

  /** 切换任务状态（快捷操作） */
  async function toggleStatus(task: Task) {
    if (task.status === 'done') {
      await updateTask(task.id, { status: 'todo', progress: 0, completed_at: null });
    } else {
      await updateTask(task.id, { status: 'done', progress: 100, completed_at: new Date().toISOString() });
    }
  }

  /** 状态循环：todo → doing → done → todo，cancelled → todo */
  async function cycleStatus(task: Task, targetStatus?: TaskStatus): Promise<boolean> {
    const nextStatus = targetStatus || (() => {
      const next: Record<TaskStatus, TaskStatus> = {
        todo: 'doing',
        doing: 'done',
        done: 'todo',
        cancelled: 'todo',
      };
      return next[task.status];
    })();

    // 1. 乐观计算：纯前端计算所有受影响的任务及预期状态
    const expected = cache.computeCascade(task.id, nextStatus);
    const now = new Date().toISOString();

    // 2. 乐观更新缓存
    cache.applyCascade(expected, now);

    // 3. 乐观更新 UI（局部 patch，避免全量重渲染）
    cache.patchArray(tasks.value, expected, now);

    // 4. 后台同步数据库（保证最终一致性）
    try {
      const dbResult = await db.tasks.toggleAtomic(task.id, nextStatus);
      // 5. 以数据库返回结果修正缓存（处理并发修改场景）
      cache.applyDbResult(dbResult, now);
      cache.patchArray(tasks.value, dbResult, now);
    } catch (e) {
      console.error('cycleStatus optimistic update failed, rollback:', e);
      // 失败回滚：重新从数据库加载最新状态
      await loadTasks();
      return false;
    }

    return true;
  }

  /** 删除任务 */
  async function deleteTask(id: number) {
    const ok = await db.tasks.softDelete(id);
    if (ok) {
      tasks.value = tasks.value.filter(t => t.id !== id);
    }
    return ok;
  }

  /** 局部替换单个任务（保持响应式） */
  function patchTask(updated: Task) {
    const idx = tasks.value.findIndex(t => t.id === updated.id);
    if (idx >= 0) {
      tasks.value = [
        ...tasks.value.slice(0, idx),
        updated,
        ...tasks.value.slice(idx + 1)
      ];
    }
  }

  /** 批量替换任务 */
  function patchTasks(updates: Task[]) {
    const map = new Map(updates.map(t => [t.id, t]));
    tasks.value = tasks.value.map(t => map.get(t.id) ? { ...t, ...map.get(t.id)! } : t);
  }

  /** 递归删除任务及其所有子任务 */
  async function deleteTaskRecursive(id: number) {
    const deletedIds = await db.tasks.softDeleteRecursive(id);
    if (deletedIds.length > 0) {
      tasks.value = tasks.value.filter(t => !deletedIds.includes(t.id));
    }
    return deletedIds.length > 0;
  }

  /** 设置筛选 */
  function setFilter(partial: Partial<TaskFilter>) {
    Object.assign(filter.value, partial);
    loadTasks();
  }

  /** 开始编辑 */
  function startEdit(id: number) {
    editingId.value = id;
  }

  /** 取消编辑 */
  function cancelEdit() {
    editingId.value = null;
  }

  /** 刷新 */
  function refresh() {
    loadTasks();
  }

  // 初始加载
  loadTasks();

  return {
    tasks,
    loading,
    error,
    filter,
    editingId,
    showCreator,
    loadTasks,
    createTask,
    updateTask,
    toggleStatus,
    cycleStatus,
    deleteTask,
    deleteTaskRecursive,
    patchTask,
    patchTasks,
    setFilter,
    startEdit,
    cancelEdit,
    refresh,
  };
}