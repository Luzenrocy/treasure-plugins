const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const iterations = 600_000;

export interface Envelope {
  version: 1;
  iv: string;
  ciphertext: string;
}

export function encode64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decode64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('编码无效');
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function randomSalt(): string {
  return encode64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(password: string, encodedSalt: string): Promise<CryptoKey> {
  const salt = decode64(encodedSalt);
  if (salt.byteLength !== 16 || Array.from(password).length < 12 || encoder.encode(password).byteLength > 1024) throw new Error('主密码或盐无效');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(key: CryptoKey, value: unknown, aad: readonly unknown[]): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(aad)), tagLength: 128 },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return JSON.stringify({ version: 1, iv: encode64(iv), ciphertext: encode64(new Uint8Array(ciphertext)) } satisfies Envelope);
}

export async function open(key: CryptoKey, data: string, aad: readonly unknown[]): Promise<unknown> {
  if (data.length > 100_000) throw new Error('密文过大');
  const envelope: Envelope = JSON.parse(data);
  if (!envelope || envelope.version !== 1 || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') throw new Error('密文格式无效');
  const iv = decode64(envelope.iv);
  const ciphertext = decode64(envelope.ciphertext);
  if (iv.length !== 12 || ciphertext.length < 16) throw new Error('密文格式无效');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(aad)), tagLength: 128 },
    key,
    ciphertext,
  );
  return JSON.parse(decoder.decode(plain));
}
