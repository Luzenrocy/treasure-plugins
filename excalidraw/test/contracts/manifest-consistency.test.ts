import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('manifest consistency contract', () => {
  it('keeps the plugin identity and workspace setting stable', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8')) as { name: string; minPlatformVersion: string; settings: Array<{ key: string; param_type: string }> };
    expect(manifest.name).toBe('excalidraw');
    expect(manifest.minPlatformVersion).toBe('2.3.0');
    expect(manifest.settings.some((setting) => setting.key === 'workspace_dir')).toBe(true);
  });

  it('uses only Treasure-supported setting parameter types', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8')) as { settings: Array<{ key: string; param_type: string }> };
    const supported = new Set(['input', 'number', 'switch', 'dir', 'select', 'checkbox', 'radio', 'time']);
    for (const setting of manifest.settings) expect(supported.has(setting.param_type)).toBe(true);
    expect(manifest.settings.find((setting) => setting.key === 'library_url')?.param_type).toBe('input');
    expect(manifest.settings.find((setting) => setting.key === 'library_stats_url')?.param_type).toBe('input');
  });
});

