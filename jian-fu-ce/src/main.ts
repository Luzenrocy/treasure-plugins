import { initTreasure } from '@luzenrocy/treasure-sdk';
import { createApp } from 'vue';
import App from './App.vue';

initTreasure();
createApp(App).mount('#app');
