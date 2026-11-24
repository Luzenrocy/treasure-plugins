import { database, storage } from '@luzenrocy/treasure-sdk';
import { decodeEncryptedVault, decryptVault, encodeEncryptedVault, encryptVault, type Vault } from './vault';

const VAULT_KEY = 'vault/v1.json';

/**
 * Older Treasure hosts surface a missing private-storage file as a raw
 * platform I/O error instead of the SDK's NOT_FOUND result. A vault does not
 * exist on a plugin's first launch, so both forms must enter the setup flow.
 */
function isMissingVault(error: { code: string; message: string }): boolean {
  return error.code === 'NOT_FOUND'
    || /(?:no such file or directory|os error 2)/i.test(error.message);
}

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
    if (isMissingVault(stored.error)) return { version: 1, accounts: [] };
    throw new Error(stored.error.message);
  }
  return decryptVault(password, decodeEncryptedVault(stored.value));
}

export async function hasVault(): Promise<boolean> {
  const stored = await storage.read(VAULT_KEY);
  if (!stored.ok) {
    if (isMissingVault(stored.error)) return false;
    throw new Error(stored.error.message);
  }
  return true;
}
