<script setup lang="ts">
import type { IconMeta } from '../types';

defineProps<{ icon: IconMeta }>();

defineEmits<{
  (e: 'copy-url'): void;
  (e: 'copy-svg'): void;
}>();
</script>

<template>
  <article class="card">
    <div class="preview">
      <img :src="icon.url" :alt="icon.alias" />
    </div>
    <div class="info">
      <h3 class="alias" :title="icon.alias">{{ icon.alias }}</h3>
      <p class="code" :title="icon.code">{{ icon.code }}</p>
      <p class="version">v{{ icon.version }}</p>
    </div>
    <div class="actions">
      <button type="button" @click="$emit('copy-url')">复制 URL</button>
      <button type="button" @click="$emit('copy-svg')">复制 SVG</button>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  transition: box-shadow 0.15s, transform 0.15s;
}

.card:hover {
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.08);
  transform: translateY(-2px);
}

.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72px;
}

.preview img {
  max-width: 56px;
  max-height: 56px;
  object-fit: contain;
}

.info {
  min-width: 0;
}

.alias {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.code {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.version {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-sub);
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  flex: 1;
  padding: 6px 0;
  font-size: 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: #f9fafb;
  color: var(--text);
  cursor: pointer;
}

.actions button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>