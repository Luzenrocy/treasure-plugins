import { database, logs } from 'treasure-sdk';

export type LegacyResponse<T = unknown> = { code: 1; data?: T; msg?: never } | { code: 0; data?: never; msg: string };
export type Statement = { sql: string; tables: string[]; params?: unknown[] };

/**
 * Isolates the temporary business-layer response shape from SDK 2.0 transport.
 * All host calls still use typed SDK modules and Result<T>.
 */
export const sdkBridge = {
  log: (level: 'trace' | 'debug' | 'info' | 'warn' | 'error', category: string, message: string, details?: unknown) =>
    logs.write({ level, category, message, details }),
  async query(sql: string, tables: string[], params?: unknown[]): Promise<LegacyResponse<any>> {
    const response = await database.query<any>({ sql, tables, params });
    return response.ok ? { code: 1, data: response.value.rows } : { code: 0, msg: response.error.message };
  },
  async execute(sql: string, tables: string[], params?: unknown[]): Promise<LegacyResponse<any>> {
    const response = await database.execute<any>({ sql, tables, params });
    return response.ok
      ? { code: 1, data: response.value.rows ?? { affectedRows: response.value.affectedRows, lastInsertId: response.value.lastInsertId } }
      : { code: 0, msg: response.error.message };
  },
  async transaction(ops: Statement[]): Promise<LegacyResponse<any>> {
    const response = await database.transaction(ops);
    return response.ok ? { code: 1, data: response.value } : { code: 0, msg: response.error.message };
  },
};
