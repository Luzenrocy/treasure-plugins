import { describe, expect, it, vi } from 'vitest';
import { replaceRenderedAssetImages } from './assetPreviewFallback';

function image(src: string) {
  const attributes = new Map<string, string>([['src', src]]);
  return {
    src,
    getAttribute: (name: string) => attributes.get(name) || null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
}

describe('replaceRenderedAssetImages', () => {
  it('replaces an asset image once and preserves its original Markdown URL', async () => {
    const target = image('@assets/中文.png');
    const resolve = vi.fn().mockResolvedValue('data:image/png;base64,iVBORw==');

    await expect(replaceRenderedAssetImages([target], resolve)).resolves.toBe(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(target.src).toBe('data:image/png;base64,iVBORw==');
    expect(target.getAttribute('data-asset-src')).toBe('@assets/中文.png');
  });

  it('does not resolve already-replaced or unrelated images', async () => {
    const dataImage = image('data:image/png;base64,iVBORw==');
    const remoteImage = image('https://example.test/image.png');
    const resolve = vi.fn();

    await expect(replaceRenderedAssetImages([dataImage, remoteImage], resolve)).resolves.toBe(0);
    expect(resolve).not.toHaveBeenCalled();
  });
});
