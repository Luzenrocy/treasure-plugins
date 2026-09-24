export type JsonIndent = '2' | '4' | 'tab';
export type EscapeTarget = 'double' | 'single' | 'both';

export interface JsonDiagnostic {
  message: string;
  line: number;
  column: number;
}

interface Token {
  kind: 'string' | 'number' | 'literal' | 'punct';
  raw: string;
  start: number;
}

type JsonNode =
  | { kind: 'object'; entries: Array<{ key: Token; value: JsonNode }> }
  | { kind: 'array'; items: JsonNode[] }
  | { kind: 'scalar'; token: Token };

export interface JsonAnalysis {
  valid: boolean;
  formatted: string;
  compact: string;
  diagnostics: JsonDiagnostic[];
  warnings: JsonDiagnostic[];
}

function location(source: string, index: number) {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  return { line, column: index - lastBreak };
}

function diagnostic(source: string, index: number, message: string): JsonDiagnostic {
  return { message, ...location(source, Math.max(0, index)) };
}

function readString(source: string, start: number): { token?: Token; next: number; error?: string } {
  let i = start + 1;
  while (i < source.length) {
    const char = source[i];
    if (char === '"') return { token: { kind: 'string', raw: source.slice(start, i + 1), start }, next: i + 1 };
    if (char === '\n' || char === '\r') return { next: i, error: '字符串不能包含未转义换行' };
    if (char === '\\') {
      i += 1;
      if (i >= source.length) return { next: i, error: '字符串转义不完整' };
      if (source[i] === 'u') {
        if (!/^[0-9a-fA-F]{4}$/.test(source.slice(i + 1, i + 5))) return { next: i, error: 'Unicode 转义无效' };
        i += 4;
      } else if (!/["\\/bfnrt]/.test(source[i])) {
        return { next: i, error: '字符串转义无效' };
      }
    }
    i += 1;
  }
  return { next: i, error: '字符串未闭合' };
}

function tokenize(source: string): { tokens: Token[]; diagnostics: JsonDiagnostic[] } {
  const tokens: Token[] = [];
  const diagnostics: JsonDiagnostic[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i += 1; continue; }
    const start = i;
    const char = source[i];
    if ('{}[],:'.includes(char)) { tokens.push({ kind: 'punct', raw: char, start }); i += 1; continue; }
    if (char === '"') {
      const result = readString(source, i);
      if (result.error) { diagnostics.push(diagnostic(source, i, result.error)); return { tokens, diagnostics }; }
      tokens.push(result.token!); i = result.next; continue;
    }
    if (char === '-' || /[0-9]/.test(char)) {
      const match = source.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (!match) { diagnostics.push(diagnostic(source, i, '数字无效')); return { tokens, diagnostics }; }
      tokens.push({ kind: 'number', raw: match[0], start }); i += match[0].length; continue;
    }
    const literal = source.slice(i).match(/^(true|false|null)/);
    if (literal) { tokens.push({ kind: 'literal', raw: literal[0], start }); i += literal[0].length; continue; }
    diagnostics.push(diagnostic(source, i, '存在无法识别的 token')); return { tokens, diagnostics };
  }
  return { tokens, diagnostics };
}

function parse(source: string): { node?: JsonNode; diagnostics: JsonDiagnostic[]; warnings: JsonDiagnostic[] } {
  const tokenized = tokenize(source);
  if (tokenized.diagnostics.length) return { diagnostics: tokenized.diagnostics, warnings: [] };
  const tokens = tokenized.tokens;
  const diagnostics: JsonDiagnostic[] = [];
  const warnings: JsonDiagnostic[] = [];
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const expect = (raw: string) => {
    const token = take();
    if (!token || token.raw !== raw) {
      diagnostics.push(diagnostic(source, token?.start ?? source.length, `期望“${raw}”`));
      return false;
    }
    return true;
  };
  const value = (): JsonNode | undefined => {
    const token = peek();
    if (!token) { diagnostics.push(diagnostic(source, source.length, '值不完整')); return undefined; }
    if (token.raw === '{') {
      take(); const entries: Array<{ key: Token; value: JsonNode }> = []; const seen = new Set<string>();
      if (peek()?.raw === '}') { take(); return { kind: 'object', entries }; }
      while (cursor < tokens.length) {
        const key = take();
        if (!key || key.kind !== 'string') { diagnostics.push(diagnostic(source, key?.start ?? source.length, '对象键必须是双引号字符串')); return undefined; }
        let decoded = '';
        try { decoded = JSON.parse(key.raw) as string; } catch { diagnostics.push(diagnostic(source, key.start, '对象键字符串无效')); return undefined; }
        if (seen.has(decoded)) warnings.push(diagnostic(source, key.start, `重复键“${decoded}”`));
        seen.add(decoded);
        if (!expect(':')) return undefined;
        const child = value(); if (!child) return undefined;
        entries.push({ key, value: child });
        if (peek()?.raw === '}') { take(); return { kind: 'object', entries }; }
        if (!expect(',')) return undefined;
        if (peek()?.raw === '}') { diagnostics.push(diagnostic(source, peek()!.start, '不允许尾逗号')); return undefined; }
      }
      diagnostics.push(diagnostic(source, source.length, '对象未闭合')); return undefined;
    }
    if (token.raw === '[') {
      take(); const items: JsonNode[] = [];
      if (peek()?.raw === ']') { take(); return { kind: 'array', items }; }
      while (cursor < tokens.length) {
        const child = value(); if (!child) return undefined; items.push(child);
        if (peek()?.raw === ']') { take(); return { kind: 'array', items }; }
        if (!expect(',')) return undefined;
        if (peek()?.raw === ']') { diagnostics.push(diagnostic(source, peek()!.start, '不允许尾逗号')); return undefined; }
      }
      diagnostics.push(diagnostic(source, source.length, '数组未闭合')); return undefined;
    }
    if (token.kind === 'string' || token.kind === 'number' || token.kind === 'literal') { take(); return { kind: 'scalar', token }; }
    diagnostics.push(diagnostic(source, token.start, '值无效')); return undefined;
  };
  const node = value();
  if (node && cursor < tokens.length) diagnostics.push(diagnostic(source, tokens[cursor].start, '存在多余 token'));
  return { node, diagnostics, warnings };
}

function indentUnit(indent: JsonIndent) { return indent === 'tab' ? '\t' : ' '.repeat(Number(indent)); }

function render(node: JsonNode, indent: string, depth: number, compact: boolean): string {
  if (node.kind === 'scalar') return node.token.raw;
  if (node.kind === 'array') {
    if (!node.items.length) return '[]';
    const values = node.items.map((item) => render(item, indent, depth + 1, compact));
    return compact ? `[${values.join(',')}]` : `[\n${values.map((v) => `${indent.repeat(depth + 1)}${v}`).join(',\n')}\n${indent.repeat(depth)}]`;
  }
  if (!node.entries.length) return '{}';
  const values = node.entries.map(({ key, value }) => `${key.raw}${compact ? ':' : ': '}${render(value, indent, depth + 1, compact)}`);
  return compact ? `{${values.join(',')}}` : `{\n${values.map((v) => `${indent.repeat(depth + 1)}${v}`).join(',\n')}\n${indent.repeat(depth)}}`;
}

export function analyzeJson(source: string, indent: JsonIndent = '2'): JsonAnalysis {
  if (!source.trim()) {
    const d = diagnostic(source, 0, '待输入 JSON');
    return { valid: false, formatted: source, compact: source, diagnostics: [d], warnings: [] };
  }
  const result = parse(source);
  if (!result.node || result.diagnostics.length) return { valid: false, formatted: source, compact: source, diagnostics: result.diagnostics, warnings: result.warnings };
  const unit = indentUnit(indent);
  return { valid: true, formatted: render(result.node, unit, 0, false), compact: render(result.node, unit, 0, true), diagnostics: [], warnings: result.warnings };
}

export function formatJson(source: string, indent: JsonIndent = '2') {
  const result = analyzeJson(source, indent);
  if (!result.valid) throw new Error(result.diagnostics[0]?.message ?? 'JSON 无效');
  return result.formatted;
}

export function compactJson(source: string) {
  const result = analyzeJson(source);
  if (!result.valid) throw new Error(result.diagnostics[0]?.message ?? 'JSON 无效');
  return result.compact;
}

function escapeChar(char: string, target: EscapeTarget) {
  const code = char.codePointAt(0)!;
  if (char === '\\') return '\\\\';
  if (char === '"' && (target === 'double' || target === 'both')) return '\\"';
  if (char === "'" && (target === 'single' || target === 'both')) return "\\'";
  const controls: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };
  if (controls[char]) return controls[char];
  if (code === 0x2028 || code === 0x2029) return `\\u${code.toString(16)}`;
  return char;
}

export function escapeJson(source: string, target: EscapeTarget) {
  const analysis = analyzeJson(source);
  if (!analysis.valid) throw new Error(analysis.diagnostics[0]?.message ?? 'JSON 无效');
  let output = '';
  for (const char of source) output += escapeChar(char, target);
  return output;
}

export function unescapeOne(source: string): { ok: true; value: string } | { ok: false; message: string } {
  let output = '';
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== '\\') { output += source[i]; continue; }
    if (i + 1 >= source.length) return { ok: false, message: '末尾反斜杠未完成' };
    const next = source[++i];
    const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '"': '"', "'": "'", '/': '/' };
    if (simple[next] !== undefined) { output += simple[next]; continue; }
    if (next === 'u') {
      const hex = source.slice(i + 1, i + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { ok: false, message: 'Unicode 转义无效' };
      output += String.fromCharCode(parseInt(hex, 16)); i += 4; continue;
    }
    return { ok: false, message: `未知转义序列 \\${next}` };
  }
  return { ok: true, value: output };
}
