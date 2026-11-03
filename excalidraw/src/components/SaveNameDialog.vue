<template>
  <div v-if="open" class="modal-backdrop" role="presentation" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="save-name-title">
      <h2 id="save-name-title">保存绘图</h2>
      <label class="modal__field">文件名<input v-model="name" autofocus type="text" placeholder="例如：项目草图" @keyup.enter="submit"></label>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <footer class="panel__footer"><button class="button" type="button" @click="$emit('close')">取消</button><button class="button button--primary" type="button" @click="submit">保存</button></footer>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; save: [fileName: string] }>();
const name = ref(''); const error = ref('');
watch(() => props.open, (open) => { if (open) { name.value = ''; error.value = ''; } });
function submit() { const value = name.value.trim(); if (!value) { error.value = '请输入文件名'; return; } if (!/^[^\\/:*?"<>|]+$/.test(value)) { error.value = '文件名包含不支持的字符'; return; } emit('save', value); }
</script>
