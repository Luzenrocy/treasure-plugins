<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="paths[name] || paths.file"></svg>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });
// 只使用下面的静态图标常量，不接收文档 HTML。
const paths: Record<string, string> = {
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    map:'<rect x="8" y="9" width="8" height="6" rx="2"/><path d="M4 5v5h4M4 19v-5h4M16 12h4V5M16 12h4v7"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
    chevron:'<path d="m8 10 4 4 4-4"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',
    save:'<path d="M4 4h13l3 3v13H4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    export:'<path d="M9 5H4v15h15v-5M12 4h8v8M10 14 20 4"/>',
    undo:'<path d="M9 7H4V2M4 7c4-6 15-3 15 5a7 7 0 0 1-11 6"/>',
    redo:'<path d="M15 7h5V2M20 7C16 1 5 4 5 12a7 7 0 0 0 11 6"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a2 2 0 0 0 2-2 9 9 0 0 0-9-9Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="16" cy="7" r="1"/>',
    tree:'<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
    outline:'<path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/>',
    fit:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    target:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    trash:'<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    file:'<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
    note:'<path d="M4 3h16v14l-4 4H4Z"/><path d="M8 8h8M8 12h6M15 21v-5h5"/>',
    child:'<path d="M5 4v8a4 4 0 0 0 4 4h9M14 12l4 4-4 4"/>',
    sibling:'<path d="M4 5h15M4 12h9M17 9v10M12 14h10"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    alert:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17h.01"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    keyboard:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1M11 9h1M16 9h1M6 13h1M11 13h1M16 13h1M8 16h8"/>'
};
</script>
