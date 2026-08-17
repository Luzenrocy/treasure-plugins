import { describe, expect, it } from 'vitest';
import { calculatePageSlices } from './exportPagination';

describe('calculatePageSlices', () => {
  it('moves a complete block to the next page instead of cutting through it', () => {
    expect(calculatePageSlices(1_000, 400, [0, 180, 390, 620, 850])).toEqual([
      { top: 0, height: 390 }, { top: 390, height: 230 }, { top: 620, height: 380 },
    ]);
  });

  it('uses the page limit for an oversized block so pagination always makes progress', () => {
    expect(calculatePageSlices(900, 400, [0, 750])).toEqual([
      { top: 0, height: 400 }, { top: 400, height: 350 }, { top: 750, height: 150 },
    ]);
  });

  it('handles empty and Unicode-labelled content through numeric boundaries only', () => {
    expect(calculatePageSlices(0, 400, [])).toEqual([]);
    expect(calculatePageSlices(240, 400, [0, 120])).toEqual([{ top: 0, height: 240 }]);
  });
});
