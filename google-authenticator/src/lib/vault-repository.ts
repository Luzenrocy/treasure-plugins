import { database, storage } from 'treasure-sdk';
import { decodeEncryptedVault, decryptVault, encodeEncryptedVault, encryptVault, type Vault } from './vault';

const VAULT_KEY = 'vault/v1.json';

export async function saveVault(password: string, vault: Vault): Promise<void> {
  const encrypted = await encryptVault(password, vault);
  const stored = await storage.write({ key: VAULT_KEY, data: encodeEncryptedVault(encrypted) });
  if (!stored.ok) throw new Error(stored.error.message);
  const metadata = await database.execute({
    sql: `INSERT INTO vault_meta (id, format_version, updated_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET format_version = excluded.format_version, updated_at = excluded.updated_at`,
    tables: ['vault_meta'], params: [1, Date.now()],
  });
  if (!metadata.ok) throw new Error(metadata.error.message);
}

export async function loadVault(password: string): Promise<Vault> {
  const stored = await storage.read(VAULT_KEY);
  if (!stored.ok) {
    if (stored.error.code === 'NOT_FOUND') return { version: 1, accounts: [] };
    throw new Error(stored.error.message);
  }
  return decryptVault(password, decodeEncryptedVault(stored.value));
}

export async function hasVault(): Promise<boolean> {
  const result = await database.query<{ id: number }>({ sql: 'SELECT id FROM vault_meta WHERE id = 1', tables: ['vault_meta'] });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.rows.length > 0;
}
