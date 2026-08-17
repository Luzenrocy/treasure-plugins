export interface RenderedImage {
  src: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

/**
 * Cherry's asynchronous URL callback is the primary renderer. This is a
 * single post-render fallback for renderer modes that do not apply callback
 * updates to an existing preview node.
 */
export async function replaceRenderedAssetImages(
  images: Iterable<RenderedImage>,
  resolveAsset: (url: string) => Promise<string | null>,
): Promise<number> {
  let replaced = 0;
  for (const image of images) {
    const source = image.getAttribute('data-asset-src') || image.getAttribute('src') || image.src;
    if (!source.startsWith('@assets/')) continue;
    const previewUrl = await resolveAsset(source);
    if (!previewUrl) continue;
    image.setAttribute('data-asset-src', source);
    image.src = previewUrl;
    replaced++;
  }
  return replaced;
}
