<template>
  <div class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <span v-if="!collapsed" class="sidebar-title">考成策</span>
      <button class="collapse-btn" @click="$emit('toggle')" :title="collapsed ? '展开' : '收起'">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <path v-if="collapsed" d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path v-else d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <template v-if="!collapsed">
      <!-- 筛选：全部 -->
      <div class="filter-group">
        <button
          class="filter-item"
          :class="{ active: currentFilter === 'all' }"
          @click="$emit('filter', 'all')"
        >
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span>全部任务</span>
          <span class="count">{{ stats.total }}</span>
        </button>
        <button
          class="filter-item"
          :class="{ active: currentFilter === 'todo' }"
          @click="$emit('filter', 'todo')"
        >
          <span class="dot" style="background: #9ca3af"></span>
          <span>待办</span>
          <span class="count">{{ stats.todo }}</span>
        </button>
        <button
          class="filter-item"
          :class="{ active: currentFilter === 'doing' }"
          @click="$emit('filter', 'doing')"
        >
          <span class="dot" style="background: #6366f1"></span>
          <span>进行中</span>
          <span class="count">{{ stats.doing }}</span>
        </button>
        <button
          class="filter-item"
          :class="{ active: currentFilter === 'done' }"
          @click="$emit('filter', 'done')"
        >
          <span class="dot" style="background: #22c55e"></span>
          <span>已完成</span>
          <span class="count">{{ stats.done }}</span>
        </button>
        <button
          class="filter-item"
          :class="{ active: currentFilter === 'cancelled' }"
          @click="$emit('filter', 'cancelled')"
        >
          <span class="dot" style="background: #d1d5db"></span>
          <span>已取消</span>
          <span class="count">{{ stats.cancelled }}</span>
        </button>
      </div>

      <!-- 分隔线 -->
      <div class="sidebar-divider"></div>

      <!-- 逾期 -->
      <button
        v-if="stats.overdue > 0"
        class="filter-item overdue-item"
        @click="$emit('filter', 'overdue')"
      >
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span>已逾期</span>
        <span class="count overdue-count">{{ stats.overdue }}</span>
      </button>

      <!-- 标签 -->
      <div class="sidebar-divider"></div>
      <div class="filter-group-label">
        <span class="group-title">标签</span>
        <button class="add-tag-btn" @click="showTagManager = !showTagManager" title="管理标签">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="tag-filter-list">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="tag-filter-item"
          :class="{ active: activeTagId === tag.id }"
          @click="$emit('filter-tag', tag.id)"
        >
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <span class="count">{{ tag.task_count || 0 }}</span>
          <button
            class="tag-del-btn"
            :class="{ disabled: (tag.task_count || 0) > 0 }"
            :title="(tag.task_count || 0) > 0 ? '该标签有任务关联，无法删除' : '删除标签'"
            @click.stop="handleTagDelete(tag)"
          >
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div v-if="tags.length === 0" class="no-tags">暂无标签</div>
      </div>

      <!-- 标签管理 -->
      <div v-if="showTagManager" class="tag-manager-panel">
        <div class="tm-header">
          <span>新建标签</span>
          <button class="tm-close" @click="showTagManager = false">✕</button>
        </div>
        <div class="tm-create-row">
          <input
            v-model="newTagName"
            class="tm-input"
            placeholder="标签名"
            @keydown.enter="createTag"
          />
          <button class="tm-add-btn" @click="createTag" title="添加">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tag, SidebarStats, TaskStatus } from '@/types';

defineProps<{
  collapsed: boolean;
  tags: Tag[];
  stats: SidebarStats;
  currentFilter: TaskStatus | 'all' | 'overdue';
  activeTagId: number | null;
}>();
const emit = defineEmits<{
  toggle: [];
  filter: [status: TaskStatus | 'all' | 'overdue'];
  'filter-tag': [tagId: number];
  createTag: [name: string, color: string];
  deleteTag: [id: number];
}>();



const showTagManager = ref(false);
const newTagName = ref('');

function createTag() {
  if (!newTagName.value.trim()) return;
  emit('createTag', newTagName.value.trim(), '#6366f1');
  newTagName.value = '';
  showTagManager.value = false;
}

function handleTagDelete(tag: Tag) {
  if ((tag.task_count || 0) > 0) return;
  emit('deleteTag', tag.id);
}
</script>

<style scoped>
.sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  transition: width 0.3s, opacity 0.3s;
  border-right: 1px solid rgba(126, 108, 87, 0.08);
  overflow-y: auto;
}
.sidebar.collapsed {
  width: 48px;
  opacity: 0.7;
}
.sidebar.collapsed .sidebar-header {
  justify-content: center;
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 4px;
}
.sidebar-title {
  font-size: 16px;
  font-weight: 700;
  color: #4b4257;
  letter-spacing: 0.04em;
}
.collapse-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #9a8fa7;
  transition: background 0.2s;
}
.collapse-btn:hover { background: rgba(126, 108, 87, 0.08); color: #4b4257; }
.filter-group { display: flex; flex-direction: column; gap: 2px; }
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #5c5347;
  transition: background 0.15s;
  text-align: left;
  width: 100%;
}
.filter-item:hover { background: rgba(232, 220, 200, 0.5); }
.filter-item.active {
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  font-weight: 600;
}
.filter-item .count {
  margin-left: auto;
  font-size: 11px;
  color: #9a8fa7;
  background: rgba(126, 108, 87, 0.08);
  padding: 1px 8px;
  border-radius: 999px;
  min-width: 20px;
  text-align: center;
}
.filter-item.active .count { background: rgba(99,102,241,0.12); color: #6366f1; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sidebar-divider { height: 1px; background: rgba(126, 108, 87, 0.08); margin: 10px 0; }
.overdue-item { color: #d36c6c; }
.overdue-item:hover { background: #fcf5f5; }
.overdue-item.active { background: #fcf5f5; color: #d36c6c; font-weight: 600; }
.overdue-count { background: #fcf5f5 !important; color: #d36c6c !important; }
.filter-group-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  margin-bottom: 4px;
}
.group-title { font-size: 11px; font-weight: 600; color: #8b7e9a; text-transform: uppercase; letter-spacing: 0.05em; }
.add-tag-btn {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 6px;
  cursor: pointer; color: #9a8fa7;
  transition: background 0.2s;
}
.add-tag-btn:hover { background: rgba(126, 108, 87, 0.08); color: #6366f1; }
.tag-filter-list { display: flex; flex-direction: column; gap: 2px; }
.tag-filter-item { position: relative; display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #5c5347;
  transition: background 0.15s;
  text-align: left;
  width: 100%;
  user-select: none;
}
.tag-filter-item:hover { background: rgba(232, 220, 200, 0.5); }
.tag-filter-item.active { background: rgba(99, 102, 241, 0.08); color: #6366f1; }

.tag-del-btn {
  position: absolute; right: 6px;
  display: none; align-items: center; justify-content: center;
  width: 20px; height: 20px;
  background: none; border: none; border-radius: 4px;
  cursor: pointer; color: #d36c6c;
  transition: background 0.15s;
}
.tag-filter-item:hover .tag-del-btn { display: flex; }
.tag-del-btn:hover { background: #fcf5f5; }
.tag-del-btn.disabled { color: #d1d5db; cursor: not-allowed; }
.tag-del-btn.disabled:hover { background: transparent; }
.tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tag-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.no-tags { font-size: 12px; color: #b0a5b8; padding: 8px 10px; }
.tag-manager-panel {
  margin-top: 8px;
  padding: 12px;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(126, 108, 87, 0.08);
  border-radius: 12px;
}
.tm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #4b4257; }
.tm-close { background: none; border: none; cursor: pointer; color: #9a8fa7; font-size: 14px; }
.tm-create-row { display: flex; gap: 6px; }
.tm-input { flex: 1; min-width: 0; padding: 5px 8px; font-size: 12px; border: 1px solid #e5e7eb; border-radius: 6px; outline: none; }
.tm-input:focus { border-color: #6366f1; }
.tm-add-btn {
  flex-shrink: 0; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #818cf8, #6366f1); color: white; border: none; border-radius: 6px;
  cursor: pointer; transition: all 0.25s ease; box-shadow: 0 4px 12px rgba(99,102,241,0.25);
}
.tm-add-btn:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
</style>