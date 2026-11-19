import type { Sheet } from './domain';
import { edgePath, layoutSheet, nodeFill } from './canvas';

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char] ?? char));

export function sheetToSvg(sheet: Sheet, transparent = false): string {
  const { nodes, edges, theme, bounds } = layoutSheet(sheet);
  const padding = 32, width = Math.ceil(bounds.width + padding * 2), height = Math.ceil(bounds.height + padding * 2);
  const paths = edges.map((edge) => `<path d="${edgePath(edge, sheet.layout)}" fill="none" stroke="${theme.lines[edge.to.branch % 4]}" stroke-width="2" stroke-linecap="round"/>`).join('');
  const boxes = nodes.map((item) => {
    const { node, x, y, depth, width: w, height: h, lines, branch } = item;
    const leaf = depth > 1, root = depth === 0;
    const fill = escapeXml(nodeFill(item, theme));
    const color = escapeXml(node.style?.color ?? (root ? '#ffffff' : '#302b38'));
    const text = lines.map((line, index) => `<tspan x="0" y="${(index - (lines.length - 1) / 2) * (root ? 24 : 20) + 5}">${escapeXml(line)}</tspan>`).join('');
    const underline = leaf ? `<path d="M ${-w / 2 + 8} ${h / 2 - 3} H ${w / 2 - 8}" stroke="${theme.lines[branch % 4]}" stroke-width="1.5"/>` : '';
    const note = node.note ? `<g transform="translate(${w / 2 - 13},${-h / 2 + 10})"><path d="M-3-3h6v7h-6Z" fill="none" stroke="#756e7d"/></g>` : '';
    return `<g transform="translate(${x},${y})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${root ? 15 : 11}" fill="${fill}"/>${underline}<text text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif" font-size="${root ? 19 : 15}" font-weight="${leaf ? 400 : 500}" fill="${color}">${text}</text>${note}</g>`;
  }).join('');
  const background = transparent ? '' : `<rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" width="${width}" height="${height}" fill="#faf8f4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}">${background}${paths}${boxes}</svg>`;
}

export function svgToPng(svg: string, scale = 2): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG 渲染失败。')); };
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(image.naturalWidth * scale); canvas.height = Math.ceil(image.naturalHeight * scale);
      if (canvas.width > 16384 || canvas.height > 16384 || canvas.width * canvas.height > 64_000_000) {
        URL.revokeObjectURL(url); reject(new Error('图片尺寸过大，请选择 1× 或导出 SVG。')); return;
      }
      const context = canvas.getContext('2d');
      if (!context) { URL.revokeObjectURL(url); reject(new Error('无法创建导出画布。')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(url);
        if (!blob) { reject(new Error('PNG 编码失败。')); return; }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/png');
    };
    image.src = url;
  });
}
