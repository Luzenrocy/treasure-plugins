import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import './styles/host.css';
import { initTreasure } from 'treasure-sdk';

const app = createApp(App);
app.use(ElementPlus);
initTreasure();
app.mount('#app');
