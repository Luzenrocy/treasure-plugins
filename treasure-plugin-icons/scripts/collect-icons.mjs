import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../');
const outDir = join(repoRoot, 'treasure-plugin-icons', 'public', 'icons');
const outManifest = join(repoRoot, 'treasure-plugin-icons', 'public', 'icons.json');

const manifestOf = (name) =>
  JSON.parse(readFileSync(join(repoRoot, name, 'manifest.json'), 'utf8'));

function isPluginDirectory(name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return false;
  const dir = join(repoRoot, name);
  if (!existsSync(join(dir, 'package.json')) || !existsSync(join(dir, 'manifest.json'))) {
    return false;
  }
  return manifestOf(name).publish !== false;
}

function pluginItem(name) {
  const manifest = manifestOf(name);
  const iconName = typeof manifest.icon === 'string' && manifest.icon !== '' ? manifest.icon : 'icon.svg';
  const sourcePath = join(repoRoot, name, 'public', iconName);
  if (!existsSync(sourcePath)) {
    console.warn(`[collect] skip ${name}: icon not found at public/${iconName}`);
    return null;
  }
  return {
    code: name,
    name: manifest.name ?? name,
    alias: manifest.alias ?? name,
    version: manifest.version ?? '0.0.0',
    sourcePath,
    ext: extname(iconName) || '.svg',
  };
}

const plugins = (await readdir(repoRoot, { withFileTypes: true }))
  .filter((entry) => entry.name !== 'treasure-plugin-icons')
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .filter(isPluginDirectory)
  .sort();

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const icons = [];
for (const name of plugins) {
  const item = pluginItem(name);
  if (!item) continue;
  const fileName = `${item.code}${item.ext}`;
  await copyFile(item.sourcePath, join(outDir, fileName));
  icons.push({
    code: item.code,
    name: item.name,
    alias: item.alias,
    version: item.version,
    url: `/icons/${fileName}`,
  });
}

if (icons.length === 0) {
  console.error('[collect] no icons collected, aborting');
  process.exit(1);
}

const payload = {
  generatedAt: new Date().toISOString(),
  count: icons.length,
  icons,
};
await writeFile(outManifest, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`[collect] collected ${icons.length} icons -> ${outDir}`);
for (const i of icons) console.log(`[collect]   ${i.url} (${i.alias} v${i.version})`);