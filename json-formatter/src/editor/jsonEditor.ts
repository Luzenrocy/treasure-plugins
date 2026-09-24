import { analyzeJson, compactJson, formatJson, type JsonIndent } from '../domain/json';

export interface JsonEditorModel { text: string; folded: boolean; foldDepth?: number; documentVersion: number; }
export function createJsonEditor(text = ''): JsonEditorModel { return { text, folded: false, documentVersion: 0 }; }
export function replaceJsonText(model: JsonEditorModel, text: string): JsonEditorModel { return { ...model, text, documentVersion: model.documentVersion + 1 }; }
export function transformJson(model: JsonEditorModel, operation: 'format' | 'compact', indent: JsonIndent): JsonEditorModel { return replaceJsonText(model, operation === 'format' ? formatJson(model.text, indent) : compactJson(model.text)); }
export { analyzeJson };
