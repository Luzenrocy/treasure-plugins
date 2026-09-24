import type { DiffLine, DiffResult } from './diffState';

function normalize(line: string, ignoreTrailingWhitespace: boolean) { return ignoreTrailingWhitespace ? line.replace(/[ \t]+$/, '') : line; }

export function compareText(left: string, right: string, options: { generation?: number; leftVersion?: number; rightVersion?: number; ignoreTrailingWhitespace?: boolean } = {}): DiffResult {
  const a = left.split(/\r?\n/); const b = right.split(/\r?\n/);
  const ignore = options.ignoreTrailingWhitespace ?? false;
  const n = a.length; const m = b.length; const lcs = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = normalize(a[i], ignore) === normalize(b[j], ignore) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const lines: DiffLine[] = []; let i = 0; let j = 0; let line = 1;
  while (i < n || j < m) {
    if (i < n && j < m && normalize(a[i], ignore) === normalize(b[j], ignore)) { lines.push({ left: a[i], right: b[j], kind: 'same', line }); i += 1; j += 1; line += 1; continue; }
    if (i < n && j < m && lcs[i + 1][j + 1] >= lcs[i + 1][j] && lcs[i + 1][j + 1] >= lcs[i][j + 1]) { lines.push({ left: a[i], right: b[j], kind: 'changed', line }); i += 1; j += 1; line += 1; continue; }
    if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) { lines.push({ left: a[i], kind: 'removed', line }); i += 1; line += 1; continue; }
    if (j < m) { lines.push({ right: b[j], kind: 'added', line }); j += 1; line += 1; }
  }
  return { generation: options.generation ?? 0, leftVersion: options.leftVersion ?? 0, rightVersion: options.rightVersion ?? 0, differences: lines, total: lines.filter((item) => item.kind !== 'same').length, precision: 'exact', phase: 'completed' };
}

export function changedWordCount(line: DiffLine) {
  if (line.kind === 'same') return 0;
  const left = line.left ?? ''; const right = line.right ?? '';
  return Math.max(left.split(/\s+/).filter(Boolean).length, right.split(/\s+/).filter(Boolean).length, 1);
}
