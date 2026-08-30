import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { initTreasure } from 'treasure-sdk';
import App from './App.vue';

initTreasure();
createApp(App).use(ElementPlus).mount('#app');
