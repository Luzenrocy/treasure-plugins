<template>
  <div v-if="open" class="modal-backdrop" role="presentation" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="new-drawing-title">
      <h2 id="new-drawing-title">新建文件</h2>
      <p>选择新文件的编辑方式。</p>
      <footer class="panel__footer"><button class="button" type="button" @click="$emit('create', 'drawing')">普通绘图</button><button class="button button--primary" type="button" @click="$emit('create', 'mind-map')">思维导图</button></footer>
    </section>
  </div>
</template>
<script setup lang="ts">
defineProps<{ open: boolean }>();
defineEmits<{ close: []; create: [kind: 'drawing' | 'mind-map'] }>();
</script>
