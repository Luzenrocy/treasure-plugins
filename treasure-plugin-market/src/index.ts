import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { handle } from './handler.js';

const port = Number(process.env.PORT ?? 7860);
const host = process.env.HOST ?? '127.0.0.1';
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

async function toRequest(request: IncomingMessage, targetUrl: URL): Promise<Request> {
  const url = targetUrl;
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value !== undefined) headers.set(key, value);
  }
  let body: Buffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }
  return new Request(url, { method: request.method, headers, body });
}

async function writeResponse(response: ServerResponse, result: Response): Promise<void> {
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const relative = normalize(pathname.replace(/^\/+/, ''));
  if (relative.startsWith('..') || relative.startsWith('/')) {
    response.statusCode = 400;
    response.end('Bad Request');
    return;
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
      response.statusCode = 404;
      response.end('Not Found');
      return;
    }
  }
  response.statusCode = 200;
  response.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
  if (filePath.startsWith(join(staticDir, 'assets'))) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  response.end(content);
}

const server = createServer((incoming, outgoing) => {
  const startedAt = Date.now();
  const url = new URL(incoming.url ?? '/', `http://${incoming.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = incoming.method ?? '?';

  // 每请求一条访问日志：方法、路径、最终状态码、耗时。托管平台（FC 等）日志里
  // 只有平台生命周期日志时，靠这里确认请求确实到达了应用。
  const log = (status: number) => {
    console.log(`[app] ${method} ${pathname} -> ${status} ${Date.now() - startedAt}ms`);
  };

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const apiPath = pathname === '/api' ? '/' : pathname.replace(/^\/api/, '');
    // 保留查询字符串（access_token 令牌经查询参数传入，需透传给 handler）
    const apiUrl = new URL(apiPath, `http://${incoming.headers.host ?? 'localhost'}`);
    apiUrl.search = url.search;
    toRequest(incoming, apiUrl)
      .then((request) => handle(request))
      .then((result) => {
        writeResponse(outgoing, result).finally(() => log(result.status));
      })
      .catch((error: unknown) => {
        console.error('[app] api request failed', error);
        if (!outgoing.headersSent) {
          outgoing.statusCode = 500;
          outgoing.setHeader('Content-Type', 'application/json');
        }
        outgoing.end(JSON.stringify({ code: 1, message: 'INTERNAL_ERROR', data: null }));
        log(500);
      });
    return;
  }

  if (incoming.method === 'GET' || incoming.method === 'HEAD') {
    serveStatic(pathname, outgoing)
      .then(() => log(200))
      .catch((error: unknown) => {
        console.error('[app] static request failed', error);
        if (!outgoing.headersSent) {
          outgoing.statusCode = 500;
          outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
        }
        outgoing.end('Internal Server Error');
        log(500);
      });
    return;
  }

  outgoing.statusCode = 405;
  outgoing.setHeader('Allow', 'GET, HEAD, POST, PATCH, DELETE');
  outgoing.end('Method Not Allowed');
  log(405);
});

server.listen(port, host, () => {
  // 启动诊断：不泄露完整密钥，只输出前缀与长度，便于跨实例核对配置一致性
  const secret = process.env.AUTH_JWT_SECRET ?? '';
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const supabaseHost = (() => {
    try { return new URL(supabaseUrl).host; } catch { return '(非法URL)'; }
  })();
  console.log(`[app] treasure-plugin-market listening on http://${host}:${port} (static: ${staticDir})`);
  console.log(`[app] env: PORT=${port} HOST=${host} STATIC_DIR=${staticDir}`);
  console.log(`[app] env: SUPABASE_HOST=${supabaseHost}`);
  console.log(`[app] env: AUTH_JWT_SECRET=${secret.slice(0, 8)}...(长度 ${secret.length}, ${secret.length >= 32 ? '合格' : '不合格(<32)'})`);
  console.log(`[app] env: AUTH_JWT_PREVIOUS_SECRETS=${(process.env.AUTH_JWT_PREVIOUS_SECRETS ?? '(未配置)').split(',').map((s) => s.trim().slice(0, 8)).join(',')}`);
});
