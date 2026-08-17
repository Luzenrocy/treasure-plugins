import { describe, expect, it } from 'vitest';
import { estimateExportDurationMs, nextOverallProgress } from './exportProgress';

describe('nextOverallProgress', () => {
  it('moves forward continuously but reserves completion for the actual result', () => {
    expect(nextOverallProgress(20, 1_000, 2, false)).toBeGreaterThan(20);
    expect(nextOverallProgress(98.9, 10_000, 2, false)).toBeGreaterThan(98.9);
    expect(nextOverallProgress(98.9, 10_000, 2, false)).toBeLessThan(100);
  });

  it('assigns a longer estimated duration to structurally complex documents', () => {
    const plain = '短文';
    const complex = `${'# 标题\n'.repeat(60)}${'![asset](a.png)\n'.repeat(30)}${'```ts\ncode\n```\n'.repeat(20)}`;
    expect(estimateExportDurationMs(complex)).toBeGreaterThan(estimateExportDurationMs(plain));
  });

  it('quickly converges only when the file has been written', () => {
    expect(nextOverallProgress(96, 100, 2, true)).toBeGreaterThan(96);
    expect(nextOverallProgress(99.9, 1_000, 2, true)).toBe(100);
  });
});
