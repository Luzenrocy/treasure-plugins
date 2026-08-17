import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { resolve, basename } from 'path'
import { randomBytes } from 'crypto'

function generateRandomSuffix(length = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) result += chars[bytes[i] % 36];
  return result;
}
function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '').replace(/[\u4e00-\u9fa5]/g, '');
}

// 调试一致性：开发服务器暴露 manifest.json 与 init.sql 供宿主拉取
function treasureDevEndpoints(): any {
  const root = resolve(__dirname);
  return {
    name: 'treasure-dev-endpoints',
    configureServer(server: any) {
      const manifestPath = resolve(root, 'manifest.json');
      if (existsSync(manifestPath)) {
        const raw = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);
        if (!manifest._frozen) {
          let slug = manifest.alias ? slugify(manifest.alias) : '';
          if (!slug) slug = slugify(basename(root));
          if (!slug) slug = 'plugin';
          const frozenName = `${slug}-${generateRandomSuffix(6)}`;
          manifest.name = frozenName;
          manifest._frozen = true;
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          console.log(`❄️  plugin_code 已冻结并写回源文件: ${frozenName}`);
          const htmlPath = resolve(root, 'index.html');
          if (existsSync(htmlPath)) {
            const html = readFileSync(htmlPath, 'utf-8');
            const updatedHtml = html.replace(/<meta\s+name=["']treasure-plugin-code["']\s+content=["'][^"']*["']/, `<meta name="treasure-plugin-code" content="${frozenName}"`);
            if (html !== updatedHtml) writeFileSync(htmlPath, updatedHtml);
          }
        }
      }
      // ── 中间件 ──
      server.middlewares.use('/treasure-manifest.json', (req: any, res: any) => {
        // CORS 统一处理
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

        if (!existsSync(manifestPath)) {
          res.statusCode = 404;
          res.end('manifest.json not found');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(manifestPath, 'utf-8'));
      });
      // 版本化 init 脚本：GET /scripts/init/ → 目录列表, GET /scripts/init/{version}.sql → 内容
      server.middlewares.use('/scripts/init/', (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

        const initDir = resolve(root, 'scripts/init');

        // 目录列表
        if (!req.url || req.url === '/') {
          if (!existsSync(initDir)) { res.statusCode = 404; res.end(JSON.stringify([])); return; }
          const files = readdirSync(initDir).filter((f: string) => f.endsWith('.sql'));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
          return;
        }

        // 单文件
        const filename = req.url;
        const filePath = resolve(root, 'scripts/init' + filename);
        if (!filePath.startsWith(resolve(root, 'scripts/init')) || !filename.endsWith('.sql')) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!existsSync(filePath)) {
          res.statusCode = 404;
          res.end('init script not found');
          return;
        }
        res.setHeader('Content-Type', 'text/plain');
        res.end(readFileSync(filePath, 'utf-8'));
      });
    }
  };
}

const localSdkEntry = fileURLToPath(new URL('../../treasure-sdk/src/index.ts', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [vue(), treasureDevEndpoints()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(existsSync(localSdkEntry) ? { 'treasure-sdk': localSdkEntry } : {}),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})
