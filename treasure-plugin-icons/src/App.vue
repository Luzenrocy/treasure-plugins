<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import IconCard from './components/IconCard.vue';
import type { IconMeta } from './types';

const icons = ref<IconMeta[]>([]);
const query = ref('');
const toast = ref('');
const toastTimer = ref<number | undefined>(undefined);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return icons.value;
  return icons.value.filter(
    (icon) =>
      icon.code.toLowerCase().includes(q) ||
      icon.alias.toLowerCase().includes(q) ||
      icon.name.toLowerCase().includes(q),
  );
});

function showToast(message: string) {
  toast.value = message;
  window.clearTimeout(toastTimer.value);
  toastTimer.value = window.setTimeout(() => {
    toast.value = '';
  }, 2000);
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} 已复制`);
  } catch {
    showToast('复制失败');
  }
}

function copyUrl(icon: IconMeta) {
  void copyText(new URL(icon.url, window.location.origin).toString(), `${icon.alias} URL`);
}

async function copySvg(icon: IconMeta) {
  try {
    const res = await fetch(icon.url);
    const text = await res.text();
    await copyText(text, `${icon.alias} SVG 源码`);
  } catch {
    showToast('获取 SVG 失败');
  }
}

onMounted(async () => {
  try {
    const res = await fetch('/icons.json');
    const payload = await res.json();
    icons.value = payload.icons ?? [];
  } catch {
    showToast('图标清单加载失败');
  }
});
</script>

<template>
  <main class="page">
    <header class="header">
      <h1>Treasure 插件图标</h1>
      <p class="subtitle">已发布插件图标 · 稳定 URL 资源站</p>
    </header>

    <section class="toolbar">
      <input v-model="query" class="search" type="search" placeholder="搜索 code / 别名 / 名称…" />
      <span class="count">共 {{ icons.length }} 个图标</span>
    </section>

    <section v-if="icons.length" class="grid">
      <IconCard v-for="icon in filtered" :key="icon.code" :icon="icon" @copy-url="copyUrl(icon)" @copy-svg="copySvg(icon)" />
    </section>
    <p v-else-if="!icons.length && !query" class="empty">暂无图标</p>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </main>
</template>

<style>
:root {
  color-scheme: light;
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
  --text: #1f2937;
  --text-sub: #6b7280;
  --accent: #2563eb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background: #f3f4f6;
  color: var(--text);
}

.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}

.header h1 {
  margin: 0 0 4px;
  font-size: 24px;
}

.subtitle {
  margin: 0;
  color: var(--text-sub);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 20px 0;
}

.search {
  flex: 1;
  max-width: 420px;
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  outline: none;
}

.search:focus {
  border-color: var(--accent);
}

.count {
  font-size: 13px;
  color: var(--text-sub);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.empty {
  color: var(--text-sub);
  text-align: center;
  padding: 48px 0;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: 8px;
  background: #111827;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>