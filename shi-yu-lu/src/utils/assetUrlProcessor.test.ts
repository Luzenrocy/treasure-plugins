import { describe, expect, it, vi } from 'vitest';
import { createAssetUrlProcessor } from './assetUrlProcessor';

describe('createAssetUrlProcessor', () => {
  it('keeps Markdown asset URLs unchanged while asynchronously passing the preview URL to Cherry', async () => {
    const resolve = vi.fn().mockResolvedValue('data:image/png;base64,iVBORw==');
    const callback = vi.fn();
    const diagnostic = vi.fn();
    const processor = createAssetUrlProcessor(resolve, diagnostic);

    expect(processor('@assets/example.png', 'image', callback)).toBe('@assets/example.png');
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith('data:image/png;base64,iVBORw=='));
    expect(resolve).toHaveBeenCalledWith('@assets/example.png');
    expect(diagnostic).toHaveBeenCalledWith('debug', 'url-processor-called', expect.objectContaining({ url: '@assets/example.png' }));
    expect(diagnostic).toHaveBeenCalledWith('debug', 'cherry-callback-applied', expect.objectContaining({ url: '@assets/example.png' }));
  });

  it('reports a missing asset and a missing Cherry callback instead of failing silently', async () => {
    const diagnostic = vi.fn();
    const processor = createAssetUrlProcessor(vi.fn().mockResolvedValue(null), diagnostic);

    processor('@assets/missing.png', 'image');
    await vi.waitFor(() => expect(diagnostic).toHaveBeenCalledWith('error', 'asset-preview-unavailable', expect.objectContaining({ url: '@assets/missing.png' })));
  });

  it('does not resolve non-image URLs', () => {
    const resolve = vi.fn();
    const processor = createAssetUrlProcessor(resolve);
    expect(processor('https://example.test', 'link', vi.fn())).toBe('https://example.test');
    expect(resolve).not.toHaveBeenCalled();
  });
});
