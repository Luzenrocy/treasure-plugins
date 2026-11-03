import { err, ok, type Result } from '../domain/errors';

export const MAX_BYTES = 32 * 1024 * 1024;
export function guardBytes(data: Uint8Array | ArrayBuffer | Blob | string, stage = '写入'): Result<number> {
  const size = typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data instanceof Blob ? data.size : data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
  return size > MAX_BYTES ? err('FILE_TOO_LARGE', `${stage}内容超过 32 MiB 限制`, stage) : ok(size);
}
export function asBytes(data: Uint8Array | ArrayBuffer | Blob | string): Promise<Uint8Array> | Uint8Array {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return data.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}
