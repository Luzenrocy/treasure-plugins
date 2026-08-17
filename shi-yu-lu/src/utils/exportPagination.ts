export interface PageSlice {
  top: number;
  height: number;
}

/**
 * Selects page boundaries at measured block starts. This keeps normal Markdown
 * blocks intact; a block taller than one page is the only intentional split.
 */
export function calculatePageSlices(totalHeight: number, pageHeight: number, blockStarts: number[]): PageSlice[] {
  if (!Number.isFinite(totalHeight) || !Number.isFinite(pageHeight) || totalHeight <= 0 || pageHeight <= 0) return [];
  const starts = [...new Set(blockStarts.filter(value => value > 0 && value < totalHeight))].sort((a, b) => a - b);
  const pages: PageSlice[] = [];
  let top = 0;
  while (top < totalHeight) {
    const limit = Math.min(top + pageHeight, totalHeight);
    // Never add a gratuitous page break when the remaining content fits.
    const eligibleBreaks = limit < totalHeight ? starts.filter(value => value > top && value <= limit) : [];
    const safeBreak = eligibleBreaks[eligibleBreaks.length - 1];
    const bottom = safeBreak ?? limit;
    pages.push({ top, height: bottom - top });
    top = bottom;
  }
  return pages;
}

/** Collects safe page boundaries from the rendered Markdown structure. */
export function measuredBlockStarts(root: HTMLElement): number[] {
  const candidates = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li, pre, blockquote, table, tr, img, .cherry-code, .cherry-table');
  const rootTop = root.getBoundingClientRect().top;
  return Array.from(candidates)
    .map(element => element.getBoundingClientRect().top - rootTop)
    .filter(offset => offset > 0);
}
