import { compareText } from '../domain/diff';
import type { DiffSettings } from '../domain/diffSettings';
import type { DiffResult } from '../domain/diffState';

export interface DiffEditorModel { left: string; right: string; result: DiffResult; }
export function createDiffModel(left: string, right: string, settings: DiffSettings): DiffEditorModel { return { left, right, result: compareText(left, right, settings) }; }
export function swapDiffModel(model: DiffEditorModel, settings: DiffSettings): DiffEditorModel { return createDiffModel(model.right, model.left, settings); }
