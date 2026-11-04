const GITHUB_RELEASE_PATH = /^\/[^/]+\/[^/]+\/releases\/download\/.+\.zip$/;
const MAX_REDIRECTS = 5;

/**
 * 代理只接受已登记的 GitHub Release zip 资产，不能退化为任意 URL 转发器。
 */
export function isGithubReleaseAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && GITHUB_RELEASE_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

function isGithubAssetHost(hostname: string): boolean {
  return hostname === 'github.com' || hostname.endsWith('.githubusercontent.com');
}

/**
 * GitHub Release 会重定向到带签名的 githubusercontent 资产地址。
 * 手动跟随且校验每一跳，既支持真实下载链路，也避免 SSRF / 开放代理。
 */
export async function fetchGithubReleaseAsset(downloadUrl: string): Promise<Response> {
  if (!isGithubReleaseAssetUrl(downloadUrl)) throw new Error('仅支持 GitHub Release 的 zip 安装包');

  let url = new URL(downloadUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'Treasure-Plugin-Market/1.0' },
    });
    if (response.status < 300 || response.status >= 400) {
      if (!response.ok || !response.body) throw new Error(`GitHub 下载失败（HTTP ${response.status}）`);
      return response;
    }

    const location = response.headers.get('location');
    if (!location) throw new Error('GitHub 下载重定向缺少地址');
    url = new URL(location, url);
    if (url.protocol !== 'https:' || !isGithubAssetHost(url.hostname)) throw new Error('GitHub 下载重定向地址不受信任');
  }
  throw new Error('GitHub 下载重定向次数过多');
}

/** 将上游的流封装成稳定的插件下载响应，不暴露 GitHub 的签名跳转地址。 */
export function asPluginDownload(response: Response, pluginCode: string, version: string): Response {
  const headers = new Headers({
    'Content-Type': response.headers.get('content-type') ?? 'application/zip',
    'Content-Disposition': `attachment; filename="${pluginCode}-${version}.zip"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const name of ['content-length', 'etag', 'last-modified', 'accept-ranges']) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: 200, headers });
}
