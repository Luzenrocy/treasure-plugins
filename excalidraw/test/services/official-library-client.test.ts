import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  settings: { get: vi.fn() },
  directories: {},
  files: {},
  permissions: {},
  storage: {},
  menus: {},
}));

vi.mock('treasure-sdk', () => sdk);

import { OfficialLibraryClient } from '../../src/services/official-library-client';

const record = [{
  name: 'R Icons', description: 'R and RStudio icons.', authors: [{ name: 'Jumping Rivers' }],
  source: 'jumpingrivers/r.excalidrawlib', preview: 'jumpingrivers/r.png', created: '2021-08-22', updated: '2021-08-22', version: 1, id: '6TGNPXCpuVy',
}];

describe('OfficialLibraryClient', () => {
  beforeEach(() => {
    sdk.settings.get.mockResolvedValue({ ok: true, value: { key: 'library_url', value: 'https://libraries.excalidraw.com/libraries.json' } });
  });

  it('falls back to the official GitHub mirror when the library site is blocked by CORS', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify(record), { status: 200 }));
    const client = new OfficialLibraryClient(fetcher);

    const result = await client.load();

    expect(result.ok).toBe(true);
    expect(client.sourceMode).toBe('github-fallback');
    expect(fetcher.mock.calls[0][0]).toBe('https://libraries.excalidraw.com/libraries.json');
    expect(fetcher.mock.calls[3][0]).toBe('https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json');
  });

  it('binds the default fetch implementation to the global window-like object', async () => {
    const originalFetch = globalThis.fetch;
    let receiver: unknown;
    globalThis.fetch = function (this: unknown, input: RequestInfo | URL): Promise<Response> {
      receiver = this;
      return Promise.resolve(new Response(JSON.stringify(record), { status: 200 }));
    } as typeof fetch;
    try {
      const result = await new OfficialLibraryClient().load();
      expect(result.ok).toBe(true);
      expect(receiver).toBe(globalThis);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('joins official download stats by the source-derived website key', async () => {
    sdk.settings.get.mockImplementation(async (key: string) => ({ ok: true, value: { key, value: key === 'library_stats_url' ? 'https://libraries.excalidraw.com/stats.json' : 'https://libraries.excalidraw.com/libraries.json' } }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(record), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ 'jumpingrivers-r': { total: 694, week: 7 } }), { status: 200 }));
    const client = new OfficialLibraryClient(fetcher);

    const result = await client.load();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].downloadsTotal).toBe(694);
      expect(result.value[0].downloadsWeek).toBe(7);
    }
    expect(fetcher.mock.calls[1][0]).toBe('https://libraries.excalidraw.com/stats.json');
  });
});
