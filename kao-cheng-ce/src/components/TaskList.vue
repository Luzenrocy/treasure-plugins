<template>
  <div class="task-list">
    <div v-if="loading" class="list-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="tasks.length === 0" class="list-state empty">
      <div class="empty-icon">
        <svg viewBox="0 0 80 80" fill="none" width="64" height="64">
          <rect x="10" y="20" width="60" height="50" rx="8" stroke="#d1d5db" stroke-width="2" fill="#f9fafb"/>
          <line x1="22" y1="38" x2="58" y2="38" stroke="#e5e7eb" stroke-width="2" stroke-linecap="round"/>
          <line x1="22" y1="48" x2="50" y2="48" stroke="#e5e7eb" stroke-width="2" stroke-linecap="round"/>
          <circle cx="20" cy="56" r="3" fill="#d1d5db"/>
        </svg>
      </div>
      <p class="empty-title">暂无任务</p>
      <p class="empty-desc">点击上方「+」开始你的第一个任务</p>
    </div>

    <div v-else class="task-items">
      <TaskItem
        v-for="task in topLevelTasks"
        :key="task.id"
        :task="task"
        :subtask-counts="subtaskCounts"
        :subtask-map="subtaskMap"
        :attachment-counts="attachmentCounts"
        :all-tags="tags"
        :on-create-tag="onCreateTag"
        :on-update-tags="onUpdateTags"
        @toggle="$emit('toggle', $event)"
        @view="$emit('view', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @add-subtask="$emit('addSubtask', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Task, Tag } from '@/types';
import TaskItem from './TaskItem.vue';

const props = withDefaults(defineProps<{
  tasks: Task[];
  loading: boolean;
  subtaskCounts: Record<number, number>;
  subtaskMap: Record<number, Task[]>;
  attachmentCounts: Record<number, number>;
  tags: Tag[];
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>;
  onUpdateTags?: (taskId: number, tagIds: number[], updatedTask: Task) => void;
}>(), {
  tags: () => [],
  onCreateTag: undefined,
  onUpdateTags: undefined,
});

defineEmits<{
  toggle: [task: Task];
  view: [id: number];
  edit: [id: number];
  delete: [id: number];
  addSubtask: [parentId: number];
}>();

const topLevelTasks = computed(() => props.tasks.filter(t => !t.parent_id));

async function handleUpdateTags(taskId: number, tagIds: number[], updatedTask?: Task) {
  const task = updatedTask || (() => {
    const t = props.tasks.find(t => t.id === taskId);
    if (!t) return null;
    return { ...t, tags: tagIds.map(id => props.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => tag !== undefined) };
  })();
  if (task) {
    props.onUpdateTags?.(taskId, tagIds, task);
  }
}
</script>

<style scoped>
.task-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.task-list::-webkit-scrollbar { width: 6px; }
.task-list::-webkit-scrollbar-track { background: transparent; }
.task-list::-webkit-scrollbar-thumb { background: #d3d7da; border-radius: 3px; }
.list-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  gap: 12px;
  color: #9a8fa7;
  font-size: 14px;
}
.loading-spinner {
  width: 24px; height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty-icon { margin-bottom: 4px; opacity: 0.5; }
.empty-title { font-size: 16px; font-weight: 600; color: #8b7e9a; margin: 0; }
.empty-desc { font-size: 13px; color: #b0a5b8; margin: 0; }
.task-items { display: flex; flex-direction: column; }
</style>