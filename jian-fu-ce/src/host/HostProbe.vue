<script setup lang="ts">
import { database, files, type Result } from '@luzenrocy/treasure-sdk';
import { onMounted, onUnmounted, ref } from 'vue';

const results = ref<string[]>([]);
const busy = ref(false);
const encoder = new TextEncoder();
const sample = '缄符册宿主验证资料\n';

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

function visibility() {
  results.value.push(`页面可见性 ${document.visibilityState}`);
}

onMounted(() => document.addEventListener('visibilitychange', visibility));
onUnmounted(() => document.removeEventListener('visibilitychange', visibility));

async function run(name: string, probe: () => Promise<void>) {
  busy.value = true;
  try {
    await probe();
    results.value.push(`${name}通过`);
  } catch (error) {
    results.value.push(`${name}失败 · ${error instanceof Error ? error.message : 'UNKNOWN'}`);
  } finally {
    busy.value = false;
  }
}

async function checkCrypto() {
  if (!window.isSecureContext || !crypto.subtle) throw new Error('WEB_CRYPTO_UNAVAILABLE');
  const material = await crypto.subtle.importKey('raw', encoder.encode(sample), 'PBKDF2', false, ['deriveKey']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(sample));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  if (new TextDecoder().decode(plain) !== sample) throw new Error('ROUND_TRIP');
}

async function checkDatabase() {
  const vaultId = crypto.randomUUID();
  const staged = (id: string, state: string) => ({
    sql: `INSERT INTO vault_entries (vault_id, entry_id, entry_revision, envelope)
          SELECT ?, ?, ?, ? WHERE EXISTS (
            SELECT 1 FROM vault_sets WHERE vault_id = ? AND state = ?
          )`,
    tables: ['vault_entries', 'vault_sets'],
    params: [vaultId, id, 'test-revision', 'synthetic', vaultId, state],
  });
  unwrap(await database.execute({
    sql: 'INSERT INTO vault_sets (vault_id, format_version, salt, kdf_iterations, verifier_envelope, state) VALUES (?, ?, ?, ?, ?, ?)',
    tables: ['vault_sets'],
    params: [vaultId, 1, 'synthetic', 600_000, 'synthetic', 'staging'],
  }));
  try {
    const counts = unwrap(await database.transaction([staged('skip', 'ready'), staged('keep', 'staging')]));
    if (counts.length !== 2 || counts[0].affectedRows !== 0 || counts[1].affectedRows !== 1) {
      throw new Error('AFFECTED_ROWS');
    }
    const rollback = await database.transaction([staged('rollback', 'staging'), staged('keep', 'staging')]);
    if (rollback.ok) throw new Error('EXPECTED_CONSTRAINT_FAILURE');
    const { rows } = unwrap(await database.query<{ entry_id: string }>({
      sql: 'SELECT entry_id FROM vault_entries WHERE vault_id = ? ORDER BY entry_id',
      tables: ['vault_entries'],
      params: [vaultId],
    }));
    if (rows.length !== 1 || rows[0].entry_id !== 'keep') throw new Error('ROLLBACK');
  } finally {
    unwrap(await database.transaction([
      { sql: 'DELETE FROM vault_entries WHERE vault_id = ?', tables: ['vault_entries'], params: [vaultId] },
      { sql: 'DELETE FROM vault_sets WHERE vault_id = ?', tables: ['vault_sets'], params: [vaultId] },
    ]));
  }
}

async function writeFile() {
  const selected = unwrap(await files.openDialog({ kind: 'directory', multiple: false, title: '选择临时测试目录' }));
  if (Array.isArray(selected)) throw new Error('DIRECTORY_REFERENCE');
  const name = `缄符册宿主探测-${crypto.randomUUID().slice(0, 8)}.txt`;
  unwrap(await files.writeFile({ directory: selected, fileName: name, data: encoder.encode(sample) }));
  results.value.push(`测试文件 ${name}`);
}

async function readFile() {
  const selected = unwrap(await files.openDialog({ kind: 'file', multiple: false, title: '选择刚写入的测试文件' }));
  if (!Array.isArray(selected) || selected.length !== 1) throw new Error('FILE_REFERENCE');
  const value = unwrap(await files.readFile(selected[0]));
  if (new TextDecoder().decode(value) !== sample) throw new Error('FILE_CONTENT');
}
</script>

<template>
  <main>
    <h1>缄符册宿主探测</h1>
    <button :disabled="busy" @click="run('Web Crypto', checkCrypto)">验证 Web Crypto</button>
    <button :disabled="busy" @click="run('数据库事务', checkDatabase)">验证数据库事务</button>
    <button :disabled="busy" @click="run('文件写入', writeFile)">写入测试文件</button>
    <button :disabled="busy" @click="run('文件读取', readFile)">读取测试文件</button>
    <ol role="status"><li v-for="(result, i) in results" :key="i">{{ result }}</li></ol>
  </main>
</template>

<style scoped>
main { padding: 24px; font: 15px/1.5 system-ui, sans-serif; }
button { margin: 0 8px 8px 0; }
</style>
