export type ErrorCode =
  | 'CANCELLED' | 'NOT_FOUND' | 'PERMISSION_DENIED' | 'GRANT_NOT_FOUND'
  | 'REFERENCE_EXPIRED' | 'INVALID_FILE_NAME' | 'VALIDATION_FAILED'
  | 'FILE_TOO_LARGE' | 'IO_ERROR' | 'CONFLICT' | 'UNSUPPORTED' | 'INTERNAL';

export interface DomainError { code: ErrorCode; message: string; stage?: string; cause?: unknown }
export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(code: ErrorCode, message: string, stage?: string, cause?: unknown): Result<T> => ({ ok: false, error: { code, message, stage, cause } });
export const isCancelled = (value: { ok: false; error: { code: string } }): boolean => value.error.code === 'CANCELLED';
export function sdkError(error: { code?: string; message?: string } | unknown, stage?: string): DomainError {
  const value = error && typeof error === 'object' ? error as { code?: string; message?: string } : {};
  const code = (value.code || 'INTERNAL') as ErrorCode;
  return { code: (['CANCELLED', 'NOT_FOUND', 'PERMISSION_DENIED', 'GRANT_NOT_FOUND', 'REFERENCE_EXPIRED', 'INVALID_FILE_NAME', 'VALIDATION_FAILED', 'FILE_TOO_LARGE', 'IO_ERROR', 'CONFLICT', 'UNSUPPORTED', 'INTERNAL'].includes(code) ? code : 'INTERNAL'), message: value.message || '操作失败', stage, cause: error };
}
