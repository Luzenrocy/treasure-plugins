<template>
  <p class="diff-status" role="status" aria-live="polite">
    <slot />
  </p>
</template>

<style scoped>
.diff-status {
  margin: 0;
  color: var(--diff-muted);
  font-size: 12px;
}
</style>
