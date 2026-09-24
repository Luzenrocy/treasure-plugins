export interface JsonFoldRange { startLine: number; endLine: number; }
export interface JsonFoldRow { line: number; text: string; foldable: boolean; collapsed: boolean; }

/** Finds multi-line JSON containers without treating quoted braces as syntax. */
export function findJsonFoldRanges(text: string): JsonFoldRange[] {
  const ranges: JsonFoldRange[] = [];
  const stack: Array<{ line: number }> = [];
  let line = 1;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (char === '\n') { line += 1; continue; }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{' || char === '[') { stack.push({ line }); continue; }
    if ((char === '}' || char === ']') && stack.length) {
      const opening = stack.pop()!;
      if (line > opening.line) ranges.push({ startLine: opening.line, endLine: line });
    }
  }
  return ranges.sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
}

/** Returns the visible rows after object-level folds have hidden their interiors. */
export function renderFoldedRows(text: string, collapsedStarts: ReadonlySet<number>): JsonFoldRow[] {
  const lines = text.split(/\r?\n/);
  const rangeByStart = new Map(findJsonFoldRanges(text).map((range) => [range.startLine, range]));
  const rows: JsonFoldRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1;
    const range = rangeByStart.get(line);
    const collapsed = Boolean(range && collapsedStarts.has(line));
    rows.push({ line, text: collapsed ? `${lines[index]} …` : lines[index], foldable: Boolean(range), collapsed });
    if (collapsed && range) index = range.endLine - 2;
  }
  return rows;
}
