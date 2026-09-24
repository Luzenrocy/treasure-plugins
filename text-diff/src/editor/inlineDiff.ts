import type { DiffKind, DiffLine, DiffResult } from '../domain/diffState';

export interface InlineSegment { text: string; changed: boolean; }
export interface InlineDiffRow { line: number; leftLine?: number; rightLine?: number; kind: DiffKind; left: string; right: string; leftSegments: InlineSegment[]; rightSegments: InlineSegment[]; }

function changedSegments(value: string, other: string): InlineSegment[] {
  if (!value) return [];
  let start = 0;
  while (start < value.length && start < other.length && value[start] === other[start]) start += 1;
  let end = 0;
  while (end < value.length - start && end < other.length - start && value[value.length - 1 - end] === other[other.length - 1 - end]) end += 1;
  const segments: InlineSegment[] = [];
  if (start) segments.push({ text: value.slice(0, start), changed: false });
  const middle = value.slice(start, value.length - end);
  if (middle) segments.push({ text: middle, changed: true });
  if (end) segments.push({ text: value.slice(value.length - end), changed: false });
  return segments.length ? segments : [{ text: value, changed: true }];
}

function mapRow(row: DiffLine, leftLine?: number, rightLine?: number): InlineDiffRow {
  const left = row.left ?? '';
  const right = row.right ?? '';
  const changed = row.kind === 'changed';
  return {
    line: row.line, leftLine, rightLine,
    kind: row.kind,
    left,
    right,
    leftSegments: changed ? changedSegments(left, right) : left ? [{ text: left, changed: row.kind === 'removed' }] : [],
    rightSegments: changed ? changedSegments(right, left) : right ? [{ text: right, changed: row.kind === 'added' }] : [],
  };
}

export function buildInlineRows(result?: DiffResult): InlineDiffRow[] {
  if (!result) {
    return [{ line: 1, leftLine: 1, rightLine: 1, kind: 'same', left: '', right: '', leftSegments: [], rightSegments: [] }];
  }
  let leftLine = 0; let rightLine = 0;
  return result.differences.map((row) => mapRow(row, row.left === undefined ? undefined : ++leftLine, row.right === undefined ? undefined : ++rightLine));
}

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export function renderInlineSide(row: InlineDiffRow, side: 'left' | 'right') {
  const line = side === 'left' ? row.leftLine : row.rightLine;
  if (line === undefined) return '';
  const segments = side === 'left' ? row.leftSegments : row.rightSegments;
  const content = segments.map((segment) => segment.changed ? `<mark class="inline-char-changed">${escapeHtml(segment.text)}</mark>` : escapeHtml(segment.text)).join('');
  return `<span class="inline-diff-row kind-${row.kind}"><span class="inline-gutter diff-gutter" aria-hidden="true"><span class="inline-line-number">${line}</span></span><span class="inline-text">${content || ' '}</span></span>`;
}
