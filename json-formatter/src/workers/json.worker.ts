import { analyzeJson, compactJson, formatJson, type JsonIndent } from '../domain/json';

export type JsonWorkerRequest = { operation: 'analyze' | 'format' | 'compact'; text: string; indent?: JsonIndent; generation: number; documentVersion: number };
export function handleJsonRequest(request: JsonWorkerRequest) {
  const result = request.operation === 'analyze' ? analyzeJson(request.text, request.indent) : request.operation === 'format' ? formatJson(request.text, request.indent ?? '2') : compactJson(request.text);
  return { generation: request.generation, documentVersion: request.documentVersion, result };
}

export function attachJsonWorker(scope: { addEventListener: (type: string, listener: (event: MessageEvent<JsonWorkerRequest>) => void) => void; postMessage: (message: unknown) => void }) {
  scope.addEventListener('message', (event: MessageEvent<JsonWorkerRequest>) => { try { scope.postMessage({ ok: true, ...handleJsonRequest(event.data) }); } catch (error) { scope.postMessage({ ok: false, generation: event.data.generation, documentVersion: event.data.documentVersion, message: error instanceof Error ? error.message : 'JSON 处理失败' }); } });
}
