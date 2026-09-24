<template>
  <section class="json-toolbar" aria-label="JSON 操作工具栏">
    <button class="primary" type="button" :disabled="escaped || !hasText" @click="$emit('format')">格式化</button>
    <button type="button" :disabled="escaped || !hasText" @click="$emit('compact')">压缩</button>
    <label class="toolbar-select">转义目标
      <select :value="escapeTarget" :disabled="escaped" @change="$emit('update:escapeTarget', ($event.target as HTMLSelectElement).value)">
        <option value="double">双引号字符串</option><option value="single">单引号字符串</option><option value="both">两种引号</option>
      </select>
    </label>
    <button type="button" :disabled="!hasText" @click="$emit('escape')">{{ escaped ? '取消转义' : '转义字符' }}</button>
    <button type="button" @click="$emit('load')">从文件载入</button>
    <span class="toolbar-spacer" />
    <button type="button" :disabled="!hasText" @click="$emit('copy')">复制当前文本</button>
  </section>
</template>

<script setup lang="ts">
import type { EscapeTarget } from '../domain/json';
defineProps<{ hasText: boolean; escaped: boolean; escapeTarget: EscapeTarget }>();
defineEmits<{ (event: 'format' | 'compact' | 'escape' | 'load' | 'copy'): void; (event: 'update:escapeTarget', value: string): void }>();
</script>

<style scoped>
.json-toolbar { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 16px 6px; }
button, select { min-height: 32px; border: 1px solid var(--json-border); border-radius: 6px; background: var(--json-panel); color: var(--json-ink); padding: 6px 11px; font: inherit; font-weight: 650; cursor: pointer; }
button:hover:not(:disabled), select:hover:not(:disabled) { border-color: var(--json-border-strong); } button.primary { border-color: var(--json-purple); background: var(--json-purple); color: #fffaf1; } button:disabled, select:disabled { color: var(--json-disabled); cursor: not-allowed; opacity: .82; }
.toolbar-select { display: inline-flex; align-items: center; gap: 7px; color: var(--json-muted); font-size: 13px; } .toolbar-select select { min-width: 150px; } .toolbar-spacer { flex: 1; }
@media (max-width: 720px) { .toolbar-spacer { flex-basis: 100%; } .json-toolbar { margin: 6px 10px 5px; } }
</style>
