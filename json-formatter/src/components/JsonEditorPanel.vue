<template>
  <section class="json-editor-panel" aria-label="JSON 编辑区">
    <header class="editor-head">
      <div class="editor-controls">
        <label>缩进<select :value="indent" :disabled="escaped" @change="emit('update:indent', ($event.target as HTMLSelectElement).value)"><option value="2">2 空格</option><option value="4">4 空格</option><option value="tab">Tab</option></select></label>
        <button type="button" :disabled="escaped || !hasText" @click="expandAll">全部展开</button>
        <button type="button" :disabled="escaped || !hasText" @click="collapseAll">全部折叠</button>
        <label>展开层级<select :value="foldDepth ?? ''" :disabled="escaped || !hasText" @change="setFoldDepth(Number(($event.target as HTMLSelectElement).value))"><option value="">全部</option><option value="1">1 层</option><option value="2">2 层</option><option value="3">3 层</option></select></label>
      </div>
    </header>
    <div class="editor-body" :class="{ folded }">
      <div class="gutter" aria-hidden="true"><div :style="scrollTransform"><span v-for="row in visibleRows" :key="row.line">{{ row.line }}</span></div></div>
      <div class="fold-gutter"><div :style="scrollTransform"><button v-for="row in visibleRows" :key="row.line" type="button" :class="{ placeholder: !row.foldable }" :disabled="escaped || !row.foldable" :aria-label="row.foldable ? `${row.collapsed ? '展开' : '折叠'}第 ${row.line} 行对象` : undefined" @click="toggleManualFold(row.line)"><span v-if="row.foldable" aria-hidden="true">{{ row.collapsed ? '›' : '⌄' }}</span></button></div></div>
      <div class="code-stage">
        <pre class="syntax-layer" aria-hidden="true" :style="scrollTransform" v-html="highlightedRows" />
        <textarea class="scrollable-region" :value="displayText" :readonly="folded" aria-label="JSON 编辑区" spellcheck="false" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" @scroll="syncScroll" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { JsonIndent } from '../domain/json';
import { renderFoldedRows } from '../editor/jsonFolding';

const props = defineProps<{ modelValue: string; displayText: string; indent: JsonIndent; folded: boolean; foldDepth?: number; escaped: boolean; hasText: boolean }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void; (event: 'update:indent', value: string): void; (event: 'expandAll' | 'collapseAll'): void; (event: 'foldDepth', value: number): void }>();
const scrollTop = ref(0);
const manualFoldStarts = ref<Set<number>>(new Set());
const visibleRows = computed(() => renderFoldedRows(props.displayText, manualFoldStarts.value));
const scrollTransform = computed(() => ({ transform: `translateY(-${scrollTop.value}px)` }));
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function highlightLine(value: string) { return escapeHtml(value).replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?/g, (_match, quoted, colon) => colon ? `<span class="json-key">${quoted}</span>${colon}` : `<span class="json-string">${quoted}</span>`).replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>').replace(/\b(true|false|null)\b/g, '<span class="json-literal">$1</span>'); }
const highlightedRows = computed(() => visibleRows.value.map((row) => `<span class="syntax-row${row.collapsed ? ' collapsed-row' : ''}">${highlightLine(row.text)}</span>`).join(''));
watch(() => props.displayText, () => { manualFoldStarts.value = new Set(); });
function toggleManualFold(line: number) { const next = new Set(manualFoldStarts.value); if (next.has(line)) next.delete(line); else next.add(line); manualFoldStarts.value = next; }
function expandAll() { manualFoldStarts.value = new Set(); emit('expandAll'); }
function collapseAll() { manualFoldStarts.value = new Set(); emit('collapseAll'); }
function setFoldDepth(depth: number) { manualFoldStarts.value = new Set(); emit('foldDepth', depth); }
function syncScroll(event: Event) { scrollTop.value = (event.target as HTMLTextAreaElement).scrollTop; }
</script>

<style scoped>
.json-editor-panel { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; border: 0; border-radius: 0; background: var(--json-panel); }
.editor-head { display: flex; flex: 0 0 auto; align-items: center; justify-content: flex-start; gap: 8px; min-height: 38px; padding: 6px 12px; border-bottom: 1px solid var(--json-border); color: var(--json-muted); background: var(--json-panel-strong); font-size: 13px; }
.editor-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } .editor-controls label { display: inline-flex; align-items: center; gap: 4px; }
.editor-controls button, .editor-controls select { border: 1px solid var(--json-border); border-radius: 6px; background: var(--json-panel); color: var(--json-ink); padding: 4px 8px; font: inherit; } .editor-controls button:disabled, .editor-controls select:disabled { color: var(--json-disabled); }
.editor-body { display: flex; flex: 1 1 auto; min-height: 0; background: var(--json-panel); } .gutter { flex: 0 0 48px; padding: 17px 10px 17px 0; color: var(--json-muted); text-align: right; user-select: none; overflow: hidden; font: 13px/1.65 "SFMono-Regular", Consolas, monospace; } .gutter span { display: block; height: 21px; } .fold-gutter { flex: 0 0 26px; padding-block: 15px; overflow: hidden; } .fold-gutter button { display: block; width: 26px; height: 21px; border: 0; padding: 0; color: var(--json-muted); background: transparent; cursor: pointer; font: 15px/21px sans-serif; } .fold-gutter button:hover:not(:disabled), .fold-gutter button:focus-visible { color: var(--json-purple); background: var(--json-panel-strong); } .fold-gutter button:disabled, .fold-gutter button.placeholder { cursor: default; opacity: 0; }
.code-stage { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden; } .syntax-layer, textarea { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 17px 20px; border: 0; white-space: pre; font: 13px/1.65 "SFMono-Regular", Consolas, monospace; tab-size: 2; } .syntax-layer { pointer-events: none; color: var(--json-ink); } textarea { z-index: 1; resize: none; outline: none; overflow: auto; background: transparent; color: transparent; caret-color: var(--json-ink); -webkit-text-fill-color: transparent; } textarea:focus { box-shadow: inset 0 0 0 2px #7350ad33; }
:deep(.syntax-row) { display: block; height: 21px; } :deep(.collapsed-row) { color: var(--json-muted); } :deep(.json-key) { color: var(--json-key); } :deep(.json-string) { color: var(--json-string); } :deep(.json-number) { color: var(--json-number); } :deep(.json-literal) { color: var(--json-literal); }
.folded textarea { color: var(--json-muted); -webkit-text-fill-color: var(--json-muted); }
.scrollable-region::-webkit-scrollbar { width: 6px; height: 6px; } .scrollable-region::-webkit-scrollbar-track { background: transparent; } .scrollable-region::-webkit-scrollbar-thumb { background: #d3d7da; border-radius: 3px; }
@media (max-width: 720px) { .editor-head { align-items: flex-start; flex-direction: column; } }
</style>
