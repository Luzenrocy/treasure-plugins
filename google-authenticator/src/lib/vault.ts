import type { ImportedAccount } from './migration';
import { generateHotp } from './otp';

export interface VaultAccount extends ImportedAccount {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Vault {
  version: 1;
  accounts: VaultAccount[];
}

export interface EncryptedVault {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 310_000;

function toBase64(bytes: Uint8Array): string {
  let value = '';
  bytes.forEach(byte => { value += String.fromCharCode(byte); });
  return btoa(value);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  if (password.length < 8) throw new Error('主密码至少需要 8 个字符');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

function vaultFromUnknown(value: unknown): Vault {
  if (!value || typeof value !== 'object') throw new Error('保险库数据无效');
  const candidate = value as Partial<Vault>;
  if (candidate.version !== 1 || !Array.isArray(candidate.accounts)) throw new Error('保险库版本不受支持');
  return candidate as Vault;
}

export function makeVaultAccount(account: ImportedAccount): VaultAccount {
  const now = Date.now();
  return { ...account, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

export function updateVaultAccount(existing: VaultAccount, account: ImportedAccount): VaultAccount {
  return { ...existing, ...account, id: existing.id, createdAt: existing.createdAt, updatedAt: Date.now() };
}

export function removeVaultAccount(accounts: VaultAccount[], accountId: string): VaultAccount[] {
  return accounts.filter(account => account.id !== accountId);
}

export async function encryptVault(password: string, vault: Vault): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(vault)));
  return { version: 1, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptVault(password: string, encrypted: EncryptedVault): Promise<Vault> {
  try {
    if (encrypted.version !== 1) throw new Error('unsupported');
    const key = await deriveKey(password, fromBase64(encrypted.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(encrypted.iv) }, key, fromBase64(encrypted.ciphertext),
    );
    return vaultFromUnknown(JSON.parse(decoder.decode(plaintext)));
  } catch {
    throw new Error('主密码错误或保险库数据已损坏');
  }
}

export function encodeEncryptedVault(vault: EncryptedVault): Uint8Array {
  return encoder.encode(JSON.stringify(vault));
}

export function decodeEncryptedVault(bytes: Uint8Array): EncryptedVault {
  const value = JSON.parse(decoder.decode(bytes)) as EncryptedVault;
  if (value.version !== 1 || !value.salt || !value.iv || !value.ciphertext) throw new Error('备份文件格式无效');
  return value;
}

export async function nextHotp(account: VaultAccount): Promise<{ code: string; account: VaultAccount }> {
  if (account.type !== 'hotp') throw new Error('该账号不是 HOTP');
  const code = await generateHotp(account.secret, account.counter, account.digits, account.algorithm);
  return { code, account: { ...account, counter: account.counter + 1, updatedAt: Date.now() } };
}
