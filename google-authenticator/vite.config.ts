import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

function generateRandomSuffix(length = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let result = '';
  for (let index = 0; index < length; index += 1) result += chars[bytes[index] % chars.length];
  return result;
}

function syncHtmlPluginCode(htmlPath: string, code: string) {
  if (!existsSync(htmlPath)) return;
  const html = readFileSync(htmlPath, 'utf-8');
  const updated = html.replace(
    /<meta\s+name=["']treasure-plugin-code["']\s+content=["'][^"']*["']/,
    `<meta name="treasure-plugin-code" content="${code}"`,
  );
  if (html !== updated) writeFileSync(htmlPath, updated);
}

/** Freezes the installation identity before either Vite dev or Vite build runs. */
function freezePluginIdentity(root: string) {
  const manifestPath = resolve(root, 'manifest.json');
  if (!existsSync(manifestPath)) return;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  if (!manifest._frozen) {
    const baseName = String(manifest.name || basename(root))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'plugin';
    manifest.name = `${baseName}-${generateRandomSuffix()}`;
    manifest._frozen = true;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`❄️  plugin_code 已冻结: ${manifest.name}`);
  }

  syncHtmlPluginCode(resolve(root, 'index.html'), manifest.name);
}

function treasureDevEndpoints() {
  const root = resolve(__dirname);
  const initDir = resolve(root, 'scripts/init');
  // The factory is evaluated by both `vite` and `vite build`.
  freezePluginIdentity(root);
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
