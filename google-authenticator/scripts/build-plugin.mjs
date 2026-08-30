import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageName = basename(root);
const outputRoot = join(root, 'build-output');
const output = join(outputRoot, packageName);
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html 不存在，请先运行 npm run build');
rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
cpSync(dist, output, { recursive: true }); cpSync(join(root, 'scripts'), join(output, 'scripts'), { recursive: true }); cpSync(join(root, 'public'), join(output, 'public'), { recursive: true });
writeFileSync(join(output, 'manifest.json'), readFileSync(join(root, 'manifest.json')));
if (process.argv.includes('--zip')) { const zip = join(outputRoot, `${packageName}.zip`); rmSync(zip, { force: true }); execFileSync('zip', ['-r', zip, packageName], { cwd: outputRoot, stdio: 'inherit' }); }
console.log(`插件包已生成：${output}`);
