<template>
  <div class="app-container" @keydown.esc="handleEsc">
    <div class="app-panel">
      <Sidebar
        :collapsed="sidebarCollapsed"
        :tags="tagsHook.tags.value"
        :stats="statsHook.stats.value"
        :current-filter="currentStatusFilter"
        :active-tag-id="activeTagId"
        @toggle="sidebarCollapsed = !sidebarCollapsed"
        @filter="handleStatusFilter"
        @filter-tag="handleTagFilter"
        @create-tag="handleCreateTag"
        @delete-tag="handleDeleteTag"
      />
      <div class="main-content">
        <div class="top-bar">
          <div class="top-bar-left">
            <span class="top-bar-title">任务</span>
            <span class="filter-indicator" v-if="currentStatusFilter !== 'all' || activeTagId != null">
              <span v-if="currentStatusFilter !== 'all'">{{ statusLabel }}</span>
              <span v-if="activeTagId != null && tagsHook.getTagById(activeTagId)" class="filter-tag">
                &middot; #{{ tagsHook.getTagById(activeTagId)?.name }}
              </span>
            </span>
          </div>
          <div class="top-bar-actions">
            <!-- 视图切换 -->
            <div class="view-toggle">
              <button class="view-btn" :class="{ active: viewMode === 'list' }" title="列表视图" @click="viewMode = 'list'">
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
              <button class="view-btn" :class="{ active: viewMode === 'kanban' }" title="看板视图" @click="viewMode = 'kanban'">
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><rect x="3" y="3" width="7" height="18" rx="1" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="12" rx="1" stroke="currentColor" stroke-width="2"/></svg>
              </button>
            </div>
            <div class="search-box">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14" class="search-icon"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              <input v-model="searchQuery" class="search-input" placeholder="搜索任务..." @input="handleSearch" />
            </div>
            <button class="create-btn" @click="showCreateForm()">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              新建任务
            </button>
          </div>
        </div>

        <TaskCreatorModal
          v-if="showCreator"
          :tags="tagsHook.tags.value"
          :on-create-tag="tagsHook.createTag"
          @create="handleCreate"
          @cancel="showCreator = false"
        />

        <!-- 看板视图 -->
        <div v-if="viewMode === 'kanban'" class="kanban-area">
        <KanbanBoard
          :tasks="tasksHook.tasks.value"
          :subtask-counts="subtaskCounts"
          :attachment-counts="attachmentCounts"
          :all-tags="tagsHook.tags.value"
          :on-create-tag="tagsHook.createTag"
          :on-update-tags="handleUpdateTags"
          @toggle="handleListToggle"
          @view="handleView"
          @move="handleMove"
        />
        </div>

        <!-- 列表视图 -->
        <TaskList
          v-else
          :tasks="tasksHook.tasks.value"
          :loading="tasksHook.loading.value"
          :subtask-counts="subtaskCounts"
          :subtask-map="subtaskMap"
          :attachment-counts="attachmentCounts"
          :tags="tagsHook.tags.value"
          :on-create-tag="tagsHook.createTag"
          :on-update-tags="handleUpdateTags"
          @toggle="handleListToggle"
          @view="handleView"
          @edit="handleEdit"
          @delete="handleDelete"
          @add-subtask="handleAddSubtask"
        />
      </div>
    </div>

    <TaskDetailDrawer
      v-if="detailDrawerTask"
      :task="detailDrawerTask"
      :visible="!!detailDrawerTask"
      :subtask-reload-trigger="drawerSubtaskReloadTrigger"
      :all-tags="tagsHook.tags.value"
      :on-create-tag="tagsHook.createTag"
      @close="detailDrawerTask = null"
      @edit="handleDrawerEdit"
      @delete="handleDrawerDelete"
      @toggle="handleDrawerToggle"
      @view-subtask="handleViewSubtask"
      @add-subtask="handleAddSubtask"
      @tags-updated="handleDrawerTagsUpdated"
    />
    <StatsBar :stats="statsHook.stats.value" />

    <!-- 编辑任务弹窗 -->
    <div v-if="showEditor" class="editor-overlay" @click.self="closeEditor">
      <div class="editor-panel">
        <TaskEditor
          :task="editingTask"
          :tags="tagsHook.tags.value"
          @save="handleEditorSave"
          @cancel="closeEditor"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import Sidebar from './components/Sidebar.vue';
import TaskList from './components/TaskList.vue';
import TaskCreatorModal from './components/TaskCreatorModal.vue';
import TaskEditor from './components/TaskEditor.vue';
import TaskDetailDrawer from './components/TaskDetailDrawer.vue';
import StatsBar from './components/StatsBar.vue';
import KanbanBoard from './components/KanbanBoard.vue';
import { useTasks } from './composables/useTasks';
import { useTags } from './composables/useTags';
import { useStats } from './composables/useStats';
import { useTaskToggle } from './composables/useTaskToggle';
import { db } from '@/db';
import { STATUS_CONFIG } from '@/types';
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@/types';

const tasksHook = useTasks();
const tagsHook = useTags();
const statsHook = useStats();

const sidebarCollapsed = ref(false);
const searchQuery = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const viewMode = ref<'list' | 'kanban'>('list');
const showCreator = ref(false);
const createSubtaskParent = ref<number | null>(null);

const currentStatusFilter = ref<TaskStatus | 'all' | 'overdue'>('all');
const activeTagId = ref<number | null>(null);

const statusLabel = computed(() => {
  if (currentStatusFilter.value === 'all') return '全部';
  if (currentStatusFilter.value === 'overdue') return '已逾期';
  return STATUS_CONFIG[currentStatusFilter.value as TaskStatus]?.label || '';
});

const detailDrawerTask = ref<Task | null>(null);
const showEditor = ref(false);
const editingTask = ref<Task | null>(null);
const subtaskCounts = ref<Record<number, number>>({});
const subtaskMap = ref<Record<number, Task[]>>({});
const attachmentCounts = ref<Record<number, number>>({});
const drawerSubtaskReloadTrigger = ref(0);
let _skipFullSubtaskReload = false;

const toggleHook = useTaskToggle(tasksHook, subtaskMap);

// 递归加载所有层级的子任务数据（增量更新，避免中间态清空导致折叠）
async function loadSubtasks() {
  const taskIds = tasksHook.tasks.value.filter(t => !t.parent_id).map(t => t.id);
  if (!taskIds.length) {
    subtaskCounts.value = {};
    subtaskMap.value = {};
    return;
  }
  const newCounts: Record<number, number> = {};
  const newMap: Record<number, Task[]> = {};
  await loadSubtasksRecursive(taskIds, newCounts, newMap);
  subtaskCounts.value = newCounts;
  subtaskMap.value = newMap;
}

async function loadSubtasksRecursive(parentIds: number[], counts: Record<number, number>, map: Record<number, Task[]>) {
  if (!parentIds.length) return;
  const res = await db.tasks.getSubtaskCounts(parentIds);
  Object.assign(counts, res);
  const nextIds: number[] = [];
  for (const pid of parentIds) {
    if (res[pid]) {
      map[pid] = await db.tasks.getSubtasks(pid);
      for (const child of map[pid]) {
        nextIds.push(child.id);
      }
    }
  }
  if (nextIds.length) {
    await loadSubtasksRecursive(nextIds, counts, map);
  }
}

async function loadAttachmentCounts(taskIds: number[]) {
  if (!taskIds.length) {
    attachmentCounts.value = {};
    return;
  }
  const counts: Record<number, number> = {};
  for (const id of taskIds) {
    const list = await db.attachments.listByTask(id);
    if (list.length) counts[id] = list.length;
  }
  attachmentCounts.value = counts;
}

// 加载特定任务的子任务（同时更新计数）
async function loadSubtasksFor(taskId: number) {
  subtaskMap.value[taskId] = await db.tasks.getSubtasks(taskId);
  const counts = await db.tasks.getSubtaskCounts([taskId]);
  if (counts[taskId] !== undefined) {
    subtaskCounts.value[taskId] = counts[taskId];
  } else {
    delete subtaskCounts.value[taskId];
  }
}

// 筛选处理
function handleStatusFilter(status: TaskStatus | 'all' | 'overdue') {
  currentStatusFilter.value = status;
  activeTagId.value = null;
  applyFilter();
}

function handleTagFilter(tagId: number) {
  activeTagId.value = tagId;
  applyFilter();
}

function applyFilter() {
  if (currentStatusFilter.value === 'all' || currentStatusFilter.value === 'overdue') {
    tasksHook.setFilter({ status: 'all' });
  } else {
    tasksHook.setFilter({ status: currentStatusFilter.value as TaskStatus });
  }
  tasksHook.setFilter({ tag_id: activeTagId.value });
}

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    tasksHook.setFilter({ search: searchQuery.value || '' });
  }, 300);
}

async function handleView(id: number) {
  showCreator.value = false;
  showEditor.value = false;
  const task = await db.tasks.getById(id);
  if (task) detailDrawerTask.value = task;
}

async function handleEdit(id: number) {
  const task = await db.tasks.getById(id);
  if (task) {
    detailDrawerTask.value = null;
    editingTask.value = { ...task };
    showEditor.value = true;
  }
}

async function handleDrawerEdit(id: number) {
  const task = await db.tasks.getById(id);
  if (task) {
    editingTask.value = { ...task };
    showEditor.value = true;
  }
}

async function handleViewSubtask(id: number) {
  const task = await db.tasks.getById(id);
  if (task) {
    detailDrawerTask.value = task;
  }
}

function closeEditor() {
  showEditor.value = false;
  editingTask.value = null;
}

async function handleEditorSave(id: number, input: UpdateTaskInput) {
  const ok = await tasksHook.updateTask(id, input);
  if (ok) {
    ElMessage.success('已保存');
    closeEditor();
    statsHook.loadStats();
    loadSubtasks();
  } else {
    ElMessage.error('保存失败');
  }
}

async function handleListToggle(task: Task) {
  await toggleHook.toggle(task, {
    onAfterReload: async () => {
      if (_subtaskTimer) {
        clearTimeout(_subtaskTimer);
        _subtaskTimer = null;
      }
      // 乐观更新已同步 tasks 与 subtaskMap，此处仅刷新统计
      statsHook.loadStats();
    },
  });
}

async function handleDrawerToggle(task: Task) {
  await toggleHook.toggle(task, {
    onAfterReload: async () => {
      if (_subtaskTimer) {
        clearTimeout(_subtaskTimer);
        _subtaskTimer = null;
      }
      // 直接从 tasksHook 中获取最新状态，无需再次查询 DB
      if (detailDrawerTask.value) {
        const updated = tasksHook.tasks.value.find(t => t.id === detailDrawerTask.value!.id);
        if (updated) detailDrawerTask.value = { ...updated };
      }
      drawerSubtaskReloadTrigger.value++;
      // 乐观更新已同步 tasks 与 subtaskMap，此处仅刷新统计
      statsHook.loadStats();
    },
  });
}

/** 跳过子任务直接切换状态（不弹窗不级联） */
async function handleForceToggle(task: Task) {
  const next: Record<TaskStatus, TaskStatus> = {
    todo: 'doing',
    doing: 'done',
    done: 'todo',
    cancelled: 'todo',
  };
  const nextStatus = next[task.status];
  await tasksHook.updateTask(task.id, {
    status: nextStatus,
    ...(nextStatus === 'done' ? { progress: 100 } : nextStatus === 'todo' ? { progress: 0 } : {}),
  });
  if (task.parent_id) {
    await db.utils.syncAncestorStatus(task.id);
    await toggleHook.recalcAncestorProgressOptimized(task.id);
  }
  await tasksHook.loadTasks();
  if (detailDrawerTask.value?.id === task.id) {
    const updated = tasksHook.tasks.value.find(t => t.id === task.id);
    if (updated) detailDrawerTask.value = { ...updated };
  }
  if (detailDrawerTask.value) {
    const fresh = await db.tasks.getById(detailDrawerTask.value.id);
    if (fresh) detailDrawerTask.value = { ...fresh };
    drawerSubtaskReloadTrigger.value++;
  }
  statsHook.loadStats();
  loadSubtasks();
}

async function handleDrawerDelete(id: number) {
  try {
    const subtaskCount = subtaskCounts.value[id] || 0;
    let confirmMsg = '确定要删除此任务吗？';
    if (subtaskCount > 0) {
      confirmMsg = `此任务包含 ${subtaskCount} 个子任务，是否连同子任务一起删除？`;
    }
    await ElMessageBox.confirm(confirmMsg, '删除确认', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
    const ok = subtaskCount > 0
      ? await tasksHook.deleteTaskRecursive(id)
      : await tasksHook.deleteTask(id);
    if (ok) {
      ElMessage.success('已删除');
      detailDrawerTask.value = null;
      await statsHook.loadStats();
      await tagsHook.loadTags();
      loadSubtasks();
    }
  } catch (e) { /* cancelled */ }
}

async function handleDelete(id: number) {
  try {
    // 查找父任务 ID（用于后续刷新子列表）
    let parentId: number | null = null;
    for (const [pid, children] of Object.entries(subtaskMap.value)) {
      if (children.some(c => c.id === id)) { parentId = Number(pid); break; }
    }

    const subtaskCount = subtaskCounts.value[id] || 0;
    let confirmMsg = '确定要删除此任务吗？';
    if (subtaskCount > 0) {
      confirmMsg = `此任务包含 ${subtaskCount} 个子任务，是否连同子任务一起删除？`;
    }
    await ElMessageBox.confirm(confirmMsg, '删除确认', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });

    // 对于非根任务，标记跳过全量子任务重载，由后续 loadSubtasksFor 单独更新父任务
    if (parentId) _skipFullSubtaskReload = true;

    const ok = subtaskCount > 0
      ? await tasksHook.deleteTaskRecursive(id)
      : await tasksHook.deleteTask(id);
    if (ok) {
      ElMessage.success('已删除');
      await statsHook.loadStats();
      await tagsHook.loadTags();
      _skipFullSubtaskReload = false;
      if (parentId) loadSubtasksFor(parentId);
      else loadSubtasks();
    }
  } catch (e) { /* cancelled */ }
}

// CRUD
function showCreateForm() {
  detailDrawerTask.value = null;
  createSubtaskParent.value = null;
  showCreator.value = true;
}

async function handleCreate(input: CreateTaskInput, files: File[] = []) {
  // 注入子任务 parent_id
  const finalInput = createSubtaskParent.value
    ? { ...input, parent_id: createSubtaskParent.value }
    : input;
  const parentId = createSubtaskParent.value;
  createSubtaskParent.value = null;

  const task = await tasksHook.createTask(finalInput);
  if (task) {
    ElMessage.success('任务已创建');

    // 上传附件
    if (files.length && task.id) {
      for (const f of files) {
        if (f.size > 10 * 1024 * 1024) {
          ElMessage.error(`文件 ${f.name} 超过 10MB 限制`);
          continue;
        }
        await db.attachments.create(task.id, f);
      }
      loadAttachmentCounts([task.id]);
      if (detailDrawerTask.value?.id === task.id) {
        const fresh = await db.tasks.getById(task.id);
        if (fresh) detailDrawerTask.value = { ...fresh };
      }
    }

    showCreator.value = false;
    statsHook.loadStats();
    tagsHook.loadTags();
    if (parentId) {
      loadSubtasksFor(parentId);
      // 如果抽屉正在显示且创建的是子任务，触发抽屉重载整个子树
      if (detailDrawerTask.value && parentId) {
        drawerSubtaskReloadTrigger.value++;
      }
    } else {
      loadSubtasks();
    }
  } else {
    ElMessage.error(`创建失败：${db.tasks.getLastCreateError() || '请查看宿主日志'}`);
  }
}

async function handleAddSubtask(parentId: number) {
  createSubtaskParent.value = parentId;
  showCreator.value = true;
}

// Kanban 拖拽移动
async function handleMove(taskId: number, status: TaskStatus) {
  const ok = await tasksHook.updateTask(taskId, { status, progress: status === 'done' ? 100 : undefined });
  if (ok) {
    statsHook.loadStats();
  }
}

// ★ 新增：标签变更处理
async function handleUpdateTags(taskId: number, tagIds: number[], updatedTask: Task) {
  tasksHook.patchTask(updatedTask);
  
  // 同步更新 subtaskMap（子任务标签）
  for (const [parentId, children] of Object.entries(subtaskMap.value) as [string, Task[]][]) {
    const idx = children.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      subtaskMap.value[Number(parentId)] = [
        ...children.slice(0, idx),
        updatedTask,
        ...children.slice(idx + 1)
      ];
    }
  }
  
  // 刷新标签统计（task_count 可能已变化）
  await tagsHook.loadTags();
}

// 标签管理
async function handleDrawerTagsUpdated(taskId: number) {
  const idx = tasksHook.tasks.value.findIndex(t => t.id === taskId);
  if (idx >= 0) {
    const fresh = await db.tasks.getById(taskId);
    if (fresh) {
      tasksHook.tasks.value = [
        ...tasksHook.tasks.value.slice(0, idx),
        fresh,
        ...tasksHook.tasks.value.slice(idx + 1),
      ];
    }
  }
  await tagsHook.loadTags();
  statsHook.loadStats();
}

async function handleCreateTag(name: string, color: string) {
  const tag = await tagsHook.createTag(name, color);
  if (tag) ElMessage.success('标签已创建');
  else ElMessage.warning('创建失败，可能名称已存在');
}

async function handleDeleteTag(id: number) {
  try {
    await ElMessageBox.confirm('确定要删除此标签吗？', '删除确认', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
    const ok = await tagsHook.deleteTag(id);
    if (ok) { ElMessage.success('标签已删除'); tagsHook.loadTags(); tasksHook.refresh(); }
    else { ElMessage.error('删除失败'); }
  } catch (e) { /* cancelled */ }
}

function handleEsc() {
  detailDrawerTask.value = null;
  showCreator.value = false;
}

// 初始化
statsHook.loadStats();
let _subtaskTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => tasksHook.tasks.value, () => {
  statsHook.loadStats();
  if (_skipFullSubtaskReload) {
    _skipFullSubtaskReload = false;
    return;
  }
  if (_subtaskTimer) clearTimeout(_subtaskTimer);
  _subtaskTimer = setTimeout(() => {
    loadSubtasks();
    const topLevelIds = tasksHook.tasks.value.filter(t => !t.parent_id).map(t => t.id);
    loadAttachmentCounts(topLevelIds);
  }, 150);
}, { immediate: true });

import { checker } from './main';
onBeforeUnmount(() => {
  checker.stop();
});
</script>

<style>
:root {
  --el-color-danger: #d36c6c;
  --el-color-danger-light-3: #e09898;
  --el-color-danger-light-5: #e9b6b6;
  --el-color-danger-light-7: #f2d3d3;
  --el-color-danger-light-8: #f6e2e2;
  --el-color-danger-light-9: #fbf0f0;
  --el-color-danger-dark-2: #a95656;
  --el-color-error: #d36c6c;
  --el-color-error-light-3: #e09898;
  --el-color-error-light-5: #e9b6b6;
  --el-color-error-light-7: #f2d3d3;
  --el-color-error-light-8: #f6e2e2;
  --el-color-error-light-9: #fbf0f0;
  --el-color-error-dark-2: #a95656;
  /* Element Plus 主色覆盖为 Indigo，匹配冷感方案 */
  --el-color-primary: #6366f1;
  --el-color-primary-light-3: #818cf8;
  --el-color-primary-light-5: #a5b4fc;
  --el-color-primary-light-7: #c7d2fe;
  --el-color-primary-light-8: #dbeafe;
  --el-color-primary-light-9: #eef2ff;
  --el-color-primary-dark-2: #4f46e5;
  /* Element Plus 弹窗背景色覆盖为暖白 */
  --el-dialog-bg-color: #faf7f2;
  --el-bg-color: #faf7f2;
  --el-messagebox-bg-color: #faf7f2;
  --el-messagebox-content-color: #4b4257;
  --el-messagebox-title-color: #4b4257;
  --el-input-bg-color: #fcfaf7;
  --el-fill-color: #faf7f2;
  --el-fill-color-light: #fcfaf7;
  --el-fill-color-lighter: #fcfaf7;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app {
  width: 100%; height: 100%;
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif;
}
.app-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: radial-gradient(circle at 18% 12%, rgba(255, 226, 188, 0.88) 0, transparent 32%),
              radial-gradient(circle at 86% 18%, rgba(218, 232, 255, 0.95) 0, transparent 28%),
              linear-gradient(135deg, #fff7ea 0%, #f7f2ff 46%, #eef7ff 100%);
  color: #4b4257;
}
.app-panel {
  flex: 1; display: flex; overflow: hidden; margin: 16px;
  height: calc(100% - 32px);
  background: linear-gradient(135deg, rgba(243, 236, 223, 0.92), rgba(247, 242, 255, 0.92));
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.14);
  backdrop-filter: blur(22px);
}
.main-content {
  flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden;
}
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid rgba(126, 108, 87, 0.08);
}
.top-bar-left { display: flex; align-items: center; gap: 8px; }
.top-bar-title { font-size: 18px; font-weight: 700; color: #4b4257; }
.filter-indicator {
  font-size: 13px; color: #8b7e9a;
  background: rgba(99, 102, 241, 0.06); padding: 2px 10px; border-radius: 999px;
}
.filter-tag { color: #6366f1; }
.top-bar-actions { display: flex; align-items: center; gap: 10px; }

.view-toggle {
  display: flex;
  border: 1px solid rgba(126, 108, 87, 0.1);
  border-radius: 10px;
  overflow: hidden;
}
.view-btn {
  padding: 5px 8px;
  background: rgba(255,255,255,0.5);
  border: none;
  cursor: pointer;
  color: #8b7e9a;
  transition: background 0.15s, color 0.15s;
}
.view-btn:first-child { border-right: 1px solid rgba(126, 108, 87, 0.1); }
.view-btn:hover { background: rgba(255,255,255,0.8); color: #6366f1; }
.view-btn.active { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }

.search-box {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(126, 108, 87, 0.1);
  border-radius: 10px; transition: border-color 0.2s, box-shadow 0.2s;
}
.search-box:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.search-icon { color: #9a8fa7; flex-shrink: 0; }
.search-input {
  border: none; background: transparent; outline: none;
  font-size: 13px; color: #4b4257; width: 140px; font-family: inherit;
}
.search-input::placeholder { color: #b0a5b8; }
.create-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; background: linear-gradient(135deg, #818cf8, #6366f1); color: white;
  border: none; border-radius: 10px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.25s ease; font-family: inherit;
  box-shadow: 0 4px 12px rgba(99,102,241,0.25);
}
.create-btn:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.create-btn:active { transform: scale(0.97); }
.kanban-area { flex: 1; overflow: hidden; }
.list-area { flex: 1; overflow-y: auto; padding: 0; }
.editor-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(75, 66, 87, 0.3);
}
.editor-panel {
  width: 480px; max-height: 80vh; overflow: hidden;
  background: #faf7f2; border-radius: 16px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.2);
  display: flex;
  flex-direction: column;
}
.editor-panel::-webkit-scrollbar { width: 6px; }
.editor-panel::-webkit-scrollbar-track { background: transparent; }
.editor-panel::-webkit-scrollbar-thumb { background: #d3d7da; border-radius: 3px; }
/* 日期选择器 */
.el-date-editor { background: #fcfaf7; }
.el-picker-panel { background: #faf7f2; }
</style>
