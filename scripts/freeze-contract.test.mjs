import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

for (const file of [
  'treasure-plugin/vite.config.ts',
  'shi-yu-lu/vite.config.ts',
  'kao-cheng-ce/vite.config.ts',
]) {
  const source = readFileSync(resolve(root, file), 'utf8');
  assert.match(source, /manifest\._frozen/,
    `${file} must freeze a new plugin identity when its dev server starts`);
  assert.match(source, /treasure-plugin-code/,
    `${file} must synchronize the page identity with manifest.name`);
}

for (const file of [
  'treasure-plugin/scripts/build-plugin.mjs',
  'shi-yu-lu/scripts/build-plugin.mjs',
  'kao-cheng-ce/scripts/build-plugin.mjs',
]) {
  const source = readFileSync(resolve(root, file), 'utf8');
  assert.match(source, /freezePluginCode/,
    `${file} must freeze an unfrozen plugin before packaging`);
  assert.match(source, /frozenManifest|freezePluginCode\(manifest/,
    `${file} must package the frozen manifest identity`);
  assert.match(source, /syncPluginCodeInHtml/,
    `${file} must synchronize the source page identity when packaging first`);
}

for (const file of [
  'treasure-plugin/manifest.json',
  'shi-yu-lu/manifest.json',
  'kao-cheng-ce/manifest.json',
]) {
  const manifest = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  assert.equal(manifest._frozen, true, `${file} must retain its established plugin identity`);
}
