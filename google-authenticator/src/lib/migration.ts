import { encodeBase32, normalizeBase32, type OtpAlgorithm } from './otp';

export type AccountType = 'totp' | 'hotp';

export interface ImportedAccount {
  issuer: string;
  name: string;
  secret: string;
  algorithm: OtpAlgorithm;
  digits: 6 | 8;
  type: AccountType;
  counter: number;
  period: number;
}

export interface MigrationPayload {
  accounts: ImportedAccount[];
  batch: { size: number; index: number; id: number };
}

type ProtoField = { field: number; wire: number; value: Uint8Array | number };

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function readVarint(bytes: Uint8Array, start: number): [number, number] {
  let value = 0;
  let shift = 0;
  let index = start;
  while (index < bytes.length && shift <= 28) {
    const byte = bytes[index];
    value |= (byte & 127) << shift;
    index += 1;
    if ((byte & 128) === 0) return [value >>> 0, index];
    shift += 7;
  }
  throw new Error('Protobuf varint 无效');
}

function readFields(bytes: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let index = 0;
  while (index < bytes.length) {
    const [tag, nextTag] = readVarint(bytes, index);
    index = nextTag;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire === 0) {
      const [value, next] = readVarint(bytes, index);
      fields.push({ field, wire, value });
      index = next;
    } else if (wire === 2) {
      const [length, next] = readVarint(bytes, index);
      const end = next + length;
      if (end > bytes.length) throw new Error('Protobuf 字段长度无效');
      fields.push({ field, wire, value: bytes.slice(next, end) });
      index = end;
    } else {
      throw new Error('不支持的 Protobuf 字段类型');
    }
  }
  return fields;
}

function firstBytes(fields: ProtoField[], field: number): Uint8Array | undefined {
  return fields.find(item => item.field === field && item.value instanceof Uint8Array)?.value as Uint8Array | undefined;
}

function firstNumber(fields: ProtoField[], field: number): number | undefined {
  return fields.find(item => item.field === field && typeof item.value === 'number')?.value as number | undefined;
}

function decodeText(bytes?: Uint8Array): string {
  return bytes ? new TextDecoder().decode(bytes) : '';
}

function algorithmFromValue(value?: number): OtpAlgorithm {
  if (value === 2) return 'SHA256';
  if (value === 3) return 'SHA512';
  return 'SHA1';
}

function digitsFromValue(value?: number): 6 | 8 {
  return value === 2 || value === 8 ? 8 : 6;
}

function parseMigrationParameter(encoded: Uint8Array): ImportedAccount {
  const fields = readFields(encoded);
  const secret = firstBytes(fields, 1);
  if (!secret?.length) throw new Error('迁移二维码缺少密钥');
  const typeValue = firstNumber(fields, 6);
  return {
    secret: encodeBase32(secret),
    name: decodeText(firstBytes(fields, 2)) || '未命名账号',
    issuer: decodeText(firstBytes(fields, 3)),
    algorithm: algorithmFromValue(firstNumber(fields, 4)),
    digits: digitsFromValue(firstNumber(fields, 5)),
    type: typeValue === 1 ? 'hotp' : 'totp',
    counter: Number(decodeText(firstBytes(fields, 7)) || 0),
    period: 30,
  };
}

export function parseGoogleMigrationPayload(rawUri: string): MigrationPayload {
  let url: URL;
  try { url = new URL(rawUri); } catch { throw new Error('Google 转移链接无效'); }
  if (url.protocol !== 'otpauth-migration:') throw new Error('不是 Google Authenticator 转移链接');
  const data = url.searchParams.get('data');
  if (!data) throw new Error('转移链接缺少 data 数据');
  const payload = readFields(decodeBase64(data));
  const accounts = payload.filter(item => item.field === 1 && item.value instanceof Uint8Array)
    .map(item => parseMigrationParameter(item.value as Uint8Array));
  if (!accounts.length) throw new Error('转移链接中没有账号');
  return { accounts, batch: { size: firstNumber(payload, 3) ?? 1, index: firstNumber(payload, 4) ?? 0, id: firstNumber(payload, 5) ?? 0 } };
}

export function parseGoogleMigrationUri(rawUri: string): ImportedAccount[] {
  return parseGoogleMigrationPayload(rawUri).accounts;
}

export function parseOtpAuthUri(rawUri: string): ImportedAccount {
  let url: URL;
  try { url = new URL(rawUri); } catch { throw new Error('otpauth 链接无效'); }
  if (url.protocol !== 'otpauth:') throw new Error('不是 otpauth 链接');
  const type = url.hostname.toLowerCase();
  if (type !== 'totp' && type !== 'hotp') throw new Error('不支持的 OTP 类型');
  const secret = normalizeBase32(url.searchParams.get('secret') ?? '');
  if (!secret) throw new Error('otpauth 链接缺少密钥');
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const separator = label.indexOf(':');
  const issuerFromLabel = separator >= 0 ? label.slice(0, separator).trim() : '';
  const name = (separator >= 0 ? label.slice(separator + 1) : label).trim() || '未命名账号';
  const algorithm = (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase();
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) throw new Error('不支持的哈希算法');
  const digits = Number(url.searchParams.get('digits') ?? 6);
  if (digits !== 6 && digits !== 8) throw new Error('仅支持 6 位或 8 位验证码');
  const counter = Number(url.searchParams.get('counter') ?? 0);
  if (type === 'hotp' && (!Number.isSafeInteger(counter) || counter < 0)) throw new Error('HOTP counter 无效');
  return {
    issuer: issuerFromLabel || (url.searchParams.get('issuer') ?? '').trim(), name, secret,
    algorithm: algorithm as OtpAlgorithm, digits, type, counter, period: Number(url.searchParams.get('period') ?? 30),
  };
}
