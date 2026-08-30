<template>
  <main class="auth-app">
    <section v-if="booting" class="gate"><p>正在打开本地保险库…</p></section>

    <section v-else-if="!unlocked" class="gate">
      <div class="gate-card">
        <div class="brand-mark">G</div>
        <h1>谷歌验证器</h1>
        <p>{{ hasExistingVault ? '输入主密码以解锁本地保险库。' : '设置主密码后，账号密钥将以 AES-GCM 加密并仅保存在本机 Treasure 私有存储中。' }}</p>
        <form @submit.prevent="unlockOrCreate">
          <label>主密码<input v-model="password" type="password" minlength="8" required autocomplete="current-password" /></label>
          <label v-if="!hasExistingVault">确认主密码<input v-model="passwordConfirmation" type="password" minlength="8" required autocomplete="new-password" /></label>
          <button class="primary" :disabled="busy">{{ hasExistingVault ? '解锁保险库' : '创建加密保险库' }}</button>
        </form>
      </div>
    </section>

    <template v-else>
      <header class="topbar">
        <div class="brand"><span class="brand-mark">G</span><span>谷歌验证器</span></div>
        <div class="top-actions">
          <button @click="importQrImage" :disabled="busy">导入二维码图片</button>
          <button @click="importBackup" :disabled="busy">导入加密备份</button>
          <button @click="exportBackup" :disabled="busy">导出加密备份</button>
          <button class="primary" @click="openCreate">＋ 新增账号</button>
        </div>
      </header>

      <div class="layout">
        <aside class="sidebar">
          <p class="side-title">账号类型</p>
          <button :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">全部 <span>{{ vault.accounts.length }}</span></button>
          <button :class="{ active: typeFilter === 'totp' }" @click="typeFilter = 'totp'">TOTP <span>{{ totalByType('totp') }}</span></button>
          <button :class="{ active: typeFilter === 'hotp' }" @click="typeFilter = 'hotp'">HOTP <span>{{ totalByType('hotp') }}</span></button>
          <div class="side-divider" aria-hidden="true"></div>
          <p class="side-title">发行方</p>
          <button :class="{ active: providerFilter === 'all' }" @click="providerFilter = 'all'">全部服务商</button>
          <button v-for="provider in providers" :key="provider.name" :class="{ active: providerFilter === provider.name }" @click="providerFilter = provider.name">{{ provider.name }} <span>{{ provider.count }}</span></button>
          <div class="side-note">TOTP 按共享时钟自动更新<br />HOTP 每次生成后推进计数器</div>
        </aside>

        <section class="workspace">
          <div class="workspace-head"><div><h2>全部账号</h2><p>按发行方聚合；窗口变宽时服务商卡片会自动增加列数。</p></div><button class="lock" @click="lock">锁定</button></div>
          <div v-if="groups.length" class="masonry"><div class="masonry-columns">
            <section v-for="group in groups" :key="group.issuer" class="issuer-card">
              <header class="issuer-head"><div><span class="issuer-icon">{{ group.issuer.slice(0, 2).toUpperCase() }}</span><strong>{{ group.issuer }}</strong></div><span>{{ group.accounts.length }} 个账号</span></header>
              <button v-for="account in group.accounts" :key="account.id" class="account-row" :class="{ selected: selected?.id === account.id }" @click="select(account)">
                <span class="account-name">{{ account.name }}</span>
                <span class="account-actions">
                  <span class="type" :class="account.type">{{ account.type.toUpperCase() }}</span>
                  <span v-if="account.type === 'totp'" class="countdown-ring" :class="{ urgent: accountRemaining(account) <= 5 }" :style="countdownStyle(account)" role="img" :aria-label="`验证码将在 ${accountRemaining(account)} 秒后更新`"></span>
                  <span v-else class="ticker">#{{ account.counter }}</span>
                  <strong class="code" :style="account.type === 'totp' ? { color: timerColor(account) } : undefined">{{ displayCode(account) }}</strong>
                  <span class="row-action" @click.stop="account.type === 'totp' ? copyCode(account) : generateNext(account)">{{ account.type === 'totp' ? '复制' : '生成' }}</span>
                </span>
              </button>
            </section>
          </div></div>
          <div v-else class="empty"><strong>还没有账号</strong><span>导入 Google Authenticator 转移二维码图片，或手动新增一个账号。</span></div>
        </section>

        <div v-if="selected" class="drawer-overlay" @click.self="selected = null"><aside class="drawer">
          <button class="drawer-close" @click="selected = null">×</button>
          <p class="drawer-kicker">{{ selected.issuer || '未标记发行方' }} · {{ selected.type.toUpperCase() }}</p>
          <h3>{{ selected.name }}</h3>
          <div class="drawer-code">{{ displayCode(selected) }}</div>
          <p v-if="selected.type === 'totp'" class="drawer-caption"><span class="countdown-ring" :class="{ urgent: accountRemaining(selected) <= 5 }" :style="countdownStyle(selected)" role="img" :aria-label="`验证码将在 ${accountRemaining(selected)} 秒后更新`"></span><span>验证码会按周期自动更新</span></p>
          <p v-else class="drawer-caption">下次生成将使用计数器 {{ selected.counter }}</p>
          <dl><div><dt>算法</dt><dd>{{ selected.algorithm }}</dd></div><div><dt>{{ selected.type === 'totp' ? '周期' : '计数器' }}</dt><dd>{{ selected.type === 'totp' ? `${selected.period} 秒` : selected.counter }}</dd></div><div><dt>位数</dt><dd>{{ selected.digits }} 位</dd></div></dl>
          <div class="drawer-actions"><button class="edit" @click="openEdit">编辑账号</button><button class="danger" @click="removeSelected">删除此账号</button></div>
        </aside></div>
      </div>
    </template>

    <div v-if="manualOpen" class="modal-backdrop" @click.self="closeManual"><form class="modal" @submit.prevent="saveManual"><header><h3>{{ editingId ? '编辑账号' : '新增账号' }}</h3><button type="button" @click="closeManual">×</button></header><label>发行方<input v-model.trim="manual.issuer" placeholder="GitHub" /></label><label>账号标识<input v-model.trim="manual.name" placeholder="name@example.com" required /></label><label>Base32 密钥<input v-model.trim="manual.secret" placeholder="JBSWY3DPEHPK3PXP" required /></label><label>账号类型<select v-model="manual.type"><option value="totp">TOTP（默认）</option><option value="hotp">HOTP</option></select></label><label>算法<select v-model="manual.algorithm"><option value="SHA1">SHA-1</option><option value="SHA256">SHA-256</option><option value="SHA512">SHA-512</option></select></label><label>验证码位数<select v-model.number="manual.digits"><option :value="6">6 位</option><option :value="8">8 位</option></select></label><label v-if="manual.type === 'totp'">周期（秒）<input v-model.number="manual.period" type="number" min="1" /></label><label v-else>初始计数器<input v-model.number="manual.counter" type="number" min="0" /></label><button class="primary" :disabled="busy">保存账号</button></form></div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { files } from 'treasure-sdk';
import { parseGoogleMigrationPayload, parseOtpAuthUri, type AccountType, type ImportedAccount, type MigrationPayload } from './lib/migration';
import { decodeQrImage } from './lib/qr-image';
import { formatOtp, generateTotp, getTotpProgress, getTotpRemainingSeconds, normalizeBase32 } from './lib/otp';
import { decodeEncryptedVault, decryptVault, encodeEncryptedVault, encryptVault, makeVaultAccount, nextHotp, removeVaultAccount, updateVaultAccount, type Vault, type VaultAccount } from './lib/vault';
import { hasVault, loadVault, saveVault } from './lib/vault-repository';

const vault = ref<Vault>({ version: 1, accounts: [] });
const booting = ref(true); const unlocked = ref(false); const hasExistingVault = ref(false); const busy = ref(false);
const password = ref(''); const passwordConfirmation = ref('');
const selected = ref<VaultAccount | null>(null); const typeFilter = ref<'all' | AccountType>('all'); const providerFilter = ref('all');
const clock = ref(Date.now()); const codes = ref<Record<string, string>>({}); const hotpCodes = ref<Record<string, string>>({});
const manualOpen = ref(false); const editingId = ref<string | null>(null);
const manual = reactive({ issuer: '', name: '', secret: '', type: 'totp' as AccountType, counter: 0, algorithm: 'SHA1' as ImportedAccount['algorithm'], digits: 6 as ImportedAccount['digits'], period: 30 });
let masterPassword = ''; let tickId = 0; let persistChain = Promise.resolve();

const providers = computed(() => Object.entries(vault.value.accounts.reduce<Record<string, number>>((all, account) => { const key = account.issuer || '未标记发行方'; all[key] = (all[key] ?? 0) + 1; return all; }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)));
const groups = computed(() => {
  const grouped = new Map<string, VaultAccount[]>();
  vault.value.accounts.filter(account => (typeFilter.value === 'all' || account.type === typeFilter.value) && (providerFilter.value === 'all' || (account.issuer || '未标记发行方') === providerFilter.value)).forEach(account => {
    const issuer = account.issuer || '未标记发行方'; grouped.set(issuer, [...(grouped.get(issuer) ?? []), account]);
  });
  return [...grouped.entries()].map(([issuer, accounts]) => ({ issuer, accounts }));
});

function totalByType(type: AccountType) { return vault.value.accounts.filter(account => account.type === type).length; }
function displayCode(account: VaultAccount) { return account.type === 'totp' ? (codes.value[account.id] ?? '··· ···') : (hotpCodes.value[account.id] ?? '尚未生成'); }
function accountRemaining(account: VaultAccount) { return getTotpRemainingSeconds(clock.value, account.period); }
function timerColor(account: VaultAccount) { return accountRemaining(account) <= 5 ? '#c74444' : '#7656a7'; }
function countdownStyle(account: VaultAccount) { const progress = getTotpProgress(clock.value, account.period) * 100; return { '--timer-progress': `${progress}%`, '--timer-color': timerColor(account), background: `conic-gradient(from 0deg at 50% 50%, #e4dacb 0 ${100 - progress}%, var(--timer-color) ${100 - progress}% 100%)` }; }
function select(account: VaultAccount) { selected.value = account; }
function success(message: string) { ElMessage.success(message); }
function fail(reason: unknown) { ElMessage.error(reason instanceof Error ? reason.message : '操作未完成'); }

async function refreshTotp() {
  clock.value = Date.now();
  const next: Record<string, string> = {};
  await Promise.all(vault.value.accounts.filter(account => account.type === 'totp').map(async account => { next[account.id] = formatOtp(await generateTotp(account.secret, clock.value, account.period, account.digits, account.algorithm)); }));
  codes.value = next;
}
function scheduleTick() { refreshTotp().catch(fail); tickId = window.setTimeout(scheduleTick, 1000 - (Date.now() % 1000) + 8); }

async function unlockOrCreate() {
  if (!hasExistingVault.value && password.value !== passwordConfirmation.value) { ElMessage.warning('两次输入的主密码不一致'); return; }
  busy.value = true;
  try {
    vault.value = hasExistingVault.value ? await loadVault(password.value) : { version: 1, accounts: [] };
    if (!hasExistingVault.value) await saveVault(password.value, vault.value);
    masterPassword = password.value; password.value = ''; passwordConfirmation.value = ''; unlocked.value = true; await refreshTotp();
  } catch (reason) { fail(reason); } finally { busy.value = false; }
}
function lock() { masterPassword = ''; vault.value = { version: 1, accounts: [] }; codes.value = {}; hotpCodes.value = {}; selected.value = null; unlocked.value = false; ElMessage.info('已锁定；切回页面后请输入主密码。'); }
async function queueVaultWrite<T>(operation: () => Promise<T>): Promise<T> { const queued = persistChain.then(operation); persistChain = queued.then(() => undefined, () => undefined); return queued; }
async function persist(next: Vault) { await queueVaultWrite(async () => { await saveVault(masterPassword, next); vault.value = next; }); }
async function addAccounts(imported: ImportedAccount[]) { const known = new Set(vault.value.accounts.map(account => `${account.issuer}\u0000${account.name}\u0000${account.secret}`)); const unique = imported.filter(account => { const key = `${account.issuer}\u0000${account.name}\u0000${account.secret}`; if (known.has(key)) return false; known.add(key); return true; }); if (!unique.length) { ElMessage.info('未导入账号：所有项目均已存在。'); return; } const next = { version: 1 as const, accounts: [...vault.value.accounts, ...unique.map(makeVaultAccount)] }; await persist(next); success(`已安全导入 ${unique.length} 个账号${unique.length === imported.length ? '。' : '，已跳过重复项。'}`); await refreshTotp(); }
function validateMigrationBatches(payloads: MigrationPayload[]) { const multi = payloads.filter(payload => payload.batch.size > 1); if (!multi.length) return; const expected = multi[0].batch; const indexes = new Set(multi.map(payload => payload.batch.index)); if (multi.some(payload => payload.batch.size !== expected.size || payload.batch.id !== expected.id) || indexes.size !== expected.size || ![...indexes].every(index => index >= 0 && index < expected.size)) throw new Error(`Google 转移二维码尚不完整：需要同一批的 ${expected.size} 张图片。`); }

async function importQrImage() {
  busy.value = true;
  try { const selectedFile = await files.openDialog({ kind: 'file', multiple: true, title: '选择含二维码的图片', filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] }); if (!selectedFile.ok) return; if (!Array.isArray(selectedFile.value) || !selectedFile.value.length) throw new Error('未选择图片'); const imported: ImportedAccount[] = []; const payloads: MigrationPayload[] = []; for (const file of selectedFile.value) { const bytes = await files.readFile(file); if (!bytes.ok) throw new Error(bytes.error.message); const uri = await decodeQrImage(bytes.value); if (uri.startsWith('otpauth-migration:')) { const payload = parseGoogleMigrationPayload(uri); payloads.push(payload); imported.push(...payload.accounts); } else imported.push(parseOtpAuthUri(uri)); } validateMigrationBatches(payloads); await addAccounts(imported); } catch (reason) { fail(reason); } finally { busy.value = false; }
}
async function importBackup() {
  busy.value = true; try { const selectedFile = await files.openDialog({ kind: 'file', multiple: false, title: '导入加密备份', filters: [{ name: '谷歌验证器备份', extensions: ['json'] }] }); if (!selectedFile.ok) return; if (!Array.isArray(selectedFile.value) || !selectedFile.value[0]) throw new Error('未选择备份文件'); const bytes = await files.readFile(selectedFile.value[0]); if (!bytes.ok) throw new Error(bytes.error.message); const restored = await decryptVault(masterPassword, decodeEncryptedVault(bytes.value)); await persist(restored); await refreshTotp(); success(`已恢复 ${restored.accounts.length} 个账号。`); } catch (reason) { fail(reason); } finally { busy.value = false; }
}
async function exportBackup() {
  busy.value = true; try { const target = await files.saveDialog({ title: '导出加密备份', defaultFileName: `google-authenticator-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: '谷歌验证器备份', extensions: ['json'] }] }); if (!target.ok) return; const backup = await encryptVault(masterPassword, vault.value); const written = await files.writeFile({ file: target.value, data: encodeEncryptedVault(backup) }); if (!written.ok) throw new Error(written.error.message); success('已导出加密备份。'); } catch (reason) { fail(reason); } finally { busy.value = false; }
}
async function copyCode(account: VaultAccount) { const code = displayCode(account).replace(/\s/g, ''); if (!/^\d{6,8}$/.test(code)) return; try { await navigator.clipboard.writeText(code); success(`${account.name} 的验证码已复制。`); } catch { fail(new Error('无法访问系统剪贴板')); } }
async function generateNext(account: VaultAccount) { busy.value = true; try { const result = await queueVaultWrite(async () => { const current = vault.value.accounts.find(item => item.id === account.id); if (!current) throw new Error('账号已不存在'); const advanced = await nextHotp(current); const next = { version: 1 as const, accounts: vault.value.accounts.map(item => item.id === current.id ? advanced.account : item) }; await saveVault(masterPassword, next); vault.value = next; return advanced; }); hotpCodes.value = { ...hotpCodes.value, [account.id]: formatOtp(result.code) }; if (selected.value?.id === account.id) selected.value = result.account; } catch (reason) { fail(reason); } finally { busy.value = false; } }
async function removeSelected() { if (!selected.value) return; const account = selected.value; try { await ElMessageBox.confirm(`确定删除“${account.name}”吗？此操作会从本地加密保险库移除该账号。`, '删除账号', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }); } catch { return; } try { await persist({ version: 1, accounts: removeVaultAccount(vault.value.accounts, account.id) }); selected.value = null; await refreshTotp(); success('账号已删除。'); } catch (reason) { fail(reason); } }
function resetManual() { Object.assign(manual, { issuer: '', name: '', secret: '', type: 'totp', counter: 0, algorithm: 'SHA1', digits: 6, period: 30 }); }
function closeManual() { manualOpen.value = false; editingId.value = null; resetManual(); }
function openCreate() { editingId.value = null; resetManual(); manualOpen.value = true; }
function openEdit() { if (!selected.value) return; const account = selected.value; editingId.value = account.id; Object.assign(manual, { issuer: account.issuer, name: account.name, secret: account.secret, type: account.type, counter: account.counter, algorithm: account.algorithm, digits: account.digits, period: account.period }); selected.value = null; manualOpen.value = true; }
async function saveManual() { try { const imported: ImportedAccount = { issuer: manual.issuer, name: manual.name, secret: normalizeBase32(manual.secret), type: manual.type, counter: Number(manual.counter) || 0, algorithm: manual.algorithm, digits: manual.digits, period: Number(manual.period) || 30 }; if (!imported.secret) throw new Error('请输入有效的 Base32 密钥'); if (!editingId.value) { await addAccounts([imported]); closeManual(); return; } const current = vault.value.accounts.find(account => account.id === editingId.value); if (!current) throw new Error('要编辑的账号已不存在'); const duplicate = vault.value.accounts.some(account => account.id !== current.id && account.issuer === imported.issuer && account.name === imported.name && account.secret === imported.secret); if (duplicate) throw new Error('已存在相同的账号'); const updated = updateVaultAccount(current, imported); await persist({ version: 1, accounts: vault.value.accounts.map(account => account.id === current.id ? updated : account) }); selected.value = updated; await refreshTotp(); success('账号已更新。'); closeManual(); } catch (reason) { fail(reason); } }

onMounted(async () => { try { hasExistingVault.value = await hasVault(); } catch (reason) { fail(reason); } finally { booting.value = false; } document.addEventListener('visibilitychange', () => { if (document.hidden && unlocked.value) lock(); }); scheduleTick(); });
onBeforeUnmount(() => { window.clearTimeout(tickId); masterPassword = ''; });
</script>

<style>
:root{font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif;color:#3d3450;background:#f5efe4}*{box-sizing:border-box}button,input,select{font:inherit}button{border:0;cursor:pointer}button:disabled{cursor:wait;opacity:.6}.auth-app{min-height:100vh;background:#f5efe4}.topbar{height:68px;align-items:center;border-bottom:1px solid #e8c98a;display:flex;justify-content:space-between;padding:0 26px}.brand{align-items:center;display:flex;font-size:17px;font-weight:780;gap:10px}.brand-mark{align-items:center;background:#3d3450;border-radius:9px;color:#e8c98a;display:inline-flex;font-weight:900;height:32px;justify-content:center;width:32px}.top-actions{display:flex;gap:8px}.top-actions button,.lock{background:#ece3d3;border:1px solid #dfd0ba;border-radius:8px;color:#3d3450;font-size:12px;font-weight:700;padding:8px 11px}.top-actions .primary,.primary{background:#7656a7;border-color:#7656a7;color:#fff}.layout{display:grid;grid-template-columns:164px minmax(0,1fr);min-height:calc(100vh - 68px);position:relative}.sidebar{background:#efe6da;border-right:1px solid #e3d6c2;padding:20px 12px}.side-title{color:#897d8d;font-size:10px;font-weight:850;letter-spacing:.08em;margin:5px 9px 8px}.side-divider{border-top:1px solid #dacdbb;margin:18px 11px 14px}.sidebar button{background:transparent;border-radius:8px;color:#665b6d;display:flex;font-size:13px;justify-content:space-between;margin:2px 0;padding:9px 10px;text-align:left;width:100%}.sidebar button.active{background:#e8c98a;color:#3d3450;font-weight:780}.side-note{border-top:1px solid #dacdbb;color:#766b7b;font-size:11px;line-height:1.6;margin:18px 5px;padding:14px 4px}.workspace{min-width:0;padding:24px 30px}.workspace-head{align-items:end;display:flex;justify-content:space-between;margin-bottom:16px}.workspace h2{font-size:22px;margin:0}.workspace-head p{color:#766b7b;font-size:12px;margin:5px 0 0}.notice,.error{border-radius:8px;font-size:12px;margin:0 0 12px;padding:9px 11px}.notice{background:#f8edcf;color:#75531e}.error{background:#f6dddd;color:#9f4545}.masonry{column-gap:16px;columns:300px}.issuer-card{background:#fffaf2;border:1px solid #e8c98a;border-radius:13px;break-inside:avoid;display:inline-block;margin:0 0 16px;overflow:hidden;width:100%}.issuer-head{align-items:center;background:#ece3d3;border-bottom:1px solid #e8c98a;display:flex;justify-content:space-between;padding:11px 13px}.issuer-head>div{align-items:center;display:flex;gap:8px}.issuer-head strong{font-size:14px}.issuer-head>span{color:#766b7b;font-size:11px}.issuer-icon{align-items:center;background:#e8c98a;border-radius:7px;color:#3d3450;display:inline-flex;font-size:10px;font-weight:900;height:25px;justify-content:center;width:25px}.account-row{background:transparent;border-bottom:1px solid #e9decd;color:#3d3450;display:block;padding:10px 13px;text-align:left;width:100%}.account-row:last-child{border-bottom:0}.account-row.selected{background:#f7f0fa;box-shadow:inset 3px 0 #7656a7}.account-name{display:block;font-size:13px;font-weight:730;line-height:1.25;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account-actions{align-items:center;display:grid;gap:6px;grid-template-columns:auto 32px minmax(58px,1fr) 40px}.type{border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.08em;padding:4px 7px}.type.totp{background:#f7f2fa;color:#7656a7}.type.hotp{background:#fff8e8;color:#97712b}.ticker{color:#766b7b;font-family:ui-monospace,monospace;font-size:11px}.code{font-family:"SF Mono",ui-monospace,monospace;font-size:14px;letter-spacing:.05em;text-align:right}.row-action{border:1px solid #d9cebd;border-radius:7px;font-size:10px;font-weight:750;padding:6px 2px;text-align:center}.empty{align-items:center;background:#fffaf2;border:1px dashed #d9c8b1;border-radius:13px;color:#766b7b;display:flex;flex-direction:column;gap:5px;justify-content:center;min-height:220px}.empty strong{color:#3d3450}.drawer{background:#f5efe4;border-left:1px solid #e8c98a;box-shadow:-16px 0 35px rgba(61,52,80,.14);padding:24px 18px;position:absolute;right:0;top:0;width:292px;z-index:2}.drawer-close{background:#ece3d3;border:1px solid #d9cebd;border-radius:8px;color:#3d3450;float:right;font-size:18px;height:30px;width:30px}.drawer-kicker{color:#766b7b;font-size:10px;font-weight:850;letter-spacing:.08em;margin:4px 0 8px}.drawer h3{font-size:18px;margin:0}.drawer-code{background:#ece3d3;border:1px solid #e8c98a;border-radius:10px;font-family:"SF Mono",ui-monospace,monospace;font-size:23px;font-weight:850;letter-spacing:.08em;margin-top:22px;padding:15px 8px;text-align:center}.drawer-caption{color:#766b7b;font-size:11px;text-align:center}.drawer dl{border-top:1px solid #e8c98a;margin-top:18px;padding-top:12px}.drawer dl div{display:flex;font-size:12px;justify-content:space-between;margin:10px 0}.drawer dt{color:#766b7b}.drawer dd{font-weight:700;margin:0}.danger{background:#f6dddd;border-radius:8px;color:#9f4545;font-size:12px;font-weight:750;margin-top:12px;padding:9px;width:100%}.gate{align-items:center;display:flex;justify-content:center;min-height:100vh;padding:24px}.gate-card{background:#fffaf2;border:1px solid #e8c98a;border-radius:16px;max-width:410px;padding:30px;text-align:center;width:100%}.gate-card .brand-mark{font-size:16px}.gate h1{font-size:23px;margin:14px 0 7px}.gate p{color:#766b7b;font-size:13px;line-height:1.65}.gate form,.modal{display:grid;gap:12px;text-align:left}.gate label,.modal label{color:#665b6d;display:grid;font-size:12px;font-weight:700;gap:5px}.gate input,.modal input,.modal select{background:#fffaf2;border:1px solid #d9cebd;border-radius:8px;color:#3d3450;padding:9px}.gate .primary,.modal .primary{border-radius:8px;font-weight:760;padding:10px}.modal-backdrop{align-items:center;background:rgba(61,52,80,.25);display:flex;inset:0;justify-content:center;padding:20px;position:fixed;z-index:4}.modal{background:#f5efe4;border:1px solid #e8c98a;border-radius:14px;box-shadow:0 20px 50px rgba(61,52,80,.22);padding:20px;width:min(420px,100%)}.modal header{align-items:center;display:flex;justify-content:space-between}.modal h3{margin:0}.modal header button{background:transparent;color:#3d3450;font-size:22px}@media(max-width:740px){.topbar{height:auto;align-items:flex-start;flex-direction:column;gap:12px;padding:14px}.top-actions{flex-wrap:wrap}.layout{grid-template-columns:132px minmax(0,1fr)}.workspace{padding:18px}.workspace-head{align-items:flex-start;gap:10px;flex-direction:column}.drawer{width:min(292px,88vw)}.masonry{columns:1}.account-actions{grid-template-columns:auto 30px minmax(54px,1fr) 38px}}
</style>

<style>
.countdown-ring{background:conic-gradient(from 0deg at 50% 50%,#e4dacb 0 calc(100% - var(--timer-progress)),var(--timer-color) calc(100% - var(--timer-progress)) 100%)}
</style>

<style>
:root,html,body,#app{height:100%;margin:0;overflow:hidden}.auth-app{height:100%;min-height:0;overflow:hidden}.layout{height:calc(100% - 68px);min-height:0;overflow:hidden}.workspace{display:flex;flex-direction:column;min-height:0;overflow:hidden}.workspace-head,.notice,.error{flex-shrink:0}.masonry{column-gap:normal;columns:auto;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;padding-right:12px}.masonry-columns{column-gap:16px;columns:300px}.empty{flex:1;min-height:0}.masonry::-webkit-scrollbar,.drawer::-webkit-scrollbar{width:6px}.masonry::-webkit-scrollbar-track,.drawer::-webkit-scrollbar-track{background:transparent}.masonry::-webkit-scrollbar-thumb,.drawer::-webkit-scrollbar-thumb{background:#d3d7da;border-radius:3px}.drawer-overlay{background:rgba(122,96,77,.18);inset:0;position:fixed;z-index:20}.drawer{bottom:0;display:flex;flex-direction:column;overflow-y:auto;position:fixed;right:0;top:0;width:min(420px,92vw);z-index:21}.drawer-actions{display:grid;gap:8px;margin-top:auto;padding-top:22px}.drawer-actions .edit{background:#ece3d3;border:1px solid #d9cebd;border-radius:8px;color:#3d3450;font-size:12px;font-weight:750;padding:9px;width:100%}.drawer-actions .danger{margin-top:0}.delete-warning{background:#f6dddd;border-radius:8px;color:#9f4545;font-size:11px;line-height:1.5;margin:0;padding:9px}.delete-confirm-actions{display:grid;gap:8px;grid-template-columns:1fr 1fr}.delete-confirm-actions .danger{margin:0}@media(max-width:740px){.layout{height:calc(100% - 126px)}.masonry-columns{columns:1}}
:root,html,body,#app{height:100%;margin:0;overflow:hidden}.auth-app{height:100%;min-height:0;overflow:hidden}.layout{height:calc(100% - 68px);min-height:0;overflow:hidden}.workspace{display:flex;flex-direction:column;min-height:0;overflow:hidden}.workspace-head,.notice,.error{flex-shrink:0}.masonry{column-gap:normal;columns:auto;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;padding-right:12px}.masonry-columns{column-gap:16px;columns:300px}.empty{flex:1;min-height:0}.masonry::-webkit-scrollbar,.drawer::-webkit-scrollbar{width:6px}.masonry::-webkit-scrollbar-track,.drawer::-webkit-scrollbar-track{background:transparent}.masonry::-webkit-scrollbar-thumb,.drawer::-webkit-scrollbar-thumb{background:#d3d7da;border-radius:3px}.drawer-overlay{background:rgba(122,96,77,.18);inset:0;position:fixed;z-index:20}.drawer{bottom:0;display:flex;flex-direction:column;overflow-y:auto;position:fixed;right:0;top:0;width:min(420px,92vw);z-index:21}.drawer-actions{display:grid;gap:8px;margin-top:auto;padding-top:22px}.drawer-actions .edit{background:#ece3d3;border:1px solid #d9cebd;border-radius:8px;color:#3d3450;font-size:12px;font-weight:750;padding:9px;width:100%}.drawer-actions .danger{margin-top:0}.countdown-ring{--timer-progress:100%;--timer-color:#7656a7;background:conic-gradient(from 0deg at 50% 50%,var(--timer-color) 0 var(--timer-progress),#e4dacb var(--timer-progress) 100%);border-radius:50%;display:inline-block;height:20px;width:20px}.countdown-ring.urgent{--timer-color:#b9782d}.drawer-caption{align-items:center;display:flex;gap:7px;justify-content:center}.drawer-caption .countdown-ring{height:16px;width:16px}@media(max-width:740px){.layout{height:calc(100% - 126px)}.masonry-columns{columns:1}}
</style>
