import { database, type Result } from '@luzenrocy/treasure-sdk';
import { deriveKey, iterations, open, randomSalt, seal } from '../crypto/vault';
import { validateEntry, type Entry } from '../domain/entry';

interface State { active_vault_id: string; revision: string }
interface SetRow { salt: string; kdf_iterations: number; verifier_envelope: string; state: string }
interface EntryRow { entry_id: string; entry_revision: string; envelope: string }
export interface RecordEntry { entry: Entry; revision: string }
export interface Session { id: string; revision: string; key: CryptoKey; entries: RecordEntry[] }

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`宿主操作失败（${result.error.code}）`);
  return result.value;
}

export async function getState(): Promise<State | null> {
  const { rows } = unwrap(await database.query<State>({
    sql: 'SELECT active_vault_id, revision FROM vault_state WHERE id = 1',
    tables: ['vault_state'],
  }));
  return rows[0] ?? null;
}

export async function createVault(password: string): Promise<void> {
  const id = crypto.randomUUID();
  const revision = crypto.randomUUID();
  const salt = randomSalt();
  const key = await deriveKey(password, salt);
  const verifier = await seal(key, { id, marker: 'jian-fu-ce' }, ['verifier', 1, id]);
  const result = unwrap(await database.transaction([
    {
      sql: `INSERT INTO vault_sets (vault_id, format_version, salt, kdf_iterations, verifier_envelope, state)
            SELECT ?, 1, ?, ?, ?, 'ready' WHERE NOT EXISTS (SELECT 1 FROM vault_state WHERE id = 1)`,
      tables: ['vault_sets', 'vault_state'], params: [id, salt, iterations, verifier],
    },
    {
      sql: `INSERT INTO vault_state (id, active_vault_id, revision)
            SELECT 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM vault_state WHERE id = 1)
            AND EXISTS (SELECT 1 FROM vault_sets WHERE vault_id = ? AND state = 'ready')`,
      tables: ['vault_state', 'vault_sets'], params: [id, revision, id],
    },
  ]));
  if (result.length !== 2 || result.some(row => row.affectedRows !== 1)) throw new Error('资料库创建未确认，请重新打开');
}

export async function unlock(password: string): Promise<Session> {
  const state = await getState();
  if (!state) throw new Error('资料库不存在');
  const { rows } = unwrap(await database.query<SetRow>({
    sql: 'SELECT salt, kdf_iterations, verifier_envelope, state FROM vault_sets WHERE vault_id = ?',
    tables: ['vault_sets'], params: [state.active_vault_id],
  }));
  const vault = rows[0];
  if (!vault || vault.state !== 'ready' || vault.kdf_iterations !== iterations) throw new Error('资料库不可用');
  const key = await deriveKey(password, vault.salt);
  try {
    const verifier = await open(key, vault.verifier_envelope, ['verifier', 1, state.active_vault_id]) as { id: string; marker: string };
    if (verifier.id !== state.active_vault_id || verifier.marker !== 'jian-fu-ce') throw new Error('invalid');
  } catch {
    throw new Error('主密码错误或资料库已损坏');
  }
  const entries: RecordEntry[] = [];
  let cursor = '';
  while (true) {
    const page = unwrap(await database.query<EntryRow>({
      sql: `SELECT entry_id, entry_revision, envelope FROM vault_entries
            WHERE vault_id = ? AND entry_id > ? ORDER BY entry_id LIMIT 1`,
      tables: ['vault_entries'], params: [state.active_vault_id, cursor],
    })).rows;
    if (!page.length) break;
    const row = page[0];
    const entry = validateEntry(await open(key, row.envelope, ['entry', 1, state.active_vault_id, row.entry_id, row.entry_revision]));
    if (entry.id !== row.entry_id) throw new Error('条目校验失败');
    entries.push({ entry, revision: row.entry_revision });
    if (entries.length > 1000) throw new Error('资料库条目过多');
    cursor = row.entry_id;
  }
  const latest = await getState();
  if (!latest || latest.active_vault_id !== state.active_vault_id || latest.revision !== state.revision) throw new Error('资料库已更新，请重新解锁');
  return { id: state.active_vault_id, revision: state.revision, key, entries };
}

export async function writeEntry(session: Session, entry: Entry, oldRevision?: string, remove = false): Promise<Session> {
  validateEntry(entry);
  const next = crypto.randomUUID();
  const envelope = remove ? '' : await seal(session.key, entry, ['entry', 1, session.id, entry.id, next]);
  const predicate = oldRevision
    ? 'EXISTS (SELECT 1 FROM vault_entries WHERE vault_id = ? AND entry_id = ? AND entry_revision = ?)'
    : 'NOT EXISTS (SELECT 1 FROM vault_entries WHERE vault_id = ? AND entry_id = ?)';
  const condition = oldRevision ? [session.id, entry.id, oldRevision] : [session.id, entry.id];
  const stateUpdate = {
    sql: `UPDATE vault_state SET revision = ? WHERE id = 1 AND active_vault_id = ? AND revision = ? AND ${predicate}`,
    tables: ['vault_state', 'vault_entries'], params: [next, session.id, session.revision, ...condition],
  };
  const guard = 'EXISTS (SELECT 1 FROM vault_state WHERE id = 1 AND active_vault_id = ? AND revision = ?)';
  const write = remove
    ? { sql: `DELETE FROM vault_entries WHERE vault_id = ? AND entry_id = ? AND entry_revision = ? AND ${guard}`, params: [session.id, entry.id, oldRevision, session.id, next] }
    : oldRevision
      ? { sql: `UPDATE vault_entries SET entry_revision = ?, envelope = ? WHERE vault_id = ? AND entry_id = ? AND entry_revision = ? AND ${guard}`, params: [next, envelope, session.id, entry.id, oldRevision, session.id, next] }
      : { sql: `INSERT INTO vault_entries (vault_id, entry_id, entry_revision, envelope) SELECT ?, ?, ?, ? WHERE ${guard}`, params: [session.id, entry.id, next, envelope, session.id, next] };
  const result = unwrap(await database.transaction([stateUpdate, { ...write, tables: ['vault_entries', 'vault_state'] }]));
  if (result.length !== 2 || result[0].affectedRows !== 1 || result[1].affectedRows !== 1) throw new Error('保存未确认，请锁定后重新解锁');
  const entries = session.entries.filter(item => item.entry.id !== entry.id);
  if (!remove) entries.push({ entry, revision: next });
  return { ...session, revision: next, entries };
}
