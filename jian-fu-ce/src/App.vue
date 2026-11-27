<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import {
  Back, ChatLineSquare, Check, Close, Connection, CopyDocument, Document,
  EditPen, Files, Hide, Key, Lock, Plus, PriceTag, Search, Star, StarFilled, Ticket, View,
} from '@element-plus/icons-vue';
import brandIcon from '../icon.svg';
import { createVault, getState, unlock, writeEntry, type Session } from './repository/vault';
import { kinds, type Entry, type EntryKind } from './domain/entry';

const labels: Record<EntryKind, string> = { 'api-key': 'API Key', 'secret-key': '密钥', token: 'Token', password: '密码', prompt: '提示词', text: '文本' };
const kindIcons: Record<EntryKind, typeof Key> = {
  'api-key': Connection,
  'secret-key': Key,
  token: Ticket,
  password: Lock,
  prompt: ChatLineSquare,
  text: Document,
};
const updatedFormat: Intl.DateTimeFormatOptions = {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
};
const session = shallowRef<Session | null>(null);
const state = ref<'loading' | 'new' | 'locked' | 'open' | 'error'>('loading');
const password = ref('');
const confirmation = ref('');
const error = ref('');
const toast = ref('');
const busy = ref(false);
const filter = ref('all');
const search = ref('');
const selected = ref('');
const editor = ref(false);
const editing = ref('');
const tagInput = ref('');
const revealed = ref<'entry' | 'draft' | null>(null);
const entryRevealed = computed(() => revealed.value === 'entry');
const draftRevealed = computed(() => revealed.value === 'draft');
const mobileDetail = ref(false);
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
const draft = reactive<Entry>({ id: '', kind: 'api-key', title: '', value: '', account: '', tags: [], notes: '', favorite: false, createdAt: 0, updatedAt: 0 });
const records = computed(() => session.value?.entries ?? []);
const tags = computed(() => [...new Set(records.value.flatMap(item => item.entry.tags))]);
const filtered = computed(() => {
  const terms = search.value.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return records.value.filter(({ entry }) => {
    if (filter.value === 'favorites' && !entry.favorite) return false;
    if (filter.value.startsWith('tag:') && !entry.tags.includes(filter.value.slice(4))) return false;
    if (kinds.includes(filter.value as EntryKind) && entry.kind !== filter.value) return false;
    const fields = [entry.title, labels[entry.kind], entry.account, entry.notes, ...entry.tags];
    if (entry.kind === 'prompt' || entry.kind === 'text') fields.push(entry.value);
    const text = fields.join(' ').normalize('NFKC').toLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);
});
const current = computed(() => filtered.value.find(item => item.entry.id === selected.value) ?? filtered.value[0]);
const sensitive = computed(() => current.value && !['prompt', 'text'].includes(current.value.entry.kind));
watch([filter, search, selected, editor], hideValue);

function changeDraftKind(event: Event) {
  const next = (event.target as HTMLSelectElement).value as EntryKind;
  hideValue();
  if (next !== 'password') draft.account = '';
  if (!['prompt', 'text'].includes(draft.kind) && ['prompt', 'text'].includes(next)) draft.value = '';
  draft.kind = next;
}

function lock() {
  generation++;
  session.value = null;
  password.value = '';
  confirmation.value = '';
  editor.value = false;
  draft.value = '';
  hideValue();
  clearTimeout(idle);
  state.value = 'locked';
}
function resetIdle() {
  if (state.value !== 'open') return;
  clearTimeout(idle);
  idle = setTimeout(lock, 300_000);
}
function onVisibility() { if (document.hidden && state.value === 'open') lock(); }
function notify(message: string) { toast.value = message; setTimeout(() => { if (toast.value === message) toast.value = ''; }, 2000); }
async function initialize() {
  state.value = 'loading';
  try { state.value = await getState() ? 'locked' : 'new'; }
  catch { state.value = 'error'; error.value = '无法读取资料库，请检查宿主后重试。'; }
}
async function submitPassword() {
  error.value = '';
  if (state.value === 'new' && password.value !== confirmation.value) { error.value = '两次输入的主密码不一致'; return; }
  busy.value = true;
  const token = generation;
  try {
    if (state.value === 'new') await createVault(password.value);
    const loaded = await unlock(password.value);
    if (token !== generation) return;
    session.value = loaded;
    state.value = 'open';
    password.value = '';
    confirmation.value = '';
    resetIdle();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败';
    if (state.value === 'new') {
      try { if (await getState()) state.value = 'locked'; } catch { state.value = 'error'; }
    }
  }
  finally { busy.value = false; }
}
function edit(entry?: Entry) {
  editing.value = entry?.id ?? '';
  const now = Date.now();
  Object.assign(draft, entry ? { ...entry, tags: [...entry.tags] } : { id: crypto.randomUUID(), kind: kinds.includes(filter.value as EntryKind) ? filter.value : 'api-key', title: '', value: '', account: '', tags: [], notes: '', favorite: false, createdAt: now, updatedAt: now });
  tagInput.value = draft.tags.join('，');
  error.value = '';
  editor.value = true;
}
async function save() {
  if (!session.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const old = session.value.entries.find(item => item.entry.id === editing.value);
    const entry = { ...draft, title: draft.title.trim(), tags: [...new Set(tagInput.value.split(/[,，、]/).map(tag => tag.trim().replace(/^#+/, '')).filter(Boolean))], updatedAt: Date.now() };
    const token = generation;
    const result = await writeEntry(session.value, entry, old?.revision);
    if (token !== generation) return;
    session.value = result;
    selected.value = entry.id;
    filter.value = 'all';
    search.value = '';
    editor.value = false;
    draft.value = '';
    notify('条目已保存');
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '保存失败';
    lock();
    error.value = message + '，请重新解锁并检查条目。';
  }
  finally { busy.value = false; }
}
async function modify(remove = false) {
  if (!session.value || !current.value || busy.value) return;
  if (remove && !window.confirm('确定删除这条记录吗？')) return;
  busy.value = true;
  try {
    const item = current.value;
    const token = generation;
    const result = await writeEntry(session.value, { ...item.entry, favorite: !item.entry.favorite, updatedAt: Date.now() }, item.revision, remove);
    if (token !== generation) return;
    session.value = result;
    notify(remove ? '条目已删除' : '收藏已更新');
  } catch { lock(); error.value = '操作未确认，请重新解锁并检查条目。'; }
  finally { busy.value = false; }
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); notify('已复制'); }
  catch { error.value = '复制失败，请显示内容后手动复制'; }
}
function hideValue() {
  revealed.value = null;
  clearTimeout(timer);
}
function toggleReveal(scope: 'entry' | 'draft') {
  const show = revealed.value !== scope;
  hideValue();
  if (!show) return;
  revealed.value = scope;
  timer = setTimeout(hideValue, 15_000);
}
function checkRaw(event: ClipboardEvent | DragEvent) {
  const transfer = 'clipboardData' in event ? event.clipboardData : event.dataTransfer;
  if (!transfer || /[\r\n]/.test(transfer.getData('text'))) { event.preventDefault(); error.value = '凭据不能包含换行'; }
}
function keyboard(event: KeyboardEvent) {
  if (event.isComposing || editor.value || state.value !== 'open') return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('search')?.focus(); }
  if (document.activeElement?.id !== 'search') return;
  if (event.key === 'Escape') search.value = '';
  if (event.key === 'Enter' && current.value) { event.preventDefault(); void copy(current.value.entry.value); }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const index = filtered.value.findIndex(item => item.entry.id === current.value?.entry.id);
    const next = Math.max(0, Math.min(filtered.value.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    if (filtered.value[next]) selected.value = filtered.value[next].entry.id;
  }
}
onMounted(() => { void initialize(); document.addEventListener('visibilitychange', onVisibility); document.addEventListener('pointerdown', resetIdle); document.addEventListener('keydown', resetIdle); document.addEventListener('keydown', keyboard); });
onUnmounted(() => { document.removeEventListener('visibilitychange', onVisibility); document.removeEventListener('pointerdown', resetIdle); document.removeEventListener('keydown', resetIdle); document.removeEventListener('keydown', keyboard); lock(); });
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <img class="brand-icon" :src="brandIcon" width="40" height="40" alt="">
        <div><strong>缄符册</strong><small>Treasure 私密信息库</small></div>
      </div>
      <label v-if="state === 'open'" class="search">
        <Search class="icon" aria-hidden="true" />
        <input id="search" v-model="search" aria-label="搜索条目" placeholder="搜索标题、标签或备注">
        <kbd>⌘ K</kbd>
      </label>
      <div v-if="state === 'open'" class="top-actions">
        <button class="icon-btn" aria-label="锁定资料库" title="锁定资料库" @click="lock">
          <Lock class="icon" aria-hidden="true" />
        </button>
        <button class="primary" @click="edit()"><Plus class="icon" aria-hidden="true" />新建条目</button>
      </div>
    </header>

    <main v-if="state !== 'open'" class="lock-screen">
      <div class="lock-card">
        <span class="lock-icon"><Lock class="icon" aria-hidden="true" /></span>
        <h1>{{ state === 'new' ? '创建资料库' : state === 'error' ? '资料库不可用' : state === 'loading' ? '正在读取资料库' : '解锁缄符册' }}</h1>
        <p v-if="state === 'new'">设置主密码，保护你的资料。</p>
        <p v-else-if="state === 'locked'">输入主密码以查看你的资料。</p>
        <form v-if="state === 'new' || state === 'locked'" @submit.prevent="submitPassword">
          <label>主密码<input v-model="password" type="password" autocomplete="current-password" placeholder="至少 12 个字符" required></label>
          <label v-if="state === 'new'">确认主密码<input v-model="confirmation" type="password" autocomplete="new-password" required></label>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="primary wide" :disabled="busy">{{ busy ? '处理中…' : state === 'new' ? '创建资料库' : '解锁' }}</button>
        </form>
        <template v-if="state === 'error'">
          <p class="error">{{ error }}</p>
          <button class="primary" @click="initialize">重试</button>
        </template>
      </div>
    </main>

    <main v-else class="workspace" :class="{ 'show-detail': mobileDetail && current }">
      <nav class="rail" aria-label="资料库筛选">
        <div class="nav-group">
          <h2>资料库</h2>
          <button :aria-current="filter === 'all'" @click="filter = 'all'">
            <Files class="icon" aria-hidden="true" />
            <span>全部条目</span><small>{{ records.length }}</small>
          </button>
          <button :aria-current="filter === 'favorites'" @click="filter = 'favorites'">
            <Star class="icon" aria-hidden="true" />
            <span>收藏</span><small>{{ records.filter(item => item.entry.favorite).length }}</small>
          </button>
        </div>
        <div class="nav-group">
          <h2>类型</h2>
          <button v-for="kind in kinds" :key="kind" :data-kind="kind" :aria-current="filter === kind" @click="filter = kind">
            <component :is="kindIcons[kind]" class="icon" aria-hidden="true" />
            <span>{{ labels[kind] }}</span><small>{{ records.filter(item => item.entry.kind === kind).length }}</small>
          </button>
        </div>
        <div v-if="tags.length" class="nav-group">
          <h2>标签</h2>
          <button v-for="tag in tags" :key="tag" :aria-current="filter === 'tag:' + tag" @click="filter = 'tag:' + tag">
            <PriceTag class="icon" aria-hidden="true" />
            <span>{{ tag }}</span><small>{{ records.filter(item => item.entry.tags.includes(tag)).length }}</small>
          </button>
        </div>
      </nav>

      <section class="list" aria-labelledby="list-title">
        <select v-model="filter" class="mobile-filter" aria-label="筛选条目">
          <option value="all">全部条目</option>
          <option value="favorites">收藏</option>
          <option v-for="kind in kinds" :key="kind" :value="kind">{{ labels[kind] }}</option>
          <option v-for="tag in tags" :key="tag" :value="'tag:' + tag"># {{ tag }}</option>
        </select>
        <div class="list-title">
          <h2 id="list-title">{{ filter === 'all' ? '全部条目' : filter === 'favorites' ? '收藏' : filter.startsWith('tag:') ? '# ' + filter.slice(4) : labels[filter as EntryKind] }}</h2>
          <small aria-live="polite">{{ filtered.length }} 条</small>
        </div>
        <p v-if="!filtered.length" class="empty">{{ search ? '没有匹配的条目' : '这里还没有条目' }}</p>
        <ul v-else class="records">
          <li v-for="item in filtered" :key="item.entry.id" class="record" :class="{ chosen: current?.entry.id === item.entry.id }">
            <button class="record-main" :aria-current="current?.entry.id === item.entry.id" @click="selected = item.entry.id; mobileDetail = true">
              <span class="glyph" :data-kind="item.entry.kind">
                <component :is="kindIcons[item.entry.kind]" class="icon" aria-hidden="true" />
              </span>
              <span class="record-text">
                <strong>
                  <span>{{ item.entry.title }}</span>
                  <StarFilled v-if="item.entry.favorite" class="icon star" aria-label="已收藏" role="img" />
                </strong>
                <small>{{ labels[item.entry.kind] }}<template v-if="item.entry.tags[0]"> · {{ item.entry.tags[0] }}</template></small>
              </span>
            </button>
            <button class="icon-btn record-copy" aria-label="复制条目" title="复制条目" @click="copy(item.entry.value)">
              <CopyDocument class="icon" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <section class="details" aria-label="条目详情">
        <button class="back" @click="mobileDetail = false"><Back class="icon" aria-hidden="true" />返回列表</button>
        <template v-if="current">
          <div class="detail-head">
            <span class="glyph large" :data-kind="current.entry.kind">
              <component :is="kindIcons[current.entry.kind]" class="icon" aria-hidden="true" />
            </span>
            <div class="detail-actions">
              <button class="icon-btn" aria-label="收藏" :aria-pressed="current.entry.favorite" :title="current.entry.favorite ? '取消收藏' : '收藏'" @click="modify()">
                <component :is="current.entry.favorite ? StarFilled : Star" class="icon" :class="{ star: current.entry.favorite }" aria-hidden="true" />
              </button>
              <button class="outline" @click="edit(current.entry)"><EditPen class="icon" aria-hidden="true" />编辑</button>
            </div>
          </div>
          <h1>{{ current.entry.title }}</h1>
          <p class="detail-type">{{ labels[current.entry.kind] }}</p>
          <dl class="fields">
            <div v-if="current.entry.account">
              <dt>账号</dt>
              <dd>{{ current.entry.account }}</dd>
            </div>
            <div>
              <dt>{{ labels[current.entry.kind] }}</dt>
              <dd class="value" :class="{ multiline: !sensitive }">
                <span class="value-body" :class="{ masked: sensitive && !entryRevealed }">{{ sensitive && !entryRevealed ? '••••••••••••' : current.entry.value }}</span>
                <div class="value-actions">
                  <button v-if="sensitive" class="icon-btn" aria-label="显示内容" :aria-pressed="entryRevealed" :title="entryRevealed ? '隐藏内容' : '显示内容'" @click="toggleReveal('entry')">
                    <component :is="entryRevealed ? Hide : View" class="icon" aria-hidden="true" />
                  </button>
                  <button class="primary" @click="copy(current.entry.value)"><CopyDocument class="icon" aria-hidden="true" />复制</button>
                </div>
              </dd>
            </div>
            <div v-if="current.entry.tags.length">
              <dt>标签</dt>
              <dd class="tags">
                <button v-for="tag in current.entry.tags" :key="tag" @click="filter = 'tag:' + tag"># {{ tag }}</button>
              </dd>
            </div>
            <div v-if="current.entry.notes">
              <dt>备注</dt>
              <dd class="notes">{{ current.entry.notes }}</dd>
            </div>
          </dl>
          <div class="detail-footer">
            <small>更新于 {{ new Date(current.entry.updatedAt).toLocaleString('zh-CN', updatedFormat) }}</small>
            <button class="danger" @click="modify(true)">删除</button>
          </div>
        </template>
        <p v-if="error && !editor" class="error" role="alert">{{ error }}</p>
      </section>
    </main>

    <footer v-if="state === 'open'">
      <span><kbd>↑ ↓</kbd> 切换</span>
      <span><kbd>↵</kbd> 复制</span>
    </footer>
    <div v-if="toast" class="toast" role="status"><Check class="icon" aria-hidden="true" />{{ toast }}</div>

    <div v-if="editor" class="overlay" @click.self="editor = false">
      <form class="dialog" @submit.prevent="save">
        <div class="dialog-head">
          <h2>{{ editing ? '编辑条目' : '新建条目' }}</h2>
          <button type="button" class="icon-btn" aria-label="关闭编辑" @click="editor = false">
            <Close class="icon" aria-hidden="true" />
          </button>
        </div>
        <div class="form-body">
          <div class="row">
            <label>标题<input v-model="draft.title" maxlength="90" required></label>
            <label>类型<select :value="draft.kind" @change="changeDraftKind"><option v-for="kind in kinds" :key="kind" :value="kind">{{ labels[kind] }}</option></select></label>
          </div>
          <label v-if="draft.kind === 'password'">账号（选填）<input v-model="draft.account"></label>
          <div class="editor-value">
            <label for="entry-value">{{ labels[draft.kind] }}</label>
            <textarea v-if="draft.kind === 'prompt' || draft.kind === 'text'" id="entry-value" v-model="draft.value" rows="5" required></textarea>
            <div v-else class="credential-input">
              <input id="entry-value" v-model="draft.value" :type="draftRevealed ? 'text' : 'password'" spellcheck="false" autocapitalize="off" required @paste="checkRaw" @drop="checkRaw">
              <button type="button" class="icon-btn" aria-label="显示输入内容" :aria-pressed="draftRevealed" :title="draftRevealed ? '隐藏内容' : '显示内容'" @click="toggleReveal('draft')">
                <component :is="draftRevealed ? Hide : View" class="icon" aria-hidden="true" />
              </button>
            </div>
          </div>
          <label>标签（选填）<input v-model="tagInput" placeholder="用逗号分隔"></label>
          <label>备注（选填）<textarea v-model="draft.notes" rows="2"></textarea></label>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
        </div>
        <div class="dialog-footer">
          <button type="button" class="outline" @click="editor = false">取消</button>
          <button class="primary" :disabled="busy">保存条目</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style src="./vault.css"></style>
