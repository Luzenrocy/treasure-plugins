import { database, storage } from '@luzenrocy/treasure-sdk';
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
    throw new Error(stored.error.message);
  }
  return decryptVault(password, decodeEncryptedVault(stored.value));
}

/**
 * Treasure storage has no separate `exists` operation. Probe the private
 * file once at startup: a readable file is an existing vault; otherwise the
 * product enters its first-run creation flow without inspecting host-specific
 * I/O error codes or messages.
 */
export async function hasVault(): Promise<boolean> {
  const stored = await storage.read(VAULT_KEY);
  return stored.ok;
}
