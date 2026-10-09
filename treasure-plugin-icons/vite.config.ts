import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  root: resolve(__dirname),
  plugins: [vue()],
  server: { port: 5175 },
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true },
});