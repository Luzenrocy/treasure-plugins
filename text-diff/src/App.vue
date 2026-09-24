<template>
  <main class="app-shell" data-visual-state="empty" :data-state="visualState">
    <DiffToolbar aria-label="文本对比工具栏">
      <button class="primary" type="button" @click="swapSides">交换左右</button>
      <button class="secondary" :disabled="!hasPrevious" type="button" @click="navigate(-1)">↑ 上一处</button><button class="secondary" :disabled="!hasNext" type="button" @click="navigate(1)">↓ 下一处</button>
      <div class="toolbar-options">
        <label><input v-model="settings.ignoreTrailingWhitespace" type="checkbox" /> 忽略行首行尾空白</label><label><input v-model="settings.wordWrap" type="checkbox" /> 自动换行</label><label><input v-model="settings.hideUnchanged" type="checkbox" /> 折叠相同内容</label>
      </div>
      <div class="diff-legend" aria-label="差异颜色说明"><span class="legend-removed">− 仅左侧</span><span class="legend-added">+ 仅右侧</span><span class="legend-changed">~ 内容不同</span></div>
    </DiffToolbar>

    <section class="diff-editor" aria-label="双栏文本编辑器">
      <article class="diff-column" data-side="left">
        <header class="column-head"><div><strong>左侧文本</strong><span v-if="leftFileName">{{ leftFileName }}</span></div><button class="secondary" type="button" @click="loadFile('left')">从文件载入</button></header>
        <div class="input-stage" :class="{ wrap: settings.wordWrap, composing: composingSide === 'left' }">
          <pre class="inline-diff-layer" aria-hidden="true" :style="overlayStyle('left')" v-html="leftInlineHtml" />
          <div class="text-stage" :class="{ wrap: settings.wordWrap, composing: composingSide === 'left' }"><textarea ref="leftEditor" v-model="leftText" class="scrollable-region" aria-label="左侧文本" spellcheck="false" placeholder="在这里输入或粘贴左侧文本..." @compositionstart="composingSide = 'left'" @compositionend="composingSide = undefined" @input="onInput('left')" @scroll="syncScroll('left')" /></div>
        </div>
      </article>
      <article class="diff-column" data-side="right">
        <header class="column-head"><div><strong>右侧文本</strong><span v-if="rightFileName">{{ rightFileName }}</span></div><button class="secondary" type="button" @click="loadFile('right')">从文件载入</button></header>
        <div class="input-stage" :class="{ wrap: settings.wordWrap, composing: composingSide === 'right' }">
          <pre class="inline-diff-layer" aria-hidden="true" :style="overlayStyle('right')" v-html="rightInlineHtml" />
          <div class="text-stage" :class="{ wrap: settings.wordWrap, composing: composingSide === 'right' }"><textarea ref="rightEditor" v-model="rightText" class="scrollable-region" aria-label="右侧文本" spellcheck="false" placeholder="在这里输入或粘贴右侧文本..." @compositionstart="composingSide = 'right'" @compositionend="composingSide = undefined" @input="onInput('right')" @scroll="syncScroll('right')" /></div>
        </div>
      </article>
    </section>

    <span class="sr-only" role="status">{{ status }}</span>
    <span class="state-marker" data-visual-state="content" aria-hidden="true" /><span class="state-marker" data-visual-state="processing" aria-hidden="true" /><span class="state-marker" data-visual-state="error" aria-hidden="true" />
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import DiffToolbar from './components/DiffToolbar.vue';
import { createTextSide, markDirty, updateTextSide, type TextSide } from './domain/textSide';
import { DiffCoordinator } from './services/diffCoordinator';
import { chooseAndReadFile } from './services/fileGateway';
import { buildInlineRows, renderInlineSide } from './editor/inlineDiff';
import { defaultDiffSettings, type DiffSettings } from './domain/diffSettings';

const left = ref<TextSide>(createTextSide('left')); const right = ref<TextSide>(createTextSide('right')); const settings = reactive<DiffSettings>({ ...defaultDiffSettings });
const leftEditor = ref<HTMLTextAreaElement>(); const rightEditor = ref<HTMLTextAreaElement>(); const leftScrollTop = ref(0); const rightScrollTop = ref(0); const composingSide = ref<'left' | 'right'>();
const result = ref<ReturnType<DiffCoordinator['compare']>>(); const status = ref('待输入文本'); const currentIndex = ref(-1); const coordinator = new DiffCoordinator();
const leftText = computed({ get: () => left.value.text, set: (value: string) => { left.value = markDirty(left.value, value); } }); const rightText = computed({ get: () => right.value.text, set: (value: string) => { right.value = markDirty(right.value, value); } });
const leftFileName = computed(() => left.value.metadata?.fileName); const rightFileName = computed(() => right.value.metadata?.fileName);
const visualState = computed(() => status.value.includes('失败') || status.value.includes('错误') ? 'error' : status.value.includes('读取') ? 'processing' : result.value ? 'content' : 'empty');
const inlineRows = computed(() => buildInlineRows(result.value)); const differences = computed(() => inlineRows.value.filter((row) => row.kind !== 'same'));
const leftInlineHtml = computed(() => inlineRows.value.map((row) => renderInlineSide(row, 'left')).filter(Boolean).join('')); const rightInlineHtml = computed(() => inlineRows.value.map((row) => renderInlineSide(row, 'right')).filter(Boolean).join(''));
const hasPrevious = computed(() => differences.value.length > 0 && currentIndex.value > 0); const hasNext = computed(() => differences.value.length > 0 && currentIndex.value < differences.value.length - 1);
function recompute() { if (!left.value.text && !right.value.text) { result.value = undefined; currentIndex.value = -1; status.value = '待输入文本'; return; } result.value = coordinator.compare(left.value, right.value, settings); currentIndex.value = result.value.total ? 0 : -1; status.value = result.value.total ? `已找到 ${result.value.total} 处差异` : '两侧文本一致'; }
watch(() => [left.value.text, right.value.text, settings.ignoreTrailingWhitespace], recompute); watch(() => settings.hideUnchanged, () => { if (currentIndex.value >= differences.value.length) currentIndex.value = differences.value.length - 1; });
function onInput(side: 'left' | 'right') { status.value = `${side === 'left' ? '左侧' : '右侧'}已编辑`; recompute(); }
function navigate(step: number) { const next = currentIndex.value + step; if (next >= 0 && next < differences.value.length) currentIndex.value = next; }
function swapSides() { const value = left.value; left.value = { ...right.value, side: 'left' }; right.value = { ...value, side: 'right' }; status.value = '已交换左右文本'; recompute(); }
function overlayStyle(side: 'left' | 'right') { return { transform: `translateY(-${side === 'left' ? leftScrollTop.value : rightScrollTop.value}px)` }; }
function syncScroll(side: 'left' | 'right') { const source = side === 'left' ? leftEditor.value : rightEditor.value; const target = side === 'left' ? rightEditor.value : leftEditor.value; if (!source) return; if (side === 'left') leftScrollTop.value = source.scrollTop; else rightScrollTop.value = source.scrollTop; if (target && Math.abs(target.scrollTop - source.scrollTop) > 1) { target.scrollTop = source.scrollTop; if (side === 'left') rightScrollTop.value = source.scrollTop; else leftScrollTop.value = source.scrollTop; } }
async function loadFile(side: 'left' | 'right') { status.value = `读取${side === 'left' ? '左侧' : '右侧'}文件`; const loaded = await chooseAndReadFile(); if (loaded.kind === 'cancelled') { status.value = '已取消'; return; } if (loaded.kind === 'error') { status.value = loaded.message; return; } if (side === 'left') left.value = updateTextSide(left.value, loaded.text, loaded.metadata); else right.value = updateTextSide(right.value, loaded.text, loaded.metadata); status.value = '文件已载入'; recompute(); }
</script>

<style scoped>
/* 手动调整入口：修改这里即可同步影响两侧编辑器。 */
.app-shell {
  /* 编辑区左侧行号整列宽度（.inline-gutter 所在的第一列；截图红框区域）。 */
  --diff-gutter-width: 26px;
  --diff-column-template: 1fr 1fr;
  --diff-editor-font-size: 14px;
  --diff-editor-line-height: 22px;
  --diff-editor-padding: 6px;
  --diff-line-number-font-size: 12px;
  /* 仅行号数字 <span> 自身的宽度，不是上面的整列宽度。通常保持 0，让数字按内容居中。 */
  --diff-line-number-column-width: 0px;
  /* 行号在整列中居中；保持 0，不改变正文编辑区起点。 */
  --diff-line-number-offset-x: 0px;

  display: flex;
  flex-direction: column;
  height: calc(100% - 32px);
  min-height: 0;
  margin: 16px;
  overflow: hidden;
  border: 1px solid var(--diff-border-strong);
  border-radius: 10px;
  color: var(--diff-text);
  background: var(--diff-canvas);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}

/* 工具栏：按钮与图例从左向右排列。 */
:deep(.diff-toolbar) {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 16px 6px;
  padding: 0;
  border: 0;
  background: transparent;
}

.toolbar-options,
.diff-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--diff-muted);
  font-size: 12px;
}

.diff-legend {
  gap: 6px;
}

.diff-legend span {
  padding: 2px 6px;
  border-radius: 3px;
}

.legend-removed { background: var(--diff-removed-bg); }
.legend-added { background: var(--diff-added-bg); }
.legend-changed { background: var(--diff-changed-bg); }

button {
  border: 1px solid var(--diff-border);
  border-radius: 6px;
  padding: 6px 11px;
  color: var(--diff-text);
  background: var(--diff-panel);
  cursor: pointer;
  font: inherit;
  font-weight: 650;
}

button.primary {
  color: #fff;
  border-color: var(--diff-purple);
  background: var(--diff-purple);
}

button:hover:not(:disabled) { border-color: var(--diff-purple); }
button:disabled { opacity: .46; cursor: not-allowed; }

input:focus-visible,
button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--diff-purple) 30%, transparent);
  outline-offset: 2px;
}

/* 双栏布局：--diff-column-template 可改成例如 3fr 2fr。 */
.diff-editor {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: var(--diff-column-template);
  min-height: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--diff-panel);
}

.diff-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--diff-editor);
}

.diff-column + .diff-column { border-left: 1px solid var(--diff-border-strong); }

/* 列标题。min-height 控制标题栏高度，padding 控制内部上下左右留白。 */
.column-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-height: 38px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--diff-border);
  background: var(--diff-header);
}

.column-head div {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.column-head strong { font-size: 13px; }
.column-head span { color: var(--diff-muted); font-size: 12px; }
.column-head button { padding: 4px 8px; font-size: 12px; }

/* 编辑区：textarea 从 gutter 右侧开始，叠加层只负责显示差异颜色。 */
.input-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--diff-editor);
}

.inline-diff-layer,
textarea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  font: var(--diff-editor-font-size) / var(--diff-editor-line-height) "SFMono-Regular", Consolas, monospace;
  tab-size: 2;
  white-space: pre;
}

.inline-diff-layer {
  padding: var(--diff-editor-padding);
  pointer-events: none;
  color: var(--diff-text);
  overflow: hidden;
}

/* gutter 宽度与行号列宽度由 --diff-gutter-width 统一控制。 */
.text-stage {
  position: absolute;
  z-index: 1;
  inset: 0 0 0 var(--diff-gutter-width);
  min-width: 0;
  box-sizing: border-box;
  border-left: 1px solid var(--diff-border-strong);
}

textarea {
  z-index: 1;
  display: block;
  padding: var(--diff-editor-padding);
  resize: none;
  outline: none;
  overflow: auto;
  color: transparent;
  background: transparent;
  caret-color: var(--diff-text);
  -webkit-text-fill-color: transparent;
}

.input-stage.wrap .inline-diff-layer,
.text-stage.wrap textarea,
.input-stage.wrap :deep(.inline-text) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

textarea::placeholder {
  color: var(--diff-muted);
  -webkit-text-fill-color: var(--diff-muted);
}

/* 输入法组合期间显示原生 textarea 文本，避免叠加层遮挡拼音候选输入。 */
.input-stage.composing :deep(.inline-text) { color: transparent; }
.input-stage.composing :deep(.inline-char-changed) { background: transparent; }
.text-stage.composing textarea {
  color: var(--diff-text);
  -webkit-text-fill-color: var(--diff-text);
}

/* 行号与差异行：gutter 内水平居中，文本从第二列开始。 */
:deep(.inline-diff-row) {
  display: grid;
  grid-template-columns: var(--diff-gutter-width) minmax(0, 1fr);
  min-height: var(--diff-editor-line-height);
  margin-inline: calc(-1 * var(--diff-editor-padding));
  line-height: var(--diff-editor-line-height);
}

:deep(.inline-diff-row.kind-added) { background: var(--diff-added-bg); }
:deep(.inline-diff-row.kind-removed) { background: var(--diff-removed-bg); }
:deep(.inline-diff-row.kind-changed) { background: var(--diff-changed-bg); }

:deep(.inline-gutter) {
  position: relative;
  display: flex;
  grid-column: 1;
  justify-content: center;
  color: var(--diff-muted);
  user-select: none;
}

:deep(.inline-line-number) {
  position: absolute;
  top: 0;
  left: 50%;
  width: max-content;
  min-width: var(--diff-line-number-column-width);
  text-align: center;
  font-size: var(--diff-line-number-font-size);
  transform: translateX(calc(-50% + var(--diff-line-number-offset-x)));
}

:deep(.inline-text) {
  grid-column: 2;
  padding: 0 var(--diff-editor-padding);
  white-space: pre;
}

:deep(.inline-char-changed) {
  padding: 0;
  color: inherit;
  background: var(--diff-old);
}

[data-side="right"] :deep(.inline-char-changed) { background: var(--diff-new); }

/* 仅编辑区滚动，滚动条保持细窄。 */
.scrollable-region::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollable-region::-webkit-scrollbar-track { background: transparent; }
.scrollable-region::-webkit-scrollbar-thumb {
  background: #d3d7da;
  border-radius: 3px;
}

.state-marker,
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 820px) {
  .app-shell {
    height: calc(100% - 32px);
    margin: 16px;
  }

  .toolbar-options {
    flex-basis: 100%;
    flex-wrap: wrap;
  }

  .diff-editor {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .diff-column { min-height: 340px; }

  .diff-column + .diff-column {
    border-top: 1px solid var(--diff-border-strong);
    border-left: 0;
  }
}
</style>
