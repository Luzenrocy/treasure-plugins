<template>
  <div v-if="items.length" class="library-quick-toolbar" :class="{ 'library-quick-toolbar--expanded': expanded }" :style="toolbarStyle" role="toolbar" aria-label="已安装素材">
    <button v-if="expanded" class="library-quick-toolbar__slot library-quick-toolbar__control" type="button" title="收起素材" @click="collapse">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3M3 3l6 6M16 3v5h5M21 3l-6 6M3 16h5v5M3 21l6-6M21 16h-5v5M21 21l-6-6" /></svg>
    </button>
    <button v-else-if="showExpand" class="library-quick-toolbar__slot library-quick-toolbar__control" type="button" title="展开全部素材" @click="expand">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7M3 9V3h6M3 3l7 7M21 15v6h-6M21 21l-7-7" /></svg>
    </button>
    <button v-for="item in visibleItems" :key="item.id" class="library-quick-toolbar__slot" type="button" :title="item.name || '未命名素材'" @click="$emit('insert', item)">
      <span v-if="previewSvg[item.id]" class="library-quick-toolbar__preview" v-html="previewSvg[item.id]" />
      <span v-else class="library-quick-toolbar__fallback">{{ (item.name || '素材').slice(0, 1) }}</span>
    </button>
    <button v-if="showPrevious" class="library-quick-toolbar__slot library-quick-toolbar__control" type="button" title="上一页素材" @click="previous">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7M20 5v14" /></svg>
    </button>
    <button v-if="showNext" class="library-quick-toolbar__slot library-quick-toolbar__control" type="button" title="下一页素材" @click="next">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7M4 5v14" /></svg>
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { exportToSvg } from '@excalidraw/excalidraw';
import type { LibraryItem, LibraryItems } from '@excalidraw/excalidraw/types';

const props = defineProps<{ items: LibraryItems }>();
defineEmits<{ insert: [item: LibraryItem] }>();
const firstPageSize = 11;
const followingPageSize = 10;
const page = ref(0);
const expanded = ref(false);
const previewSvg = ref<Record<string, string>>({});
const pageCount = computed(() => Math.max(1, 1 + Math.ceil(Math.max(0, props.items.length - firstPageSize) / followingPageSize)));
const atLastPage = computed(() => page.value >= pageCount.value - 1);
const showPrevious = computed(() => !expanded.value && page.value > 0);
const showNext = computed(() => !expanded.value && !atLastPage.value);
const showExpand = computed(() => !expanded.value && props.items.length > 13 && !atLastPage.value);
const visibleItems = computed(() => {
  if (expanded.value || props.items.length <= 13) return props.items;
  const start = page.value === 0 ? 0 : firstPageSize + (page.value - 1) * followingPageSize;
  const size = page.value === 0 ? firstPageSize : followingPageSize;
  return props.items.slice(start, start + size);
});
const rowCount = computed(() => expanded.value ? 13 : visibleItems.value.length + Number(showPrevious.value) + Number(showNext.value) + Number(showExpand.value));
const expandedColumnCount = computed(() => Math.max(1, Math.ceil((props.items.length + 1) / 13)));
const toolbarStyle = computed(() => ({
  '--quick-rows': rowCount.value,
  '--quick-expanded-columns': expandedColumnCount.value,
  '--quick-width': expanded.value ? `${expandedColumnCount.value * 36 + Math.max(0, expandedColumnCount.value - 1) * 6 + 10}px` : '44px',
  '--quick-height': expanded.value ? '550px' : `${rowCount.value * 36 + Math.max(0, rowCount.value - 1) * 6 + 10}px`,
}));

function previous() { page.value = Math.max(0, page.value - 1); }
function next() { page.value = Math.min(pageCount.value - 1, page.value + 1); }
function expand() { expanded.value = true; }
function collapse() { expanded.value = false; page.value = 0; }

async function buildPreviews(items: LibraryItems) {
  const next: Record<string, string> = {};
  await Promise.all(items.map(async (item) => {
    try {
      const svg = await exportToSvg({
        elements: item.elements as never,
        appState: {
          exportBackground: false,
          exportPadding: 8,
          exportScale: 1,
          viewBackgroundColor: 'transparent',
        },
        files: null,
        skipInliningFonts: true,
      });
      next[item.id] = new XMLSerializer().serializeToString(svg);
    } catch {
      // Keep the initial-letter fallback when a library item cannot be rendered.
    }
  }));
  previewSvg.value = next;
}

watch(() => props.items, (items) => {
  page.value = 0;
  expanded.value = false;
  void buildPreviews(items);
}, { immediate: true });
</script>
