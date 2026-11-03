<template>
  <aside class="status-notice status-notice--error" role="alert">
    <div class="status-notice__header"><strong>{{ message }}</strong><button type="button" aria-label="关闭错误" @click="$emit('dismiss')">×</button></div>
    <pre v-if="details" class="status-notice__details">{{ details }}</pre>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ message: string; details?: string }>();
defineEmits<{ dismiss: [] }>();
</script>
