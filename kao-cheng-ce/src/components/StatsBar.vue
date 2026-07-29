<template>
  <div class="stats-bar">
    <div class="stats-left">
      <span class="stat-item">共 <strong>{{ stats.total }}</strong> 任务</span>
      <span class="stat-divider"></span>
      <span class="stat-item">完成 <strong style="color:#22c55e">{{ stats.done }}</strong></span>
      <span class="stat-divider"></span>
      <span class="stat-item">进行中 <strong style="color:#6366f1">{{ stats.doing }}</strong></span>
    </div>
    <div class="stats-right">
      <span v-if="stats.overdue > 0" class="stat-item overdue">
        逾期 <strong>{{ stats.overdue }}</strong>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SidebarStats } from '@/types';
defineProps<{ stats: SidebarStats }>();
</script>

<style scoped>
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid rgba(126, 108, 87, 0.08);
  font-size: 12px;
  color: #8b7e9a;
  background: rgba(255,255,255,0.3);
}
.stats-left, .stats-right { display: flex; align-items: center; gap: 8px; }
.stat-divider { width: 1px; height: 12px; background: rgba(126, 108, 87, 0.12); }
.overdue { color: #d36c6c; }
strong { font-weight: 600; }
</style>