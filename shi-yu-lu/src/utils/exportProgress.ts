/** A single, monotonic export trajectory. Only an actual write may reach 100. */
export function nextOverallProgress(current: number, elapsedMs: number, workRate: number, isComplete: boolean): number {
  const seconds = Math.max(0, elapsedMs) / 1_000;
  if (isComplete) return Math.min(100, current + Math.max(14, (100 - current) * 9) * seconds);
  return Math.min(99.99, current + Math.max(0.2, workRate) * seconds);
}

/** Estimates the total export budget from Markdown bytes and costly structures. */
export function estimateExportDurationMs(markdown: string): number {
  const bytes = new TextEncoder().encode(markdown).byteLength;
  const costlyBlocks = (markdown.match(/^#{1,6}\s|^\|.*\||^```|!\[[^\]]*\]\([^)]*\)/gm) ?? []).length;
  // Keep ordinary notes calm, while giving image/code/table-heavy notes a
  // longer budget. This estimator never observes or changes stage labels.
  return Math.min(90_000, Math.max(20_000, 20_000 + bytes * 0.08 + costlyBlocks * 500));
}
