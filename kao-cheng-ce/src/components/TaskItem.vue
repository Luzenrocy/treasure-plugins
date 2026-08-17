<template>
  <div class="task-item-wrapper">
    <div class="task-item" :class="[`priority-${task.priority}`, `status-${displayStatus}`]">
      <!-- 展开/折叠子任务 -->
      <button
        v-if="subtaskCount > 0"
        class="expand-btn"
        :class="{ expanded }"
        @click.stop="expanded = !expanded"
      >
        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div v-else class="expand-placeholder"></div>

      <div class="task-main">
        <button
          type="button"
          class="task-checkbox"
          :class="`status-${displayStatus}`"
          @click.stop.prevent="handleToggle"
        >
          <svg v-if="displayStatus === 'done'" viewBox="0 0 24 24" fill="none" width="18" height="18" style="pointer-events: none;">
            <circle cx="12" cy="12" r="10" fill="#22c55e"/>
            <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else-if="displayStatus === 'doing'" viewBox="0 0 24 24" fill="none" width="18" height="18" style="pointer-events: none;">
            <circle cx="12" cy="12" r="10" fill="#6366f1" opacity="0.15"/>
            <circle cx="12" cy="12" r="6" fill="#6366f1"/>
          </svg>
          <svg v-else-if="displayStatus === 'cancelled'" viewBox="0 0 24 24" fill="none" width="18" height="18" style="pointer-events: none;">
            <circle cx="12" cy="12" r="10" stroke="#d1d5db" stroke-width="1.5"/>
            <path d="M7 7l10 10M17 7l-10 10" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" width="18" height="18" style="pointer-events: none;">
            <circle cx="12" cy="12" r="10" stroke="#d1d5db" stroke-width="1.5"/>
          </svg>
        </button>

        <div class="task-body" @click.stop="$emit('view', task.id)">
          <div class="task-title-row">
            <span class="task-title" :class="{ done: displayStatus === 'done' }">{{ task.title }}</span>
            <span class="priority-badge" :style="{ background: priorityConf.bg, color: priorityConf.color }">{{ task.priority }}</span>
          </div>
          <div class="task-meta">
            <span class="status-text">{{ statusConf.label }}</span>
            <span v-if="task.due_date" class="due-date" :class="{ overdue: isOverdue }">{{ formatDate(task.due_date) }}</span>
            <span v-if="task.progress > 0 && task.progress < 100" class="progress-text">{{ task.progress }}%</span>
            <span v-if="subtaskCount > 0" class="subtask-indicator">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.5"/></svg>
              {{ subtaskCount }}
            </span>
            <span v-if="attachmentCount > 0" class="attachment-indicator">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M13.5 2H5a2 2 0 00-2 2v16l3.5-3.5L13.5 20V2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7v6h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ attachmentCount }}
            </span>
            <span v-if="task.tags?.length" class="tags-inline">
              <span v-for="tag in task.tags" :key="tag.id" class="tag-pill" :style="{ background: tag.color + '18', color: tag.color }" @click.stop="handleRemoveTag(tag)">
                <TagIcon width="10" height="10" />
                {{ tag.name }}
              </span>
            </span>
          </div>
        </div>

        <div v-if="displayStatus === 'doing' && task.progress > 0" class="progress-track-mini">
          <div class="progress-fill-mini" :style="{ width: task.progress + '%' }"></div>
        </div>

        <div class="task-actions" @click.stop>
          <button class="action-btn" title="编辑" @click="$emit('edit', task.id)">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="action-btn" title="添加子任务" @click="$emit('addSubtask', task.id)">
            <BranchIcon width="14" height="14" />
          </button>
          <button class="action-btn" title="任务记录" @click.stop="showLogModal = true">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 5l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="action-btn" title="标签" @click.stop="showTagPopover = !showTagPopover">
            <TagIcon width="14" height="14" />
          </button>
          <button class="action-btn delete" title="删除" @click="$emit('delete', task.id)">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div v-if="showTagPopover" class="inline-tag-panel" @click.stop>
          <div class="inline-tag-editor">
            <div class="tag-list">
              <button
                v-for="tag in allTags"
                :key="tag.id"
                class="inline-tag-item"
                :class="{ selected: localSelectedTags.includes(tag.id) }"
                :style="{
                  background: localSelectedTags.includes(tag.id) ? tag.color + '20' : 'transparent',
                  borderColor: localSelectedTags.includes(tag.id) ? tag.color : '#e5e7eb',
                  color: localSelectedTags.includes(tag.id) ? tag.color : '#6b7280',
                }"
                @click="toggleInlineTag(tag.id)"
              >
                <span class="tag-dot" :style="{ background: tag.color }"></span>
                <span class="tag-name">{{ tag.name }}</span>
                <span v-if="localSelectedTags.includes(tag.id)" class="tag-check">✓</span>
              </button>
            </div>
            <div class="tag-create-row">
              <input
                v-model="newTagName"
                class="tm-input"
                placeholder="新建标签"
                @keydown.enter="createAndSelectTag"
              />
              <button class="tm-add-btn" @click="createAndSelectTag">添加</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工作记录弹窗 -->
    <teleport to="body">
      <div v-if="showLogModal" class="modal-overlay" @click.self="showLogModal = false" @keydown.esc="showLogModal = false">
        <div class="modal-dialog">
          <div class="modal-header">
            <span class="modal-title">任务记录 - {{ task.title }}</span>
            <button class="close-btn" @click="showLogModal = false">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <TaskLogTimeline :task-id="task.id" />
          </div>
        </div>
      </div>
    </teleport>

    <!-- 递归子任务列表 -->
    <div v-if="expanded && subtaskCount > 0" class="subtask-list">
      <TaskItem
        v-for="st in computedSubtasks"
        :key="st.id"
        :task="st"
        :subtask-counts="subtaskCounts"
        :subtask-map="subtaskMap"
        :attachment-counts="attachmentCounts"
        :all-tags="allTags"
        :on-create-tag="onCreateTag"
        @toggle="(t: any) => $emit('toggle', t)"
        @view="(id: number) => $emit('view', id)"
        @edit="(id: number) => $emit('edit', id)"
        @delete="(id: number) => $emit('delete', id)"
        @add-subtask="(pid: number) => $emit('addSubtask', pid)"
      />
      <button class="subtask-add-btn" @click.stop="$emit('addSubtask', task.id)">
        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        添加子任务
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { logs } from 'treasure-sdk';
import { ElMessageBox } from 'element-plus';
import { db } from '@/db';
import type { Task, Priority, TaskStatus, Tag } from '@/types';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
import TaskLogTimeline from './TaskLogTimeline.vue';
import TagIcon from '@/icon/tag.svg?component';
import BranchIcon from '@/icon/branch.svg?component';

const props = withDefaults(defineProps<{
  task: Task;
  subtaskCounts: Record<number, number>;
  subtaskMap: Record<number, Task[]>;
  attachmentCounts: Record<number, number>;
  allTags: Tag[];
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>;
  onUpdateTags?: (taskId: number, tagIds: number[], updatedTask: Task) => void;
}>(), {
  allTags: () => [],
  onCreateTag: undefined,
  onUpdateTags: undefined,
});

let isMounted = true;
onUnmounted(() => { isMounted = false; });

const emit = defineEmits<{
  toggle: [task: Task];
  view: [id: number];
  edit: [id: number];
  delete: [id: number];
  addSubtask: [parentId: number];
}>();

const expanded = ref(false);
const showLogModal = ref(false);

// ★ 新增：inline 标签编辑
const showTagPopover = ref(false);
const localSelectedTags = ref<number[]>([]);
const newTagName = ref('');

// 监听 task.tags 变化同步选中状态
watch(() => props.task.tags, (tags) => {
  localSelectedTags.value = (tags || []).map(t => t.id);
}, { immediate: true });

const allTags = computed(() => props.allTags);

async function createAndSelectTag() {
  if (!isMounted || !newTagName.value.trim()) return;
  const tag = await props.onCreateTag?.(newTagName.value.trim(), '#6366f1');
  if (tag) {
    localSelectedTags.value.push(tag.id);
    newTagName.value = '';
    await saveInlineTags();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleClickOutside);
});

function handleKeydown(e: KeyboardEvent) {
  if (!isMounted) return;
  if (e.key === 'Escape' && showLogModal.value) {
    showLogModal.value = false;
  }
  if (e.key === 'Escape' && showTagPopover.value) {
    showTagPopover.value = false;
    // 关闭弹窗时刷新标签数据，确保 task-meta 和 sidebar 统计同步
    syncTagData();
  }
}

function handleClickOutside() {
  if (!isMounted) return;
  if (showTagPopover.value) {
    showTagPopover.value = false;
    // 关闭弹窗时刷新标签数据，确保 task-meta 和 sidebar 统计同步
    syncTagData();
  }
}

async function syncTagData() {
  if (!isMounted || !props.task.id) return;
  const tags = await db.taskTags.getByTask(props.task.id);
  if (!isMounted) return;
  if (tags) {
    const tagIds = tags.map(t => t.id);
    localSelectedTags.value = tagIds;
    props.onUpdateTags?.(props.task.id, tagIds, { ...props.task, tags });
  }
}

async function handleRemoveTag(tag: Tag) {
  if (!isMounted) return;
  try {
    await ElMessageBox.confirm(`确定要删除「${props.task.title}」任务的标签「${tag.name}」吗？`, '删除标签', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    });
  } catch {
    return;
  }
  if (!isMounted || !props.task.id) return;
  const newTagIds = (props.task.tags || []).filter(t => t.id !== tag.id).map(t => t.id);
  const updatedTags = (props.task.tags || []).filter(t => t.id !== tag.id);
  await db.taskTags.set(props.task.id, newTagIds);
  props.onUpdateTags?.(props.task.id, newTagIds, { ...props.task, tags: updatedTags });
}

const subtaskCount = computed(() => props.subtaskCounts[props.task.id] || 0);
const attachmentCount = computed(() => props.attachmentCounts[props.task.id] || 0);
const computedSubtasks = computed(() => props.subtaskMap[props.task.id] || []);

function computeEffectiveStatus(taskId: number, counts: Record<number, number>, map: Record<number, Task[]>): TaskStatus | null {
  if (!counts[taskId]) return null;
  const children = map[taskId];
  if (!children?.length) return null;
  let hasDone = false, hasDoing = false, hasTodo = false, hasCancelled = false;
  for (const child of children) {
    const st = computeEffectiveStatus(child.id, counts, map) || child.status;
    if (st === 'done') hasDone = true;
    else if (st === 'doing') hasDoing = true;
    else if (st === 'todo') hasTodo = true;
    else hasCancelled = true;
  }
  if (hasDoing) return 'doing';
  if (hasDone && !hasTodo && !hasCancelled) return 'done';
  if (hasCancelled && !hasDone && !hasTodo) return 'cancelled';
  if (hasDone && (hasTodo || hasCancelled)) return 'doing';
  return 'todo';
}

const displayStatus = computed<TaskStatus>(
  () => computeEffectiveStatus(props.task.id, props.subtaskCounts, props.subtaskMap) || props.task.status
);

const priorityConf = computed(() => PRIORITY_CONFIG[props.task.priority]);
const statusConf = computed(() => STATUS_CONFIG[displayStatus.value]);
const isOverdue = computed(() => {
  if (!props.task.due_date || props.task.status === 'done' || props.task.status === 'cancelled') return false;
  return new Date(props.task.due_date) < new Date();
});

function getPrioColor(p: string): string {
  return PRIORITY_CONFIG[p as Priority]?.color || '#9ca3af';
}

function handleToggle() {
  if (props.task.status === 'done') return;
  logs.write({ level: 'info', category: 'biz', message: 'TaskItem.handleToggle', details: { taskId: props.task.id, status: props.task.status } }).catch(() => {})
  emit('toggle', props.task);
}

async function toggleInlineTag(tagId: number) {
  if (!isMounted) return;
  const idx = localSelectedTags.value.indexOf(tagId);
  if (idx >= 0) localSelectedTags.value.splice(idx, 1);
  else localSelectedTags.value.push(tagId);
  
  logs.write({ level: 'info', category: 'biz', message: 'TaskItem.toggleInlineTag', details: { taskId: props.task.id, tagId } }).catch(() => {})
  // 即时保存
  await saveInlineTags();
}

async function saveInlineTags() {
  if (!isMounted || !props.task.id) return;
  logs.write({ level: 'info', category: 'biz', message: 'TaskItem.saveInlineTags', details: { taskId: props.task.id, tagIds: localSelectedTags.value } }).catch(() => {})
  const ok = await db.taskTags.set(props.task.id, localSelectedTags.value);
  if (!isMounted) return;
  const tags = await db.taskTags.getByTask(props.task.id);
  if (!isMounted) return;
  if (tags) {
    const tagIds = tags.map(t => t.id);
    localSelectedTags.value = tagIds;
    props.onUpdateTags?.(props.task.id, tagIds, { ...props.task, tags });
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return '今天';
  if (d.toDateString() === tomorrow.toDateString()) return '明天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
</script>

<script lang="ts">
export default { name: 'TaskItem' };
</script>

<style scoped>
.task-item-wrapper { position: relative; margin-bottom: 0; }
.task-item {
  display: flex;
  align-items: flex-start;
  border-radius: 12px;
  transition: background 0.2s;
}
.task-item:hover { background: rgba(243, 236, 223, 0.5); }
.expand-btn, .expand-placeholder {
  flex-shrink: 0;
  width: 20px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #9a8fa7;
  transition: transform 0.2s;
}
.expand-btn.expanded { transform: rotate(90deg); }
.expand-btn:hover { color: #6366f1; }
.task-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px 10px 8px;
  cursor: pointer;
  position: relative;
}
.task-checkbox {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.2s;
}
.task-checkbox:hover { transform: scale(1.15); }
.task-body { flex: 1; min-width: 0; }
.task-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.task-title {
  font-size: 14px;
  font-weight: 500;
  color: #4b4257;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-title.done { text-decoration: line-through; color: #9ca3af; }
.priority-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
}
.task-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #8b7e9a; flex-wrap: wrap; }
.due-date.overdue { color: #d36c6c; font-weight: 600; }
.progress-text { color: #6366f1; font-weight: 500; }
.subtask-indicator {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #8b7e9a;
  font-size: 11px;
}
.attachment-indicator {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #6366f1;
  font-size: 11px;
  font-weight: 500;
}
.task-tags { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 500;
}
.tags-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.progress-track-mini {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 16px;
  height: 2px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 1px;
}
.progress-fill-mini {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 1px;
  transition: width 0.3s;
}
.task-actions { flex-shrink: 0; display: none; gap: 4px; margin-top: 2px; }
.task-main:hover .task-actions { display: flex; }
.action-btn {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 8px;
  cursor: pointer; color: #9a8fa7;
  transition: background 0.2s, color 0.2s;
}
.action-btn:hover { background: rgba(255,255,255,0.7); color: #6366f1; }
.action-btn.delete:hover { color: #d36c6c; background: #fcf5f5; }

/* inline 标签编辑 */
.inline-tag-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 260px;
  max-height: 280px;
  overflow-y: auto;
  background: #faf7f2;
  border: 1px solid rgba(126, 108, 87, 0.08);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(122, 96, 77, 0.12);
  padding: 8px;
}
.inline-tag-editor { display: flex; flex-direction: column; gap: 8px; }
.tag-list { display: flex; flex-direction: column; gap: 4px; }
.inline-tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #4b4257;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}
.inline-tag-item:hover { background: rgba(126, 108, 87, 0.06); }
.tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tag-name { flex: 1; }
.tag-check { color: #6366f1; font-weight: 700; margin-left: auto; }

/* 新建标签 */
.tag-create-row {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(126, 108, 87, 0.08);
}
.tm-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #4b4257;
  background: white;
  outline: none;
  font-family: inherit;
}
.tm-add-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: linear-gradient(135deg, #818cf8, #6366f1);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 12px rgba(99,102,241,0.25);
  transition: all 0.25s ease;
}
.tm-add-btn:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }

/* 工作记录弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(75, 66, 87, 0.3);
  animation: overlay-in 0.2s ease;
}
@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal-dialog {
  width: 480px;
  max-height: 80vh;
  background: #faf7f2;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.2);
  display: flex;
  flex-direction: column;
  animation: modal-in 0.2s ease;
}
@keyframes modal-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 0;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #4b4257;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close-btn {
  flex-shrink: 0;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 8px;
  cursor: pointer; color: #9a8fa7;
  transition: background 0.2s;
}
.close-btn:hover { background: rgba(126, 108, 87, 0.08); color: #4b4257; }
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}

/* 递归子任务列表 */
.subtask-list {
  margin-left: 32px;
  padding: 0 0 0 16px;
  border-left: 2px solid rgba(99, 102, 241, 0.12);
}

.subtask-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #6366f1;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
  margin-top: 2px;
  margin-left: 20px;
}
.subtask-add-btn:hover { background: rgba(99,102,241,0.06); color: #4f46e5; }

.btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.btn-primary:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-ghost { background: rgba(255,255,255,0.55); border: 1px solid rgba(126,108,87,0.12); color: #655b4f; }
.btn-ghost:hover { background: white; border-color: #6366f1; color: #6366f1; }
</style>
