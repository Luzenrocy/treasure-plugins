import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from '@zxing/library';

function joinBytes(...parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function encodeVarint(value) {
  const bytes = [];
  let current = value >>> 0;
  do { bytes.push((current & 127) | (current > 127 ? 128 : 0)); current >>>= 7; } while (current > 0);
  return Uint8Array.from(bytes);
}

function bytesField(field, value) { return joinBytes(encodeVarint((field << 3) | 2), encodeVarint(value.length), value); }
function numberField(field, value) { return joinBytes(encodeVarint(field << 3), encodeVarint(value)); }
function textField(field, value) { return bytesField(field, new TextEncoder().encode(value)); }

function toBase64(bytes) { return btoa(String.fromCharCode(...bytes)); }

function buildMigrationUri() {
  const parameters = Array.from({ length: 12 }, (_unused, index) => {
    const algorithm = index % 3 === 0 ? 3 : index % 3 === 1 ? 2 : 1;
    const type = index === 11 ? 1 : 2;
    const secret = Uint8Array.from({ length: 20 }, (_unused, offset) => (index * 31 + offset * 17) & 255);
    return joinBytes(
      bytesField(1, secret), textField(2, `test-user-${index}@example.invalid`), textField(3, `Virtual Service ${index % 4}`),
      numberField(4, algorithm), numberField(5, index % 2 ? 2 : 1), numberField(6, type), textField(7, String(index + 10)),
    );
  });
  const payload = joinBytes(...parameters.map(parameter => bytesField(1, parameter)), numberField(2, 1), numberField(3, 1), numberField(4, 0), numberField(5, 7));
  return `otpauth-migration://offline?data=${toBase64(payload)}`;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

function matrixToPng(matrix) {
  const width = matrix.getWidth();
  const height = matrix.getHeight();
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) raw[row + x + 1] = matrix.get(x, y) ? 0 : 255;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

const target = resolve(process.cwd(), 'test-fixtures/google-migration-12-virtual-accounts.png');
const uri = buildMigrationUri();
const matrix = new QRCodeWriter().encode(uri, BarcodeFormat.QR_CODE, 768, 768, new Map([[EncodeHintType.MARGIN, 4]]));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, matrixToPng(matrix));
console.log(`虚拟测试二维码已生成：${target}`);
