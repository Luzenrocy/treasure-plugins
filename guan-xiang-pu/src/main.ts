import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import { initTreasure } from '@luzenrocy/treasure-sdk';

initTreasure();
const app = createApp(App);
app.use(ElementPlus);
app.mount('#app');
