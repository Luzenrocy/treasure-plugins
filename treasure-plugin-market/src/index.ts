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

async function toRequest(request: IncomingMessage, pathname: string): Promise<Request> {
  const url = new URL(pathname, `http://${request.headers.host ?? 'localhost'}`);
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
  const pathname = new URL(incoming.url ?? '/', `http://${incoming.headers.host ?? 'localhost'}`).pathname;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const apiPath = pathname === '/api' ? '/' : pathname.replace(/^\/api/, '');
    toRequest(incoming, apiPath)
      .then((request) => handle(request))
      .then((result) => writeResponse(outgoing, result))
      .catch((error: unknown) => {
        console.error('[app] api request failed', error);
        if (!outgoing.headersSent) {
          outgoing.statusCode = 500;
          outgoing.setHeader('Content-Type', 'application/json');
        }
        outgoing.end(JSON.stringify({ code: 1, message: 'INTERNAL_ERROR', data: null }));
      });
    return;
  }

  if (incoming.method === 'GET' || incoming.method === 'HEAD') {
    serveStatic(pathname, outgoing).catch((error: unknown) => {
      console.error('[app] static request failed', error);
      if (!outgoing.headersSent) {
        outgoing.statusCode = 500;
        outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      outgoing.end('Internal Server Error');
    });
    return;
  }

  outgoing.statusCode = 405;
  outgoing.setHeader('Allow', 'GET, HEAD, POST, PATCH, DELETE');
  outgoing.end('Method Not Allowed');
});

server.listen(port, host, () => {
  console.log(`[app] treasure-plugin-market listening on http://${host}:${port} (static: ${staticDir})`);
});
