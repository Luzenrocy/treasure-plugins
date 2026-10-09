import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
export default defineConfig({ base: '/', root: resolve(__dirname), plugins: [vue()],
  server: { proxy: { '/api': 'http://127.0.0.1:7860' }, port: 5174 }, build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true } });
