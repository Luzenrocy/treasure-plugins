import jsQR from 'jsqr';
import { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';

const MAX_SCAN_SIZE = 4_096;

export interface QrRaster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type QrScanner = (data: Uint8ClampedArray, width: number, height: number, options: { inversionAttempts: 'attemptBoth' }) => { data: string } | null;
export type QrRasterFallback = (raster: QrRaster) => string | undefined;

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
}

interface NativeBarcodeDetectorConstructor {
  new (options: { formats: string[] }): NativeBarcodeDetector;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取'));
    image.src = url;
  });
}

function toArgbPixels(raster: QrRaster): Int32Array {
  const pixels = new Int32Array(raster.width * raster.height);
  for (let sourceOffset = 0, targetOffset = 0; targetOffset < pixels.length; sourceOffset += 4, targetOffset += 1) {
    const red = raster.data[sourceOffset];
    const green = raster.data[sourceOffset + 1];
    const blue = raster.data[sourceOffset + 2];
    const alpha = raster.data[sourceOffset + 3];
    pixels[targetOffset] = (alpha << 24) | (red << 16) | (green << 8) | blue;
  }
  return pixels;
}

export function decodeWithZxing(raster: QrRaster): string | undefined {
  const source = new RGBLuminanceSource(toArgbPixels(raster), raster.width, raster.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const hintSets = [
    new Map([[DecodeHintType.TRY_HARDER, true]]),
    new Map([[DecodeHintType.PURE_BARCODE, true]]),
  ];
  for (const hints of hintSets) {
    try {
      return new QRCodeReader().decode(bitmap, hints).getText();
    } catch {
      // A clean, cropped QR image can succeed only in PURE_BARCODE mode.
    }
  }
  return undefined;
}

function thresholdQrRaster(raster: QrRaster): QrRaster {
  const data = new Uint8ClampedArray(raster.data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    const luminance = (raster.data[offset] * 299 + raster.data[offset + 1] * 587 + raster.data[offset + 2] * 114) / 1_000;
    const value = raster.data[offset + 3] < 128 || luminance >= 180 ? 255 : 0;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return { data, width: raster.width, height: raster.height };
}

export function getQrRasterVariants(rasters: readonly QrRaster[]): QrRaster[] {
  return [...rasters, ...rasters.map(thresholdQrRaster)];
}

export function decodeQrRasters(rasters: readonly QrRaster[], scan: QrScanner = jsQR, fallback: QrRasterFallback = decodeWithZxing): string | undefined {
  for (const raster of getQrRasterVariants(rasters)) {
    const result = scan(raster.data, raster.width, raster.height, { inversionAttempts: 'attemptBoth' });
    if (result?.data) return result.data;
    const fallbackResult = fallback(raster);
    if (fallbackResult) return fallbackResult;
  }
  return undefined;
}

export async function decodeWithNativeDetector(image: HTMLImageElement): Promise<string | undefined> {
  const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return undefined;
  try {
    const results = await new Detector({ formats: ['qr_code'] }).detect(image);
    return results.find(result => result.rawValue)?.rawValue;
  } catch {
    return undefined;
  }
}

export function getQrScanDimensions(width: number, height: number): Array<{ width: number; height: number }> {
  const longest = Math.max(width, height);
  const scales = [Math.min(1, MAX_SCAN_SIZE / longest)];
  if (longest <= MAX_SCAN_SIZE / 2) scales.push(2);
  if (longest <= MAX_SCAN_SIZE / 4) scales.push(4);
  const dimensions = scales.map(scale => ({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }));
  return dimensions.filter((dimension, index) => dimensions.findIndex(other => other.width === dimension.width && other.height === dimension.height) === index);
}

export function renderQrRasters(image: HTMLImageElement): QrRaster[] {
  return getQrScanDimensions(image.naturalWidth, image.naturalHeight).map(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('浏览器不支持图片解析');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height);
    return { data: data.data, width: data.width, height: data.height };
  });
}

export async function decodeQrImage(bytes: Uint8Array): Promise<string> {
  const url = URL.createObjectURL(new Blob([bytes]));
  try {
    const image = await loadImage(url);
    const nativeResult = await decodeWithNativeDetector(image);
    const fallbackResult = nativeResult ?? decodeQrRasters(renderQrRasters(image));
    if (!fallbackResult) throw new Error('未在图片中识别到二维码。请使用原始截图，或将二维码区域单独裁剪后重试。');
    return fallbackResult;
  } finally {
    URL.revokeObjectURL(url);
  }
}
