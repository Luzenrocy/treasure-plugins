<template>
  <section id="treasure-library-drawer" class="panel library-panel" aria-labelledby="library-panel-title" :aria-busy="loading">
    <header class="panel__header"><div><h2 id="library-panel-title">素材库</h2><p class="muted">官方目录与本地素材 · 已安装优先，下载量降序</p></div><div class="panel__header-actions"><button class="button button--quiet" type="button" @click="$emit('openCanvasLibrary')">画布素材库</button><button class="button button--quiet" type="button" :disabled="loading" @click="refresh">刷新</button></div></header>
    <div class="library-toolbar"><input v-model="keyword" aria-label="搜索素材" placeholder="搜索素材名称、作者" @input="runQuery"><button class="button button--quiet" type="button" @click="importLocal">本地导入</button></div>
    <p v-if="status" class="notice" aria-live="polite">{{ status }}</p><p v-if="error" class="notice notice--error" role="alert">{{ error }} <button type="button" @click="refresh">重试</button></p><p v-else-if="loading" class="empty-state">正在加载官方素材目录…</p><p v-else-if="!page.items.length" class="empty-state">没有匹配的素材</p>
    <div v-else class="scrollable-region library-list"><article v-for="item in page.items" :key="item.stableId" class="library-card"><div class="library-card__content"><h3>{{ item.name }}</h3><p class="library-card__description" :title="item.description || '暂无描述'">{{ item.description || '暂无描述' }}</p><small :title="`本周下载 ${formatDownloads(item.downloadsWeek)}`">{{ item.authors.map((author) => author.name).join('、') }} · v{{ item.version }} · ⬇️ {{ formatDownloads(item.downloadsTotal) }}</small></div><button type="button" class="button" :disabled="installing === item.stableId" @click="toggleInstall(item)">{{ installing === item.stableId ? (item.installed ? '卸载中…' : '安装中…') : item.installed ? '卸载' : '安装' }}</button></article></div>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { files } from 'treasure-sdk';
import { loadLibraryFromBlob } from '@excalidraw/excalidraw';
import { OfficialLibraryClient } from '../services/official-library-client';
import { LibraryService } from '../services/library-service';
import { queryLibraries, type LibraryItem, type LibraryPage } from '../domain/library';
const client = new OfficialLibraryClient(); const service = new LibraryService(); const emit = defineEmits<{ installed: [items: import('@excalidraw/excalidraw/types').LibraryItems]; uninstalled: [stableId: string]; openCanvasLibrary: [] }>();
const keyword = ref(''); const loading = ref(false); const error = ref(''); const status = ref(''); const installing = ref<string | null>(null); const items = ref<LibraryItem[]>([]); const page = ref<LibraryPage>({ items: [], total: 0, page: 1, pageSize: 24 });
let refreshController: AbortController | null = null;
function runQuery() { page.value = queryLibraries(items.value, { keyword: keyword.value, page: 1, pageSize: 24 }); }
function formatDownloads(value: number) { return String(value); }
async function refresh() {
  refreshController?.abort();
  const controller = new AbortController();
  refreshController = controller;
  loading.value = true; error.value = ''; status.value = '';
  const [response, installedResponse] = await Promise.all([client.load(controller.signal), service.readInstalled()]);
  if (controller.signal.aborted || refreshController !== controller) return;
  refreshController = null;
  if (!response.ok) { error.value = response.error.message; loading.value = false; return; }
  const installedIndex = installedResponse.ok ? installedResponse.value.index : {};
  items.value = response.value.map((item) => ({ ...item, installed: !!installedIndex[item.stableId], installedVersion: installedIndex[item.stableId]?.version }));
  runQuery(); status.value = client.sourceMode === 'github-fallback' ? '官方目录跨域不可读，已切换到官方 GitHub 镜像。' : ''; loading.value = false;
}
async function install(item: LibraryItem) { installing.value = item.stableId; status.value = '下载并校验素材…'; const response = await client.fetchSource(item); if (!response.ok) { status.value = response.error.message; installing.value = null; return; } const installed = await service.install(item, response.value); status.value = installed.ok ? '素材已安装，可在画布素材库中使用' : installed.error.message; if (installed.ok) { item.installed = true; try { const parsed = await loadLibraryFromBlob(new Blob([response.value], { type: 'application/vnd.excalidrawlib+json' })); emit('installed', parsed); } catch { /* install already persisted; next startup can recover it */ } } installing.value = null; }
async function uninstall(item: LibraryItem) { installing.value = item.stableId; status.value = '正在卸载素材…'; const result = await service.uninstall(item.stableId); status.value = result.ok ? '素材已卸载并从本地素材库删除' : result.error.message; if (result.ok) { item.installed = false; item.installedVersion = undefined; emit('uninstalled', item.stableId); } installing.value = null; }
async function toggleInstall(item: LibraryItem) { if (item.installed) await uninstall(item); else await install(item); }
async function importLocal() { const selected = await files.openDialog({ kind: 'file', multiple: false, title: '导入 .excalidrawlib 素材', filters: [{ name: 'Excalidraw 素材', extensions: ['excalidrawlib'] }] }); if (!selected.ok || !Array.isArray(selected.value) || !selected.value[0]) return; const result = await service.importLocal(selected.value[0]); status.value = result.ok ? '本地素材已校验，可保存到私有素材库' : result.error.message; }
onMounted(() => { void refresh(); });
onBeforeUnmount(() => { refreshController?.abort(); refreshController = null; });
</script>
