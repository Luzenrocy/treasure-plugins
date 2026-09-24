import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'node', include: ['test/**/*.spec.ts'], setupFiles: ['./test/setup.ts'], coverage: { provider: 'v8', reporter: ['text', 'json-summary'] } },
});
