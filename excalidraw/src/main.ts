import { createApp } from 'vue';
import { initTreasure } from 'treasure-sdk';
import '@excalidraw/excalidraw/index.css';
import App from './App.vue';
import './styles/host.css';
import './styles/tokens.css';

initTreasure();
createApp(App).mount('#app');
