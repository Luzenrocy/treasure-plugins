import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(root, 'node_modules', '@excalidraw', 'excalidraw');
const destination = join(root, 'public', 'excalidraw', 'fonts');
const candidates = [
  join(packageRoot, 'dist', 'prod', 'fonts'),
  join(packageRoot, 'dist', 'fonts'),
  join(packageRoot, 'fonts'),
];

const source = candidates.find((candidate) => existsSync(candidate));
if (!source) {
  console.warn('⚠️ 未找到 Excalidraw 字体资源；依赖安装后可重新执行此脚本。');
  process.exit(0);
}

mkdirSync(destination, { recursive: true });
for (const file of readdirSync(source)) {
  cpSync(join(source, file), join(destination, file), { recursive: true });
}
console.log(`✅ 已复制 Excalidraw 字体资源: ${source}`);

