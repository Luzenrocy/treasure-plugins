import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createHash } from 'node:crypto';

const port = Number(process.env.PORT ?? 7860);
const host = process.env.HOST ?? '0.0.0.0';
const staticDir = process.env.STATIC_DIR ?? 'dist';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

async function serveStatic(pathname: string, incoming: IncomingMessage, outgoing: ServerResponse): Promise<number> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    outgoing.statusCode = 400;
    outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
    outgoing.end('Bad Request');
    return 400;
  }
  // 基于原始请求路径检查 .. 段，杜绝路径穿越（URL 构造器折叠无法依赖）
  if (decoded.split('/').includes('..')) {
    outgoing.statusCode = 400;
    outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
    outgoing.end('Bad Request');
    return 400;
  }
  const relative = normalize(decoded.replace(/^\/+/, ''));
  if (relative.startsWith('..') || relative.startsWith('/')) {
    outgoing.statusCode = 400;
    outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
    outgoing.end('Bad Request');
    return 400;
  }

  let filePath = join(staticDir, relative);
  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    filePath = join(staticDir, 'index.html');
    try {
      content = await readFile(filePath);
    } catch {
      outgoing.statusCode = 404;
      outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
      outgoing.end('Not Found');
      return 404;
    }
  }

  outgoing.statusCode = 200;
  outgoing.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');

  // 构建产物（assets/ 下为内容 hash 文件名）：不可变长缓存
  if (decoded.startsWith('/assets/')) {
    outgoing.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (decoded.startsWith('/icons/')) {
    // 稳定 URL 不 immutable：插件更新后 ETag 变化，客户端自动取新图
    const etag = `"${createHash('sha1').update(content).digest('hex')}"`;
    outgoing.setHeader('Cache-Control', 'public, max-age=3600');
    outgoing.setHeader('ETag', etag);
    if (incoming.headers['if-none-match'] === etag) {
      outgoing.statusCode = 304;
      outgoing.removeHeader('Content-Type');
      outgoing.end();
      return 304;
    }
  } else {
    outgoing.setHeader('Cache-Control', 'no-cache');
  }

  outgoing.end(content);
  return 200;
}

const server = createServer((incoming, outgoing) => {
  const startedAt = Date.now();
  const rawPath = (incoming.url ?? '/').split('?')[0];
  const method = incoming.method ?? '?';

  const log = (status: number) => {
    console.log(`[icons] ${method} ${rawPath} -> ${status} ${Date.now() - startedAt}ms`);
  };

  if (method === 'GET' || method === 'HEAD') {
    serveStatic(rawPath, incoming, outgoing)
      .then((status) => log(status))
      .catch((error: unknown) => {
        console.error('[icons] static request failed', error);
        if (!outgoing.headersSent) {
          outgoing.statusCode = 500;
          outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
          outgoing.end('Internal Server Error');
          log(500);
        }
      });
    return;
  }

  outgoing.statusCode = 405;
  outgoing.setHeader('Allow', 'GET, HEAD');
  outgoing.end('Method Not Allowed');
  log(405);
});

server.listen(port, host, () => {
  console.log(`[icons] treasure-plugin-icons listening on http://${host}:${port} (static: ${staticDir})`);
  console.log(`[icons] env: PORT=${port} HOST=${host} STATIC_DIR=${staticDir}`);
});