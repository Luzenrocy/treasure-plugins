import { analyzeJson, compactJson, escapeJson, formatJson, type EscapeTarget, type JsonIndent, type JsonAnalysis } from '../domain/json';

export class JsonTaskCoordinator {
  private generation = 0;

  invalidate() { this.generation += 1; return this.generation; }

  run(source: string, operation: 'validate' | 'format' | 'compact' | 'escape', options?: { indent?: JsonIndent; target?: EscapeTarget }) {
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    try {
      let value: string | JsonAnalysis;
      if (operation === 'validate') value = analyzeJson(source, options?.indent ?? '2');
      else if (operation === 'format') value = formatJson(source, options?.indent ?? '2');
      else if (operation === 'compact') value = compactJson(source);
      else value = escapeJson(source, options?.target ?? 'double');
      return { generation, ok: true as const, value, get current() { return current(); } };
    } catch (error) {
      return { generation, ok: false as const, message: error instanceof Error ? error.message : '处理失败', get current() { return current(); } };
    }
  }
}
