<template>
  <div v-if="open" class="modal-backdrop" role="presentation" data-prevent-outside-click @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-drawing-title">
      <h2 id="delete-drawing-title">删除绘图</h2>
      <p>确定删除“{{ fileName }}”吗？删除后无法恢复。</p>
      <footer class="panel__footer"><button class="button" type="button" @click="$emit('close')">取消</button><button class="button button--primary" type="button" @click="$emit('confirm')">确认删除</button></footer>
    </section>
  </div>
</template>
<script setup lang="ts">
defineProps<{ open: boolean; fileName: string }>();
defineEmits<{ close: []; confirm: [] }>();
</script>
