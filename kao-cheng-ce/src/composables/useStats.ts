import { ref } from 'vue';
import type { SidebarStats } from '@/types';
import { db } from '@/db';

export function useStats() {
  const stats = ref<SidebarStats>({
    total: 0, todo: 0, doing: 0, done: 0, cancelled: 0, overdue: 0,
  });

  async function loadStats() {
    try {
      stats.value = await db.stats.get();
    } catch (e) {
      console.error('loadStats error:', e);
    }
  }

  return { stats, loadStats };
}