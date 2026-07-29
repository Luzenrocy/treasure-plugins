<template>
  <div class="kanban-board">
    <div class="kanban-column" v-for="col in columns" :key="col.status">
      <div class="column-header" :style="{ background: col.bg }">
        <span class="column-dot" :style="{ background: col.color }"></span>
        <span class="column-title">{{ col.label }}</span>
        <span class="column-count">{{ col.tasks.length }}</span>
      </div>
      <div class="column-body" @dragover.prevent @drop.prevent="moveToColumn(col.status)">
        <div
          v-for="task in col.tasks"
          :key="task.id"
          class="kanban-card"
          :class="`priority-${task.priority}`"
          draggable="true"
          @dragstart="onDragStart(task)"
          @click="handleCardClick(task)"
        >
          <div class="card-top">
            <span class="card-priority" :style="{ color: getPriorityColor(task.priority) }">
              {{ task.priority }}
            </span>
            <span v-if="task.due_date" class="card-due" :class="{ overdue: isOverdue(task.due_date) }">
              {{ formatDate(task.due_date) }}
            </span>
          </div>
          <div class="card-title">{{ task.title }}</div>
          <div v-if="task.tags?.length" class="card-tags">
            <span v-for="tag in task.tags" :key="tag.id" class="card-tag" :style="{ background: tag.color + '18', color: tag.color }">
              {{ tag.name }}
            </span>
          </div>
          <div class="card-footer">
            <span class="subtask-count" v-if="hasSubtasks(task.id)">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              {{ subtaskCounts[task.id] || 0 }}
            </span>
            <span class="attachment-count" v-if="(attachmentCounts[task.id] || 0) > 0">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M13.5 2H5a2 2 0 00-2 2v16l3.5-3.5L13.5 20V2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7v6h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ attachmentCounts[task.id] || 0 }}
            </span>
            <span class="progress-badge" v-if="task.status === 'doing' && task.progress > 0">
              {{ task.progress }}%
            </span>
            <button class="card-action" @click.stop="handleToggle(task)" :title="col.status === 'done' ? '撤回' : '完成'">
              <svg v-if="col.status === 'done'" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M2 12l5 5 13-13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/></svg>
            </button>
            <button class="card-action tag-action" @click.stop="toggleCardTagPopover(task.id)" title="标签">
              <TagIcon width="14" height="14" />
            </button>
          </div>

          <!-- 卡片内联标签编辑浮层 -->
          <div v-if="cardTagPopoverTaskId === task.id" class="card-tag-popover" @click.stop>
            <div class="card-tag-list">
              <button
                v-for="tag in allTags"
                :key="tag.id"
                class="card-tag-item"
                :class="{ selected: getCardSelectedTags(task.id).includes(tag.id) }"
                :style="{
                  background: getCardSelectedTags(task.id).includes(tag.id) ? tag.color + '20' : 'transparent',
                  borderColor: getCardSelectedTags(task.id).includes(tag.id) ? tag.color : '#e5e7eb',
                  color: getCardSelectedTags(task.id).includes(tag.id) ? tag.color : '#6b7280',
                }"
                @click="toggleCardTag(task.id, tag.id)"
              >
                <span class="tag-dot" :style="{ background: tag.color }"></span>
                {{ tag.name }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="col.tasks.length === 0" class="column-empty">
          <span>{{ col.emptyText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Task, TaskStatus, Tag } from '@/types';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
import { db } from '@/db';
import TagIcon from '@/icon/tag.svg?component';

const props = defineProps<{
  tasks: Task[];
  subtaskCounts: Record<number, number>;
  attachmentCounts: Record<number, number>;
  allTags: Tag[];  // ★ 新增
  onUpdateTags?: (taskId: number, tagIds: number[], updatedTask: Task) => void;
}>();

const emit = defineEmits<{
  toggle: [task: Task];
  view: [id: number];
  move: [taskId: number, status: TaskStatus];
}>();

const draggingTask = ref<Task | null>(null);

// ★ 新增：卡片标签编辑状态
const cardTagPopoverTaskId = ref<number | null>(null);
const cardSelectedTags = ref<Record<number, number[]>>({});

function toggleCardTagPopover(taskId: number) {
  if (cardTagPopoverTaskId.value === taskId) {
    cardTagPopoverTaskId.value = null;
  } else {
    cardTagPopoverTaskId.value = taskId;
    // 同步当前任务的标签
    const task = props.tasks.find(t => t.id === taskId);
    cardSelectedTags.value[taskId] = (task?.tags || []).map(t => t.id);
  }
}

function getCardSelectedTags(taskId: number): number[] {
  return cardSelectedTags.value[taskId] || [];
}

async function toggleCardTag(taskId: number, tagId: number) {
  const current = cardSelectedTags.value[taskId] || [];
  const idx = current.indexOf(tagId);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(tagId);
  cardSelectedTags.value[taskId] = [...current];
  await saveCardTags(taskId);
}

async function saveCardTags(taskId: number) {
  const ok = await db.taskTags.set(taskId, cardSelectedTags.value[taskId] || []);
  if (ok) {
    const task = props.tasks.find(t => t.id === taskId);
    const tagIds = cardSelectedTags.value[taskId] || [];
    const tags = tagIds.map(id => props.allTags.find(t => t.id === id)).filter((tag): tag is Tag => tag !== undefined);
    if (task) {
      props.onUpdateTags?.(taskId, tagIds, { ...task, tags });
    } else {
      props.onUpdateTags?.(taskId, tagIds, null);
    }
  }
}

const columns = computed(() => [
  {
    status: 'todo' as TaskStatus,
    label: '待办',
    color: '#9ca3af',
    bg: 'rgba(156, 163, 175, 0.08)',
    emptyText: '拖拽任务到这里',
    tasks: props.tasks.filter(t => t.status === 'todo' && !t.parent_id),
  },
  {
    status: 'doing' as TaskStatus,
    label: '进行中',
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.08)',
    emptyText: '拖拽任务到这里',
    tasks: props.tasks.filter(t => t.status === 'doing' && !t.parent_id),
  },
  {
    status: 'done' as TaskStatus,
    label: '已完成',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.08)',
    emptyText: '拖拽任务到这里',
    tasks: props.tasks.filter(t => t.status === 'done' && !t.parent_id),
  },
]);

function onDragStart(task: Task) {
  draggingTask.value = task;
}

function moveToColumn(status: TaskStatus) {
  if (draggingTask.value && draggingTask.value.status !== status) {
    emit('move', draggingTask.value.id, status);
    draggingTask.value = null;
  }
}

function handleCardClick(task: Task) {
  emit('view', task.id);
}

function handleToggle(task: Task) {
  emit('toggle', task);
}

function hasSubtasks(taskId: number): boolean {
  return (props.subtaskCounts[taskId] || 0) > 0;
}

function getPriorityColor(p: string): string {
  return PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG]?.color || '#9ca3af';
}

function isOverdue(date: string): boolean {
  return new Date(date) < new Date();
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

<style scoped>
.kanban-board {
  display: flex;
  gap: 12px;
  padding: 16px;
  height: 100%;
  overflow-x: auto;
}
.kanban-column {
  flex: 1;
  min-width: 240px;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
}
.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px 12px 0 0;
  font-size: 13px;
  font-weight: 600;
}
.column-dot { width: 8px; height: 8px; border-radius: 50%; }
.column-title { color: #4b4257; }
.column-count {
  margin-left: auto;
  font-size: 11px;
  color: #8b7e9a;
  background: rgba(255,255,255,0.5);
  padding: 1px 8px;
  border-radius: 999px;
}
.column-body {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  min-height: 120px;
}
.kanban-card {
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid rgba(126, 108, 87, 0.08);
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  transition: box-shadow 0.2s, transform 0.15s;
}
.kanban-card:hover {
  box-shadow: 0 4px 12px rgba(122, 96, 77, 0.1);
  transform: translateY(-1px);
}
.kanban-card:active {
  cursor: grabbing;
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.card-priority { font-size: 11px; font-weight: 700; }
.card-due { font-size: 11px; color: #8b7e9a; }
.card-due.overdue { color: #d36c6c; font-weight: 600; }
.card-title {
  font-size: 13px;
  font-weight: 500;
  color: #4b4257;
  line-height: 1.5;
  margin-bottom: 8px;
  word-break: break-word;
}
.card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.card-tag { font-size: 10px; padding: 1px 6px; border-radius: 999px; }
.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subtask-count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #8b7e9a;
}
.attachment-count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #6366f1;
  font-weight: 500;
}
.progress-badge {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
}
.card-action {
  margin-left: auto;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #8b7e9a;
  transition: background 0.15s, color 0.15s;
}
.card-action:hover { background: #f0fdf4; color: #22c55e; border-color: #22c55e; }
.tag-action:hover { background: rgba(99,102,241,0.06); color: #6366f1; border-color: #6366f1; }

/* 卡片标签编辑浮层 */
.card-tag-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 10;
  width: 220px;
  max-height: 240px;
  overflow-y: auto;
  background: white;
  border: 1px solid rgba(126, 108, 87, 0.12);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(122, 96, 77, 0.08);
  padding: 8px;
}
.card-tag-list { display: flex; flex-direction: column; gap: 4px; }
.card-tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: #4b4257;
  transition: all 0.15s;
  font-family: inherit;
}
.card-tag-item:hover { background: rgba(126, 108, 87, 0.06); }
.card-tag-item .tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.column-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  font-size: 12px;
  color: #b0a5b8;
  border: 1px dashed rgba(126, 108, 87, 0.12);
  border-radius: 8px;
}
</style>