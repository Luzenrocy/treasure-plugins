import { compareText } from '../domain/diff';
import type { DiffResult } from '../domain/diffState';
import type { DiffSettings } from '../domain/diffSettings';
import type { TextSide } from '../domain/textSide';

export class DiffCoordinator {
  private generation = 0;
  invalidate() { this.generation += 1; return this.generation; }
  compare(left: TextSide, right: TextSide, settings: DiffSettings): DiffResult & { current: boolean } {
    const generation = ++this.generation;
    const result = compareText(left.text, right.text, { generation, leftVersion: left.documentVersion, rightVersion: right.documentVersion, ignoreTrailingWhitespace: settings.ignoreTrailingWhitespace });
    Object.defineProperty(result, 'current', { get: () => generation === this.generation && left.documentVersion === result.leftVersion && right.documentVersion === result.rightVersion });
    return result as DiffResult & { current: boolean };
  }
}
