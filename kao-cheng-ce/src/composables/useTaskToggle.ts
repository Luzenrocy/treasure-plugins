import { useTasks } from './useTasks';
import { db } from '@/db';
import { STATUS_CONFIG } from '@/types';
import type { Task, TaskStatus, ToggleTaskResult } from '@/types';
import { ElMessageBox, ElMessage } from 'element-plus';
import type { Ref } from 'vue';

export function useTaskToggle(tasksHook?: ReturnType<typeof useTasks>, subtaskMap?: Ref<Record<number, Task[]>>) {
  const hook = tasksHook || useTasks();
  const tasks = hook.tasks;

  // 防重复提交：记录每个任务最后一次 toggle 的目标状态
  const pendingToggleStatus = new Map<number, TaskStatus>();

  async function confirmCascade(task: Task, children?: Task[]): Promise<boolean> {
    if (!children) {
      children = await db.tasks.getSubtasks(task.id);
    }
    if (children.length === 0) return true;

    const next: Record<TaskStatus, TaskStatus> = {
      todo: 'doing',
      doing: 'done',
      done: 'todo',
      cancelled: 'todo',
    };
    const nextStatus = next[task.status];
    const statusLabel = STATUS_CONFIG[nextStatus]?.label || nextStatus;

    const needChange = children.filter(c => c.status !== nextStatus);
    if (needChange.length === 0) return true;

    const names = needChange.slice(0, 5).map(c => `"${c.title}"`).join('、');
    const suffix = needChange.length > 5 ? `等 ${needChange.length} 个子任务` : '';
    const msg = `子任务 ${names}${suffix} 的状态将更新为「${statusLabel}」，是否继续？`;

    try {
      await ElMessageBox.confirm(msg, '确认级联操作', {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      });
      return true;
    } catch {
      return false;
    }
  }

  async function recalcAncestorProgressOptimized(taskId: number) {
    const task = await db.tasks.getById(taskId);
    if (!task || !task.parent_id) return;

    const ancestorIds: number[] = [];
    let current: Task | null = task;
    while (current && current.parent_id) {
      ancestorIds.push(current.parent_id);
      current = await db.tasks.getById(current.parent_id);
    }

    if (!ancestorIds.length) return;

    await db.utils.recalcProgressBatch(ancestorIds);

    for (const ancestorId of ancestorIds) {
      const fresh = await db.tasks.getById(ancestorId);
      if (fresh) {
        const idx = tasks.value.findIndex(t => t.id === ancestorId);
        if (idx >= 0) {
          tasks.value = [
            ...tasks.value.slice(0, idx),
            fresh,
            ...tasks.value.slice(idx + 1),
          ];
        }
      }
    }
  }

  /**
   * 乐观更新：立即修改前端状态，后台静默持久化
   * 点击后零延迟响应，DB 操作和状态校准全部后台执行
   */
  async function toggle(task: Task, options: {
    skipCascade?: boolean;
    skipAncestorProgress?: boolean;
    onAfterReload?: () => Promise<void>;
  } = {}): Promise<boolean> {
    const { skipCascade, skipAncestorProgress, onAfterReload } = options;

    // 1. 计算目标状态
    const next: Record<TaskStatus, TaskStatus> = {
      todo: 'doing',
      doing: 'done',
      done: 'todo',
      cancelled: 'todo',
    };
    const nextStatus = next[task.status];

    // 2. 乐观更新 UI（同步执行，用户立即看到状态变化）
    applyOptimisticUpdate(task.id, nextStatus);

    // 3. 后台处理级联确认（若有子任务，弹窗确认；用户取消则回滚）
    if (!skipCascade) {
      const children = getDirectChildrenFromMemory(task.id);
      if (children.length > 0) {
        // 等待用户确认（这是唯一需要等待的用户交互）
        const confirmed = await confirmCascade(task, children);
        if (!confirmed) {
          rollbackOptimisticUpdate(task.id);
          return false;
        }
      }
    }

    // 4. 后台执行原子操作（不阻塞 UI，完成后校准前端）
    // 记录本次操作的目标状态，用于防重复提交
    pendingToggleStatus.set(task.id, nextStatus);
    
    db.tasks.toggleAtomic(task.id, nextStatus)
      .then(result => {
        // 检查是否有更新的 toggle 操作（用户可能快速点击了多次）
        const latestStatus = pendingToggleStatus.get(task.id);
        if (latestStatus !== nextStatus) {
          // 有更新的操作，本次结果可能过时，不 reconcile
          // 等待最后一次 toggleAtomic 完成后处理
          return;
        }
        reconcileStore(result);
        onAfterReload?.().catch(() => {});
      })
      .catch(e => {
        // 只有当前操作仍是最新的才回滚
        const latestStatus = pendingToggleStatus.get(task.id);
        if (latestStatus === nextStatus) {
          rollbackOptimisticUpdate(task.id);
          ElMessage.error(e.message || '状态切换失败');
        }
      })
      .finally(() => {
        pendingToggleStatus.delete(task.id);
      });

    // 5. 立即返回，不等 DB 完成
    return true;
  }

  /** 从内存中获取任务的直接子任务（优先 subtaskMap，其次 tasks 数组） */
  function getDirectChildrenFromMemory(parentId: number): Task[] {
    const fromMap = subtaskMap?.value?.[parentId];
    if (fromMap?.length) return fromMap;
    return tasks.value.filter(t => t.parent_id === parentId);
  }

  /** 乐观更新：只修改变化的元素，避免全量 map 导致全部组件 re-render */
  function applyOptimisticUpdate(taskId: number, nextStatus: TaskStatus) {
    const progress = nextStatus === 'done' ? 100 : 0;
    const completedAt = nextStatus === 'done' ? new Date().toISOString() : null;
    const now = new Date().toISOString();

    // 收集所有需要更新的 ID（当前任务 + 所有后代）
    const idsToUpdate = new Set<number>([taskId]);

    // 递归收集后代
    function collectDescendants(parentId: number) {
      const children = tasks.value.filter(t => t.parent_id === parentId);
      for (const child of children) {
        idsToUpdate.add(child.id);
        collectDescendants(child.id);
      }
    }
    collectDescendants(taskId);

    // 只更新变化的元素，避免全量 map 导致全部组件 re-render
    const arr = tasks.value;
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i];
      if (idsToUpdate.has(t.id)) {
        const updated: Task = { ...t, status: nextStatus, progress, updated_at: now };
        if (nextStatus === 'done') {
          updated.completed_at = completedAt;
        } else if (t.status === 'done') {
          updated.completed_at = null;
        }
        arr[i] = updated;
      }
    }

    // 同步更新 subtaskMap，确保 TaskItem displayStatus 立即重算
    if (subtaskMap) {
      const map = subtaskMap.value;
      for (const [parentId, children] of Object.entries(map)) {
        let changed = false;
        const nextChildren: Task[] = [];
        for (const c of children) {
          if (!idsToUpdate.has(c.id)) {
            nextChildren.push(c);
            continue;
          }
          changed = true;
          const updated: Task = { ...c, status: nextStatus, progress, updated_at: now };
          if (nextStatus === 'done') {
            updated.completed_at = completedAt;
          } else if (c.status === 'done') {
            updated.completed_at = null;
          }
          nextChildren.push(updated);
        }
        if (changed) {
          map[Number(parentId)] = nextChildren;
        }
      }
    }
  }

  /** 用 DB 返回的权威数据校准前端（只更新变化元素，避免全量 re-render） */
  function reconcileStore(result: ToggleTaskResult) {
    const { updatedTaskIds, statusMap, progressMap } = result;
    const now = new Date().toISOString();

    const arr = tasks.value;
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i];
      if (!updatedTaskIds.includes(t.id)) continue;
      const newStatus = statusMap[t.id] ?? t.status;
      const newProgress = progressMap[t.id] ?? t.progress;
      const updated: Task = { ...t, status: newStatus, progress: newProgress, updated_at: now };
      if (newStatus === 'done') {
        updated.completed_at = now;
      } else if (t.status === 'done' && newStatus !== 'done') {
        updated.completed_at = null;
      }
      arr[i] = updated;
    }

    // 同步校准 subtaskMap
    if (subtaskMap) {
      const map = subtaskMap.value;
      for (const [parentId, children] of Object.entries(map)) {
        let changed = false;
        const nextChildren: Task[] = [];
        for (const c of children) {
          if (!updatedTaskIds.includes(c.id)) {
            nextChildren.push(c);
            continue;
          }
          changed = true;
          const newStatus = statusMap[c.id] ?? c.status;
          const newProgress = progressMap[c.id] ?? c.progress;
          const updated: Task = { ...c, status: newStatus, progress: newProgress, updated_at: now };
          if (newStatus === 'done') {
            updated.completed_at = now;
          } else if (c.status === 'done' && newStatus !== 'done') {
            updated.completed_at = null;
          }
          nextChildren.push(updated);
        }
        if (changed) {
          map[Number(parentId)] = nextChildren;
        }
      }
    }
  }

  /** 回滚乐观更新 */
  function rollbackOptimisticUpdate(taskId: number) {
    // 重新加载任务列表以恢复一致状态
    hook.loadTasks();
  }

  return { toggle, confirmCascade, recalcAncestorProgressOptimized };
}
