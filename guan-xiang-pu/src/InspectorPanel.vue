<template>
  <div v-if="!drawer" class="panel-title">{{ kind === 'theme' ? '主题' : '节点样式' }}<IconButton :label="kind === 'theme' ? '关闭主题面板' : '关闭属性面板'" icon="close" @click="$emit('close')" /></div>
  <template v-if="kind === 'theme'">
    <div class="field-label" style="margin-bottom:14px">当前画布</div>
    <button v-for="key in themeChoices" :key="key" class="theme-card" :class="{ selected: themeKey === key }" :aria-pressed="themeKey === key" @click="$emit('theme', key)">
      <i class="theme-colors"><i v-for="fill in themes[key].fills" :key="fill" :style="{ background: fill }"></i></i>
      <span>{{ themes[key].name }}</span><UiIcon v-if="themeKey === key" name="check" :size="14" />
    </button>
  </template>
  <template v-else-if="node">
    <div class="field"><label class="field-label" for="node-title">主题文字</label><textarea id="node-title" :value="node.text" maxlength="500" @change="$emit('text', ($event.target as HTMLTextAreaElement).value)"></textarea></div>
    <div class="field"><span class="field-label">填充</span><div class="swatches">
      <button v-for="(fill, index) in [undefined, ...theme.fills]" :key="fill || 'default'" class="swatch" :class="{ selected: node.style?.fill === fill }" :style="{ background: fill || theme.root }" :aria-label="index ? '填充颜色 ' + index : '跟随主题'" :aria-pressed="node.style?.fill === fill" @click="$emit('fill', fill)"></button>
    </div></div>
    <div class="field"><label class="field-label" for="node-note">备注</label><textarea id="node-note" :value="node.note || ''" placeholder="添加备注…" @change="$emit('note', ($event.target as HTMLTextAreaElement).value)"></textarea></div>
    <button class="text-button" @click="$emit('fill', undefined)">恢复主题样式</button>
  </template>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { MindNode, Theme } from './domain';
import { primaryThemes, themes } from './canvas';
import IconButton from './IconButton.vue';
import UiIcon from './UiIcon.vue';
const props = defineProps<{ kind: 'theme' | 'style'; themeKey: Theme; node?: MindNode; drawer?: boolean }>();
defineEmits<{ close: []; theme: [value: Theme]; text: [value: string]; fill: [value: string | undefined]; note: [value: string] }>();
const theme = computed(() => themes[props.themeKey] ?? themes.violet);
const themeChoices = computed(() => primaryThemes.includes(props.themeKey) ? primaryThemes : [...primaryThemes, props.themeKey]);
</script>
