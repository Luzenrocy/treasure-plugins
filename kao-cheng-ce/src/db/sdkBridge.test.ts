import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, execute, transaction, write } = vi.hoisted(() => ({
  query: vi.fn(), execute: vi.fn(), transaction: vi.fn(), write: vi.fn(),
}));

vi.mock('treasure-sdk', () => ({
  database: { query, execute, transaction },
  storage: { write },
  logs: { write: vi.fn() },
}));

import { sdkBridge } from './sdkBridge';

describe('sdkBridge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes query rows from SDK Result', async () => {
    query.mockResolvedValue({ ok: true, value: { rows: [{ id: 1 }] } });
    await expect(sdkBridge.query('SELECT * FROM tasks', ['tasks'])).resolves.toEqual({ code: 1, data: [{ id: 1 }] });
  });

  it('retains RETURNING rows from execute', async () => {
    execute.mockResolvedValue({ ok: true, value: { affectedRows: 1, rows: [{ id: 9 }] } });
    await expect(sdkBridge.execute('INSERT INTO tasks DEFAULT VALUES RETURNING id', ['tasks'])).resolves.toEqual({ code: 1, data: [{ id: 9 }] });
  });

  it('converts a structured failure without throwing', async () => {
    transaction.mockResolvedValue({ ok: false, error: { code: 'PERMISSION_DENIED', message: 'revoked' } });
    await expect(sdkBridge.transaction([])).resolves.toEqual({ code: 0, msg: 'revoked' });
  });
});
