/**
 * 前端任务缓存层
 *
 * 职责：
 * 1. 维护任务 ID 映射、父子关系索引
 * 2. 纯前端计算级联状态/进度变更（乐观更新）
 * 3. 不依赖 Vue，纯 TS 逻辑，与 UI 层隔离
 */

import type { Task, TaskStatus } from '@/types';

export interface CascadeResult {
  updatedIds: number[];
  statusMap: Record<number, TaskStatus>;
  progressMap: Record<number, number>;
}

export class TaskCache {
  private byId = new Map<number, Task>();
  private childrenMap = new Map<number, Task[]>();
  private parentMap = new Map<number, number>();

  /** 初始化/重建缓存 */
  init(tasks: Task[]) {
    this.byId.clear();
    this.childrenMap.clear();
    this.parentMap.clear();
    for (const t of tasks) {
      this.byId.set(t.id, { ...t, tags: t.tags ? [...t.tags] : undefined });
      if (t.parent_id) {
        this.parentMap.set(t.id, t.parent_id);
        const siblings = this.childrenMap.get(t.parent_id) || [];
        siblings.push({ ...t, tags: t.tags ? [...t.tags] : undefined });
        this.childrenMap.set(t.parent_id, siblings);
      }
    }
  }

  get(id: number): Task | undefined {
    return this.byId.get(id);
  }

  getChildren(parentId: number): Task[] {
    return this.childrenMap.get(parentId) || [];
  }

  getParent(taskId: number): Task | undefined {
    const pid = this.parentMap.get(taskId);
    if (pid === undefined) return undefined;
    return this.byId.get(pid);
  }

  getAncestors(taskId: number): Task[] {
    const ancestors: Task[] = [];
    let current = this.getParent(taskId);
    while (current) {
      ancestors.push(current);
      current = this.getParent(current.id);
    }
    return ancestors;
  }

  getDescendants(taskId: number): Task[] {
    const result: Task[] = [];
    const stack = [taskId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      const children = this.childrenMap.get(id) || [];
      for (const child of children) {
        result.push(child);
        stack.push(child.id);
      }
    }
    return result;
  }

  computeEffectiveStatus(children: Task[]): TaskStatus {
    if (!children.length) return 'todo';
    let hasDone = false;
    let hasDoing = false;
    let hasTodo = false;
    let hasCancelled = false;
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
   * 纯计算：给定任务 ID 与目标状态，返回所有受影响的任务 ID 及预期状态/进度
   * 不修改缓存本身，供乐观更新使用
   */
  computeCascade(taskId: number, nextStatus: TaskStatus): CascadeResult {
    const progress = nextStatus === 'done' ? 100 : 0;
    const updatedIds: number[] = [];
    const statusMap: Record<number, TaskStatus> = {};
    const progressMap: Record<number, number> = {};

    // 当前任务
    statusMap[taskId] = nextStatus;
    progressMap[taskId] = progress;
    updatedIds.push(taskId);

    // 所有后代
    const descendants = this.getDescendants(taskId);
    for (const desc of descendants) {
      statusMap[desc.id] = nextStatus;
      progressMap[desc.id] = progress;
      updatedIds.push(desc.id);
    }

    // 所有祖先：从最近 ancestor 开始逐层向上
    const ancestors = this.getAncestors(taskId);
    for (const ancestor of ancestors) {
      const children = this.getChildren(ancestor.id);
      const effectiveChildren = children.map((c) => ({
        ...c,
        status: statusMap[c.id] ?? c.status,
        progress: progressMap[c.id] ?? c.progress,
      }));
      const effectiveStatus = this.computeEffectiveStatus(effectiveChildren);
      const totalProgress = effectiveChildren.reduce(
        (sum, c) => sum + (c.progress || 0),
        0
      );
      const avgProgress =
        effectiveChildren.length > 0
          ? Math.round(totalProgress / effectiveChildren.length)
          : 0;

      statusMap[ancestor.id] = effectiveStatus;
      progressMap[ancestor.id] = avgProgress;
      updatedIds.push(ancestor.id);
    }

    return { updatedIds, statusMap, progressMap };
  }

  /**
   * 将计算结果应用到缓存（乐观更新）
   */
  applyCascade(result: CascadeResult, now: string) {
    for (const id of result.updatedIds) {
      const task = this.byId.get(id);
      if (!task) continue;
      const status = result.statusMap[id];
      task.status = status;
      task.progress = result.progressMap[id];
      task.updated_at = now;
      if (status === 'done') {
        task.completed_at = now;
      } else {
        task.completed_at = null;
      }
    }
  }

  /** 用数据库返回结果修正缓存（数据库为最终一致性来源） */
  applyDbResult(result: {
    updatedTaskIds: number[];
    statusMap: Record<number, TaskStatus>;
    progressMap: Record<number, number>;
  }, now: string) {
    for (const id of result.updatedTaskIds) {
      const task = this.byId.get(id);
      if (!task) continue;
      const status = result.statusMap[id];
      task.status = status;
      task.progress = result.progressMap[id];
      task.updated_at = now;
      if (status === 'done') {
        task.completed_at = now;
      } else {
        task.completed_at = null;
      }
    }
  }

  /** 从缓存重建任务数组（保持响应式引用稳定） */
  syncToArray(tasksRef: Task[]) {
    const next = this.getAllTasks();
    tasksRef.length = 0;
    tasksRef.push(...next);
  }

  /** 局部刷新：仅替换受影响的 task */
  patchArray(tasksRef: Task[], result: CascadeResult, now: string) {
    const map = new Map<number, Task>();
    for (const id of result.updatedIds) {
      const src = this.byId.get(id);
      if (src) {
        map.set(id, { ...src, tags: src.tags ? [...src.tags] : undefined });
      }
    }
    for (let i = 0; i < tasksRef.length; i++) {
      const patch = map.get(tasksRef[i].id);
      if (patch) {
        tasksRef[i] = patch;
      }
    }
  }

  getAllTasks(): Task[] {
    return Array.from(this.byId.values());
  }
}
