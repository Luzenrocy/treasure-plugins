const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export function normalizeBase32(value: string): string {
  return value.toUpperCase().replace(/[\s-]|=/g, '');
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let buffer = 0;
  let encoded = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) encoded += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return encoded;
}

export function decodeBase32(value: string): Uint8Array {
  const normalized = normalizeBase32(value);
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error('Base32 密钥格式无效');
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const character of normalized) {
    buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function toCounterBytes(counter: number): Uint8Array {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new Error('HOTP 计数器无效');
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}

export async function generateHotp(secret: string, counter: number, digits = 6, algorithm: OtpAlgorithm = 'SHA1'): Promise<string> {
  if (![6, 8].includes(digits)) throw new Error('仅支持 6 位或 8 位验证码');
  const cryptoKey = await crypto.subtle.importKey(
    'raw', decodeBase32(secret), { name: 'HMAC', hash: `SHA-${algorithm.slice(3)}` }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, toCounterBytes(counter)));
  const offset = signature[signature.length - 1] & 15;
  const binary = ((signature[offset] & 127) << 24)
    | (signature[offset + 1] << 16)
    | (signature[offset + 2] << 8)
    | signature[offset + 3];
  return String(binary % (10 ** digits)).padStart(digits, '0');
}

export async function generateTotp(secret: string, timestamp = Date.now(), period = 30, digits = 6, algorithm: OtpAlgorithm = 'SHA1'): Promise<string> {
  if (!Number.isFinite(period) || period <= 0) throw new Error('TOTP 周期无效');
  return generateHotp(secret, Math.floor(timestamp / 1000 / period), digits, algorithm);
}

export function getTotpRemainingSeconds(timestamp = Date.now(), period = 30): number {
  const seconds = Math.floor(timestamp / 1000);
  return period - (seconds % period) || period;
}

export function getTotpProgress(timestamp = Date.now(), period = 30): number {
  return getTotpRemainingSeconds(timestamp, period) / period;
}

export function formatOtp(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
