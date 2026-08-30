import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function treasureDevEndpoints() {
  const root = resolve(__dirname);
  const initDir = resolve(root, 'scripts/init');
  return {
    name: 'treasure-dev-endpoints',
    configureServer(server: { middlewares: { use: (path: string, handler: (request: { method?: string; url?: string }, response: { setHeader: (name: string, value: string) => void; statusCode: number; end: (value?: string) => void }) => void) => void } }) {
      server.middlewares.use('/treasure-manifest.json', (_request, response) => { response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Content-Type', 'application/json'); response.end(readFileSync(resolve(root, 'manifest.json'), 'utf-8')); });
      server.middlewares.use('/scripts/init/', (request, response) => {
        response.setHeader('Access-Control-Allow-Origin', '*');
        if (!request.url || request.url === '/') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(existsSync(initDir) ? readdirSync(initDir).filter(file => file.endsWith('.sql')) : [])); return; }
        const name = request.url.replace(/^\//, '');
        const file = resolve(initDir, name);
        if (!name.endsWith('.sql') || !file.startsWith(initDir) || !existsSync(file)) { response.statusCode = 404; response.end('not found'); return; }
        response.setHeader('Content-Type', 'text/plain'); response.end(readFileSync(file, 'utf-8'));
      });
    },
  };
}

export default defineConfig({ base: './', plugins: [vue(), treasureDevEndpoints()], server: { cors: true }, build: { outDir: 'dist', assetsInlineLimit: 0 } });
