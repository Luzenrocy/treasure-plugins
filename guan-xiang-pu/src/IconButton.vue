<template>
  <button type="button" class="icon-button" :aria-label="label" :title="label"><UiIcon :name="icon" :size="size" /></button>
</template>
<script setup lang="ts">
import UiIcon from './UiIcon.vue';
withDefaults(defineProps<{ label: string; icon: string; size?: number }>(), { size: 16 });
</script>
