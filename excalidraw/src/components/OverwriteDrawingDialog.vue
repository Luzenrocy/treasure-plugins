<template>
  <div v-if="open" class="modal-backdrop" role="presentation" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="overwrite-drawing-title">
      <h2 id="overwrite-drawing-title">确认覆盖文件</h2>
      <p>“{{ fileName }}”已存在。覆盖后将替换该文件当前内容，是否继续？</p>
      <footer class="panel__footer"><button class="button" type="button" @click="$emit('close')">返回修改</button><button class="button button--primary" type="button" @click="$emit('confirm')">确认覆盖</button></footer>
    </section>
  </div>
</template>
<script setup lang="ts">
defineProps<{ open: boolean; fileName: string }>();
defineEmits<{ close: []; confirm: [] }>();
</script>
