import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'icon.png'));

function readPngRgb(png) {
  const signature = '89504e470d0a1a0a';
  if (png.subarray(0, 8).toString('hex') !== signature) throw new Error('Expected a PNG source icon.');

  let offset = 8;
  let width;
  let height;
  let channels;
  const idat = [];
  while (offset < png.length) {
    const size = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + size);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0) throw new Error('Expected a non-interlaced 8-bit RGB or RGBA PNG.');
      channels = data[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') idat.push(data);
    offset += size + 12;
  }

  const bytesPerPixel = channels;
  const stride = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(idat));
  const decoded = new Uint8Array(width * height * bytesPerPixel);
  let readOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[readOffset++];
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[readOffset++];
      const left = x >= bytesPerPixel ? decoded[y * stride + x - bytesPerPixel] : 0;
      const above = y > 0 ? decoded[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? decoded[(y - 1) * stride + x - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : paeth(left, above, upperLeft);
      decoded[y * stride + x] = (raw + predictor) & 0xff;
    }
  }
  const rgb = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgb[pixel * 3] = decoded[pixel * bytesPerPixel];
    rgb[pixel * 3 + 1] = decoded[pixel * bytesPerPixel + 1];
    rgb[pixel * 3 + 2] = decoded[pixel * bytesPerPixel + 2];
  }
  return { width, height, rgb };
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left
    : aboveDistance <= upperLeftDistance ? above
      : upperLeft;
}

function fillSmallInteriorGaps(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let touchesEdge = false;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      touchesEdge ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
      for (const neighbour of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
        if (neighbour < 0 || neighbour >= mask.length || visited[neighbour]) continue;
        const nx = neighbour % width;
        if (Math.abs(nx - x) > 1 || mask[neighbour]) continue;
        visited[neighbour] = 1;
        queue[tail++] = neighbour;
      }
    }
    // Preserve the prominent circular cutout but absorb small hand-drawn highlights.
    if (!touchesEdge && tail < 500) for (let i = 0; i < tail; i += 1) mask[queue[i]] = 1;
  }
}

function lineMask(mask, width, height, thickness) {
  const distance = new Int16Array(mask.length).fill(-1);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) {
      distance[pixel] = 0;
      queue[tail++] = pixel;
    }
  }
  while (head < tail) {
    const pixel = queue[head++];
    if (distance[pixel] === thickness) continue;
    const x = pixel % width;
    for (const neighbour of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
      if (neighbour < 0 || neighbour >= mask.length || distance[neighbour] !== -1) continue;
      const nx = neighbour % width;
      if (Math.abs(nx - x) > 1) continue;
      distance[neighbour] = distance[pixel] + 1;
      queue[tail++] = neighbour;
    }
  }
  return mask.map((foreground, pixel) => Number(foreground && distance[pixel] <= thickness));
}

const { width, height, rgb } = readPngRgb(source);
const silhouette = new Uint8Array(width * height);
for (let pixel = 0; pixel < silhouette.length; pixel += 1) {
  const offset = pixel * 3;
  const red = rgb[offset];
  const green = rgb[offset + 1];
  const blue = rgb[offset + 2];
  // Identify the original purple mark rather than assuming a white canvas.
  silhouette[pixel] = blue - Math.max(red, green) > 30 ? 1 : 0;
}
fillSmallInteriorGaps(silhouette, width, height);
const outline = lineMask(silhouette, width, height, 30);

const rows = [];
for (let y = 0; y < height; y += 1) {
  let x = 0;
  while (x < width) {
    if (!outline[y * width + x]) {
      x += 1;
      continue;
    }
    const start = x;
    while (x < width && outline[y * width + x]) x += 1;
    rows.push(`M${start} ${y}h${x - start}v1H${start}Z`);
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 ${width} ${height}" fill="currentColor" role="img" aria-label="Excalidraw">\n  <path d="${rows.join('')}"/>\n</svg>\n`;
writeFileSync(resolve(root, 'public/assets/excalidraw-menu.svg'), svg);
