import { file } from '@treasure/sdk';

const ASSET_DIR_NAME = '.assets';
const ASSET_ALIAS = '@assets';
const blobUrlCache = new Map<string, string>();

const mimeExtMap: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

export interface SavedAsset {
  path: string;
  markdownUrl: string;
}

function getDirPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index) : '';
}

function getFileName(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(index + 1) : path;
}

function getBaseName(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

function getExt(name: string, type?: string): string {
  const index = name.lastIndexOf('.');
  if (index > 0 && index < name.length - 1) return name.slice(index + 1).toLowerCase();
  return type && mimeExtMap[type] ? mimeExtMap[type] : 'bin';
}

function sanitizeName(name: string): string {
  const sanitized = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim();
  return sanitized || '未命名';
}

function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

async function fileToBase64AndBytes(source: File): Promise<{ base64: string; bytes: ArrayBuffer }> {
  const bytes = await source.arrayBuffer();
  let binary = '';
  const chunkSize = 0x8000;
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += chunkSize) {
    binary += String.fromCharCode(...view.subarray(i, i + chunkSize));
  }
  return { base64: btoa(binary), bytes };
}

async function hashContent(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

function unwrapMarkdownDestination(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    if (end > 0) return trimmed.slice(1, end).trim();
  }
  const titled = trimmed.match(/^(\S+)\s+["'][\s\S]*["']$/);
  if (titled && (titled[1].startsWith(`${ASSET_ALIAS}/`) || titled[1].startsWith(`${ASSET_DIR_NAME}/`) || titled[1].startsWith(`./${ASSET_DIR_NAME}/`))) return titled[1];
  return trimmed;
}

export function normalizeAssetUrl(url: string): string | null {
  const source = unwrapMarkdownDestination(url);
  const withoutQuery = source.split(/[?#]/)[0];
  let decoded = withoutQuery;
  try { decoded = decodeURIComponent(withoutQuery); } catch {}
  const normalized = decoded.replace(/^\.\//, '');
  if (normalized.includes('..')) return null;
  if (normalized.startsWith(`${ASSET_ALIAS}/`)) return normalized.slice(ASSET_ALIAS.length + 1);
  if (normalized.startsWith(`${ASSET_DIR_NAME}/`)) return normalized.slice(ASSET_DIR_NAME.length + 1);
  return null;
}

export function extractAssetMarkdownUrls(content: string): string[] {
  const urls = new Set<string>();
  const markdownReg = /!?\[[^\]]*\]\(([^)]*)\)/g;
  const htmlReg = /<(?:img|a)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const reg of [markdownReg, htmlReg]) {
    let match: RegExpExecArray | null;
    while ((match = reg.exec(content))) {
      if (normalizeAssetUrl(match[1])) urls.add(match[1]);
    }
  }
  return Array.from(urls);
}

export function isAssetMarkdownUrl(url: string): boolean {
  return normalizeAssetUrl(url) !== null;
}

export function resolveAssetPath(storageRootPath: string, markdownPath: string, markdownUrl: string): string | null {
  const normalized = normalizeAssetUrl(markdownUrl);
  if (!normalized) return null;
  const withoutQuery = unwrapMarkdownDestination(markdownUrl).split(/[?#]/)[0].replace(/^\.\//, '');
  const baseDir = withoutQuery.startsWith(`${ASSET_DIR_NAME}/`) ? getDirPath(markdownPath) : storageRootPath;
  return joinPath(joinPath(baseDir, ASSET_DIR_NAME), normalized);
}

export async function saveAssetForMarkdown(storageRootPath: string, markdownPath: string, source: File): Promise<SavedAsset> {
  if (!storageRootPath) throw new Error('未设置文件存储目录');
  if (!markdownPath) throw new Error('请先选择 Markdown 文件');
  const assetDir = joinPath(storageRootPath, ASSET_DIR_NAME);
  const { base64, bytes } = await fileToBase64AndBytes(source);
  const hash = await hashContent(bytes);
  const hostBase = sanitizeName(getBaseName(getFileName(markdownPath)));
  const origBase = sanitizeName(getBaseName(source.name));
  const ext = getExt(source.name, source.type);
  const assetName = `${hostBase}__${origBase}_${hash}.${ext}`;
  const assetPath = joinPath(assetDir, assetName);
  const dirRes = await file.createDir(assetDir, { recursive: true });
  if (dirRes.code !== 1) {
    const existsRes = await file.readDir(assetDir);
    if (existsRes.code !== 1) throw new Error(dirRes.msg || existsRes.msg || `创建资产目录失败: ${assetDir}`);
  }
  const writeRes = await file.writeBinaryFile(assetPath, base64);
  if (writeRes.code !== 1) throw new Error(writeRes.msg || '写入资产失败');
  return { path: assetPath, markdownUrl: `${ASSET_ALIAS}/${assetName}` };
}

export async function readAssetAsObjectUrl(storageRootPath: string, markdownPath: string, markdownUrl: string): Promise<string | null> {
  const assetPath = resolveAssetPath(storageRootPath, markdownPath, markdownUrl);
  if (!assetPath) return null;
  const cached = blobUrlCache.get(assetPath);
  if (cached) return cached;
  const res = await file.readBinaryFile(assetPath);
  if (res.code !== 1 || !res.data) return null;
  const binary = atob(res.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes]);
  const objectUrl = URL.createObjectURL(blob);
  blobUrlCache.set(assetPath, objectUrl);
  return objectUrl;
}

export function revokeAssetObjectUrls() {
  for (const url of blobUrlCache.values()) URL.revokeObjectURL(url);
  blobUrlCache.clear();
}
