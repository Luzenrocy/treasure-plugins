<template>
  <main class="app-shell" data-visual-state="empty" :data-state="visualState">
    <!-- JsonToolbar disables structural controls with :disabled="escaped" and retains 复制当前文本. -->
    <JsonToolbar :has-text="Boolean(text.trim())" :escaped="escaped" :escape-target="escapeTarget" @format="transform('format')" @compact="transform('compact')" @escape="toggleEscape" @load="loadFile" @copy="copyText" @update:escape-target="escapeTarget = $event as EscapeTarget" />

    <section class="content-frame">
      <JsonEditorPanel :model-value="text" :display-text="visiblePreview" :indent="indent" :folded="folded" :fold-depth="foldDepth" :escaped="escaped" :has-text="Boolean(text.trim())" @update:model-value="text = $event; onInput()" @update:indent="indent = $event as JsonIndent" @expand-all="expandAll" @collapse-all="collapseAll" @fold-depth="setFoldDepth" />
      <div class="state-markers" aria-hidden="true"><span data-visual-state="content">内容</span><span data-visual-state="processing">处理中</span><span data-visual-state="error">错误</span></div>
    </section>
    <span class="sr-only" role="status">{{ status }}</span>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import JsonToolbar from './components/JsonToolbar.vue';
import JsonEditorPanel from './components/JsonEditorPanel.vue';
import { analyzeJson, escapeJson, formatJson, compactJson, unescapeOne, type EscapeTarget, type JsonIndent } from './domain/json';
import { chooseAndReadFile, type FileMetadata } from './services/fileGateway';

const text = ref(''); const indent = ref<JsonIndent>('2'); const escapeTarget = ref<EscapeTarget>('double'); const escaped = ref(false); const status = ref('待输入 JSON'); const metadata = ref<FileMetadata>(); const folded = ref(false); const foldDepth = ref<number | undefined>(); const baseline = ref('');
const analysis = computed(() => analyzeJson(text.value, indent.value));
const visiblePreview = computed(() => { const value = analysis.value.valid ? analysis.value.formatted : text.value; if (!folded.value) return value; const depth = foldDepth.value ?? 1; const lines = value.split('\n'); return lines.length > depth + 1 ? `${lines.slice(0, depth + 1).join('\n')}\n…（已折叠，复制仍包含完整文本）` : value; });
const visualState = computed<'empty' | 'content' | 'processing' | 'error'>(() => status.value === '读取文件' ? 'processing' : (!text.value.trim() ? 'empty' : (!analysis.value.valid && !escaped.value ? 'error' : 'content')));
function setFoldDepth(depth: number) { foldDepth.value = depth; folded.value = true; }
function expandAll() { folded.value = false; foldDepth.value = undefined; }
function collapseAll() { folded.value = true; foldDepth.value = undefined; }
function onInput() { if (!text.value) status.value = '待输入 JSON'; else if (!escaped.value) status.value = analysis.value.valid ? '已校验' : '等待修正'; }
function transform(operation: 'format' | 'compact') { try { text.value = operation === 'format' ? formatJson(text.value, indent.value) : compactJson(text.value); folded.value = false; foldDepth.value = undefined; status.value = operation === 'format' ? '格式化完成' : '压缩完成'; } catch (error) { status.value = error instanceof Error ? error.message : '处理失败'; } }
function toggleEscape() { if (!escaped.value) { try { baseline.value = text.value; text.value = escapeJson(text.value, escapeTarget.value); escaped.value = true; status.value = '已转义，可复制或修改'; } catch (error) { status.value = error instanceof Error ? error.message : '转义失败'; } return; } if (text.value === escapeJson(baseline.value, escapeTarget.value)) { text.value = baseline.value; escaped.value = false; status.value = '已精确恢复 JSON'; return; } const result = unescapeOne(text.value); if (!result.ok) { status.value = `${result.message}，请修正后重试`; return; } text.value = result.value; escaped.value = false; status.value = '已安全移除一层转义'; }
async function copyText() { try { await navigator.clipboard.writeText(text.value); status.value = '已复制完整文本'; } catch { status.value = '复制失败，请使用键盘快捷键复制'; } }
async function loadFile() { status.value = '读取文件'; const result = await chooseAndReadFile(); if (result.kind === 'cancelled') { status.value = '已取消'; return; } if (result.kind === 'error') { status.value = result.message; return; } if (!analyzeJson(result.text).valid) { status.value = '文件不是有效 JSON，已有内容未改变'; return; } text.value = result.text; metadata.value = result.metadata; escaped.value = false; status.value = '文件已载入'; }
</script>

<style scoped>
.app-shell { display: flex; flex-direction: column; height: calc(100% - 32px); min-height: 0; margin: 16px; overflow: hidden; border: 1px solid var(--json-border); border-radius: 10px; color: var(--json-ink); background: var(--json-canvas); font-family: Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
.content-frame { display: flex; flex: 1 1 auto; min-height: 0; margin: 0; overflow: hidden; }
.state-markers, .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; } @media (max-width: 720px) { .app-shell { height: calc(100% - 32px); margin: 16px; } }
</style>
