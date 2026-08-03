import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) args.set(arg, process.argv[i + 1]);
}

function isPluginDirectory(name) {
  const dir = join(root, name);
  if (!existsSync(join(dir, 'package.json')) || !existsSync(join(dir, 'manifest.json'))) {
    return false;
  }

  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  return manifest.publish !== false;
}

function allPlugins() {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.') && /^[a-z][a-z0-9-]*$/.test(name))
    .filter(isPluginDirectory)
    .sort();
}

function changedFiles(from, to) {
  return execFileSync('git', ['diff', '--name-only', `${from}...${to}`], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

const plugins = allPlugins();
let selected = plugins;

if (!args.has('--all')) {
  const from = args.get('--from');
  const to = args.get('--to') || 'HEAD';

  if (from) {
    const changed = new Set(
      changedFiles(from, to)
        .map((file) => file.split('/')[0])
        .filter(Boolean),
    );
    selected = plugins.filter((plugin) => changed.has(plugin));
  }
}

process.stdout.write(JSON.stringify({ plugin: selected }));
