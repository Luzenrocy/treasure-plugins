export type AssetUrlResolver = (url: string) => Promise<string | null>;
export type AssetPreviewDiagnostic = (level: 'debug' | 'error', stage: string, details: Record<string, unknown>) => void;

/**
 * Cherry's `callback.urlProcessor` supports asynchronous replacement through
 * its third argument. Return the source URL so Markdown stays unchanged while
 * the callback replaces the preview URL after the asset is read.
 */
export function createAssetUrlProcessor(resolveAsset: AssetUrlResolver, diagnostic: AssetPreviewDiagnostic = () => {}) {
  return (url: string, srcType: string, callback?: (url: string) => void): string => {
    if (srcType !== 'image') return url;
    diagnostic('debug', 'url-processor-called', { url, srcType, hasCallback: Boolean(callback) });
    void resolveAsset(url).then(previewUrl => {
      if (!previewUrl) {
        diagnostic('error', 'asset-preview-unavailable', { url, reason: 'resolver-returned-empty' });
        return;
      }
      if (!callback) {
        diagnostic('error', 'cherry-callback-missing', { url, reason: 'no-async-callback' });
        return;
      }
      callback(previewUrl);
      diagnostic('debug', 'cherry-callback-applied', { url, previewScheme: previewUrl.slice(0, previewUrl.indexOf(':') + 1) });
    }).catch(error => {
      diagnostic('error', 'asset-preview-resolver-failed', { url, error: error instanceof Error ? error.message : String(error) });
    });
    return url;
  };
}
