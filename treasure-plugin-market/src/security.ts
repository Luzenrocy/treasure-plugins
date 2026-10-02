const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' }, key, 256);
  return { hash: bytesToBase64Url(new Uint8Array(bits)), salt: bytesToBase64Url(salt) };
}

export async function verifyPassword(password: string, hash: string, encodedSalt: string) {
  const salt = base64UrlToBytes(encodedSalt);
  const result = await hashPassword(password, salt);
  return constantTimeEqual(base64UrlToBytes(result.hash), base64UrlToBytes(hash));
}

async function signJwtPart(value: string) {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_JWT_SECRET 未配置或长度不足 32 位');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export function createMfaKey(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * 判断高敏操作是否必须完成 MFA 二次验证（达到 aal2 级别）。
 * 仅当用户已开启 MFA（mfa_enabled === true）且操作声明需要 MFA 时，
 * 才要求 token 的 aal 为 aal2；MFA 未开启时无需二次验证，避免死锁。
 */
export function needsMfaVerification(requireMfa: boolean, mfaEnabled: boolean | null | undefined, aal: string | undefined): boolean {
  return requireMfa && mfaEnabled === true && aal !== 'aal2';
}

async function mfaKey(mfaKeyBase64: string) {
  if (!mfaKeyBase64) throw new Error('mfa_key 缺失，请重新开启 MFA');
  const key = base64UrlToBytes(mfaKeyBase64);
  if (key.length !== 32) throw new Error('mfa_key 长度非法（应为 32 字节），请重新开启 MFA');
  return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptMfaSecret(value: string, mfaKeyBase64: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await mfaKey(mfaKeyBase64), encoder.encode(value));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptMfaSecret(value: string, mfaKeyBase64: string) {
  const [encodedIv, encodedCiphertext] = value.split('.');
  if (!encodedIv || !encodedCiphertext) throw new Error('MFA secret 格式无效');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(encodedIv) }, await mfaKey(mfaKeyBase64), base64UrlToBytes(encodedCiphertext));
  return new TextDecoder().decode(plaintext);
}

export async function createAccessToken(userId: string, aal: 'aal1' | 'aal2' = 'aal1', ttlSeconds = 3600) {
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ sub: userId, aal, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${bytesToBase64Url(await signJwtPart(signingInput))}`;
}

export async function verifyAccessToken(token: string) {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;
  const expected = await signJwtPart(`${header}.${payload}`);
  if (!constantTimeEqual(expected, base64UrlToBytes(signature))) return null;
  const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { sub?: string; aal?: 'aal1' | 'aal2'; exp?: number };
  if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return claims;
}

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value: string) {
  let buffer = 0;
  let bits = 0;
  const result: number[] = [];
  for (const char of value.toUpperCase().replaceAll('=', '')) {
    const index = base32Alphabet.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      result.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(result);
}

export function createTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; output += base32Alphabet[(buffer >> bits) & 31]; }
  }
  if (bits > 0) output += base32Alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

export async function verifyTotp(secret: string, code: string, timestamp = Date.now()) {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const key = await crypto.subtle.importKey('raw', decodeBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = Math.floor(timestamp / 1000 / 30);
  for (let offset = -1; offset <= 1; offset += 1) {
    const data = new ArrayBuffer(8);
    new DataView(data).setBigUint64(0, BigInt(counter + offset));
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
    const position = digest[digest.length - 1] & 0x0f;
    const value = ((digest[position] & 0x7f) << 24) | (digest[position + 1] << 16) | (digest[position + 2] << 8) | digest[position + 3];
    if (String(value % 1_000_000).padStart(6, '0') === normalized) return true;
  }
  return false;
}

export function buildTotpUri(secret: string, username: string) {
  return `otpauth://totp/Treasure%20Plugin%20Market:${encodeURIComponent(username)}?secret=${secret}&issuer=Treasure%20Plugin%20Market&algorithm=SHA1&digits=6&period=30`;
}
