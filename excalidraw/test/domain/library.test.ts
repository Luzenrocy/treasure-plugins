import { describe, expect, it } from 'vitest';
import { libraryStatsKey, mergeLibraryDownloadStats, normalizeLibraryRecords, queryLibraries } from '../../src/domain/library';

const record = {
  name: 'DnD 5e planning',
  authors: [{ name: 'DemonDarakna' }],
  source: 'demondarakna/dnd-writing-icons-for-dm.excalidrawlib',
  preview: 'demondarakna/dnd-writing-icons-for-dm.jpg',
  created: '2022-12-18',
  updated: '2022-12-18',
  version: 2,
};

describe('library normalization', () => {
  it('accepts official records without id and generates a stable local id', () => {
    const first = normalizeLibraryRecords([record])[0];
    const second = normalizeLibraryRecords([{ ...record }])[0];
    expect(first.stableId).toMatch(/^generated-/);
    expect(first.stableId).toBe(second.stableId);
  });

  it('maps official source paths to the website stats key', () => {
    expect(libraryStatsKey('devdaejungyoon/github-actions.excalidrawlib')).toBe('devdaejungyoon-github-actions');
    expect(libraryStatsKey('kvchitrapu/secure_shell.excalidrawlib')).toBe('kvchitrapu-secure_shell');
  });

  it('merges download stats and sorts by total downloads by default', () => {
    const items = normalizeLibraryRecords([record, { ...record, name: 'Popular', source: 'popular/library.excalidrawlib' }]);
    const enriched = mergeLibraryDownloadStats(items, { 'generated-key': { total: 0, week: 0 }, 'popular-library': { total: 42, week: 3 } });
    const page = queryLibraries(enriched);
    expect(page.items[0].name).toBe('Popular');
    expect(page.items[0].downloadsTotal).toBe(42);
  });

  it('always places installed libraries before higher-download uninstalled ones', () => {
    const items = normalizeLibraryRecords([record, { ...record, name: 'Popular', source: 'popular/library.excalidrawlib' }]);
    items[0].installed = true; items[0].downloadsTotal = 1; items[1].downloadsTotal = 99;
    expect(queryLibraries(items).items.map((item) => item.name)).toEqual(['DnD 5e planning', 'Popular']);
  });
});
