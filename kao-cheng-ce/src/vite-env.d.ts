/// <reference types="vite/client" />

declare module '*.svg?component' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, {}, any>;
  export default component;
}

interface Window {
  __TREASURE_HOST__?: boolean;
}
