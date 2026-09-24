<template>
  <p class="status-notice" role="status" aria-live="polite">
    <slot />
  </p>
</template>

<style scoped>
.status-notice {
  margin: 0;
  color: var(--diff-muted);
  font-size: 12px;
}
</style>
