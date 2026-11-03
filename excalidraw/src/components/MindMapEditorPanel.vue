<template>
  <aside v-if="document" class="mind-map-editor" aria-label="思维导图编辑器">
    <header><strong>思维导图</strong><button class="button button--quiet" type="button" @click="$emit('close')">关闭</button></header>
    <div class="mind-map-editor__tree" role="tree" aria-label="主题树">
      <div v-for="node in orderedNodes" :key="node.id" class="mind-map-editor__tree-row" :style="{ paddingLeft: `${8 + node.depth * 16}px` }" role="treeitem" :aria-expanded="node.hasChildren ? isExpanded(node.id) : undefined">
        <button v-if="node.hasChildren" class="mind-map-editor__expander" type="button" :aria-label="isExpanded(node.id) ? '折叠子主题' : '展开子主题'" @click.stop="toggleExpanded(node.id)">{{ isExpanded(node.id) ? '⌄' : '›' }}</button>
        <span v-else class="mind-map-editor__expander mind-map-editor__expander--placeholder" aria-hidden="true" />
        <button class="mind-map-editor__node" :class="{ 'is-selected': node.id === selectedId }" type="button" @click="$emit('select', node.id)">{{ node.title }}</button>
      </div>
    </div>
    <label>主题<input v-model="title" type="text" maxlength="500" @keyup.enter="rename" /></label>
    <div class="mind-map-editor__actions"><button class="button button--primary" type="button" @click="$emit('addChild', selectedId)">新增子主题</button><button class="button" type="button" @click="rename">重命名</button><button class="button" type="button" @click="$emit('move', selectedId, -1)">上移</button><button class="button" type="button" @click="$emit('move', selectedId, 1)">下移</button><button class="button" type="button" :disabled="selectedId === document.rootId" @click="$emit('remove', selectedId)">删除子树</button><button class="button" type="button" @click="$emit('relayout')">重新整理</button></div>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MindMapDocument } from '../domain/mind-map';
const props = defineProps<{ document: MindMapDocument | null; selectedId: string | null }>();
const emit = defineEmits<{ close: []; select: [id: string]; addChild: [id: string | null]; rename: [id: string | null, title: string]; remove: [id: string | null]; move: [id: string | null, offset: -1 | 1]; relayout: [] }>();
const title = ref('');
// Nodes are expanded by default. Keeping only explicit collapses means a newly
// added child is immediately visible without resetting the user's tree state.
const collapsedIds = ref(new Set<string>());
watch(() => [props.document, props.selectedId] as const, () => { title.value = props.document && props.selectedId ? props.document.nodes[props.selectedId]?.title || '' : ''; }, { immediate: true });
watch(() => props.document?.mindMapId, () => { collapsedIds.value = new Set(); });
const orderedNodes = computed(() => { const result: Array<{ id: string; title: string; depth: number; hasChildren: boolean }> = []; const visit = (id: string, depth: number) => { const node = props.document?.nodes[id]; if (!node) return; const hasChildren = node.childIds.length > 0; result.push({ id, title: node.title, depth, hasChildren }); if (hasChildren && !collapsedIds.value.has(id)) node.childIds.forEach((child) => visit(child, depth + 1)); }; if (props.document) visit(props.document.rootId, 0); return result; });
function isExpanded(id: string) { return !collapsedIds.value.has(id); }
function toggleExpanded(id: string) { const next = new Set(collapsedIds.value); if (next.has(id)) next.delete(id); else next.add(id); collapsedIds.value = next; }
function rename() { emit('rename', props.selectedId, title.value); }
</script>
<style scoped>
.mind-map-editor { position:absolute; z-index:1001; right:12px; bottom:12px; width:min(300px,calc(100% - 24px)); max-height:min(70vh,560px); overflow:auto; background:var(--color-surface-primary,#fff); border:1px solid var(--color-border,#ddd); border-radius:8px; padding:12px; box-shadow:0 8px 24px #0002; }
.mind-map-editor header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }.mind-map-editor__tree { max-height:220px; overflow:auto; border:1px solid #e9ecef; margin-bottom:8px; }.mind-map-editor__tree-row { display:flex; align-items:stretch; min-height:30px; }.mind-map-editor__expander { flex:0 0 24px; width:24px; border:0; background:transparent; color:#495057; cursor:pointer; font-size:20px; line-height:1; }.mind-map-editor__expander--placeholder { pointer-events:none; }.mind-map-editor__node { display:block; flex:1; min-width:0; min-height:30px; padding:0 8px; text-align:left; border:0; background:transparent; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.mind-map-editor__node.is-selected { background:#e7f5ff; color:#1864ab; }.mind-map-editor label { display:grid; gap:4px; font-size:13px; }.mind-map-editor input { min-width:0; padding:6px; }.mind-map-editor__actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }.mind-map-editor__actions .button { font-size:12px; }
</style>
