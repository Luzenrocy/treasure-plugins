import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGithubReleaseAssetUrl } from '../src/download-proxy.ts';

test('仅允许 GitHub Release 的 zip 资产进入下载代理', () => {
  assert.equal(isGithubReleaseAssetUrl('https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/excalidraw/v1.0.0/excalidraw.zip'), true);
  assert.equal(isGithubReleaseAssetUrl('https://github.com/org/repo/releases/download/v1.0.0/plugin.zip'), true);
  assert.equal(isGithubReleaseAssetUrl('https://github.com/org/repo/releases/download/v1.0.0/plugin.tar.gz'), false);
  assert.equal(isGithubReleaseAssetUrl('https://evil.example/releases/download/v1.0.0/plugin.zip'), false);
  assert.equal(isGithubReleaseAssetUrl('http://github.com/org/repo/releases/download/v1.0.0/plugin.zip'), false);
  assert.equal(isGithubReleaseAssetUrl('https://github.com/org/repo/archive/refs/tags/v1.0.0.zip'), false);
});
