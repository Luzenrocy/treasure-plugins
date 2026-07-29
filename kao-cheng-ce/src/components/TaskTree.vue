<template>
  <div class="task-tree">
    <div
      v-for="node in nodes"
      :key="node.id"
      class="tree-node"
      :style="{ paddingLeft: depth * 20 + 'px' }"
    >
      <div class="node-row" :class="`status-${node.status}`">
        <!-- 展开/折叠 -->
        <button
          v-if="node.children && node.children.length > 0"
          class="node-expand"
          :class="{ expanded: expanded[node.id] }"
          @click.stop="toggleExpand(node.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" width="10" height="10"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <span v-else class="node-expand-placeholder"></span>

        <!-- 状态图标 -->
        <button class="node-checkbox" @click.stop="handleToggle(node)">
          <svg v-if="node.status === 'done'" viewBox="0 0 24 24" fill="none" width="14" height="14">
            <circle cx="12" cy="12" r="10" fill="#22c55e"/>
            <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <svg v-else-if="node.status === 'doing'" viewBox="0 0 24 24" fill="none" width="14" height="14">
            <circle cx="12" cy="12" r="10" fill="#6366f1" opacity="0.2"/>
            <circle cx="12" cy="12" r="6" fill="#6366f1"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" width="14" height="14">
            <circle cx="12" cy="12" r="10" stroke="#d1d5db" stroke-width="1.5"/>
          </svg>
        </button>

        <span class="node-title" :class="{ done: node.status === 'done' }" @click="handleSelect(node)">
          {{ node.title }}
        </span>
        <span class="node-priority" :style="{ color: getPriorityColor(node.priority) }">{{ node.priority }}</span>
      </div>

      <!-- 递归子节点 -->
      <TaskTree
        v-if="expanded[node.id] && node.children && node.children.length > 0"
        :nodes="node.children"
        :depth="depth + 1"
        :expanded="expanded"
        @toggle="(n: any) => emit('toggle', n)"
        @select="(n: any) => emit('select', n)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PRIORITY_CONFIG } from '@/types';
import type { Priority } from '@/types';

const props = defineProps<{
  nodes: any[];
  depth?: number;
  expanded: Record<number, boolean>;
}>();

const emit = defineEmits<{
  toggle: [node: any];
  select: [node: any];
}>();

const depth = props.depth ?? 0;

function toggleExpand(id: number) {
  props.expanded[id] = !props.expanded[id];
}

function handleToggle(node: any) {
  emit('toggle', node);
}

function handleSelect(node: any) {
  emit('select', node);
}

function getPriorityColor(p: string): string {
  return PRIORITY_CONFIG[p as Priority]?.color || '#9ca3af';
}
</script>

<script lang="ts">
// 自引用注册
export default { name: 'TaskTree' };
</script>

<style scoped>
.task-tree { display: flex; flex-direction: column; }
.tree-node { display: flex; flex-direction: column; }
.node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 8px;
  transition: background 0.15s;
  cursor: default;
}
.node-row:hover { background: rgba(243, 236, 223, 0.4); }
.node-expand {
  flex-shrink: 0;
  width: 16px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none;
  cursor: pointer; color: #9a8fa7;
  transition: transform 0.2s;
}
.node-expand.expanded { transform: rotate(90deg); }
.node-expand-placeholder {
  flex-shrink: 0;
  width: 16px; height: 20px;
}
.node-checkbox {
  flex-shrink: 0;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none;
  cursor: pointer; border-radius: 50%;
  transition: transform 0.15s;
}
.node-checkbox:hover { transform: scale(1.15); }
.node-title {
  flex: 1;
  font-size: 13px;
  color: #4b4257;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-title.done { text-decoration: line-through; color: #9ca3af; }
.node-priority {
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
</style>