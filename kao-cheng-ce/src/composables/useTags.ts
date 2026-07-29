import { ref } from 'vue';
import { db } from '@/db';
import type { Tag } from '@/types';

export function useTags() {
  const tags = ref<Tag[]>([]);
  const loading = ref(false);

  async function loadTags() {
    loading.value = true;
    try {
      tags.value = await db.tags.list();
    } catch (e) {
      console.error('loadTags error:', e);
    } finally {
      loading.value = false;
    }
  }

  async function createTag(name: string, color: string = '#6366f1'): Promise<Tag | null> {
    const tag = await db.tags.create(name, color);
    if (tag) {
      await loadTags();
    }
    return tag;
  }

  async function deleteTag(id: number): Promise<boolean> {
    const ok = await db.tags.delete(id);
    if (ok) {
      await loadTags();
    }
    return ok;
  }

  function getTagById(id: number): Tag | undefined {
    return tags.value.find(t => t.id === id);
  }

  loadTags();

  return {
    tags,
    loading,
    loadTags,
    createTag,
    deleteTag,
    getTagById,
  };
}