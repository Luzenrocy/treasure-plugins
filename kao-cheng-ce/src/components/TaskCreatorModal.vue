<template>
  <teleport to="body">
    <div class="modal-overlay" @click.self="close" @keydown.esc="close">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">新建任务</span>
          <button class="close-btn" @click="close">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <input
            ref="titleInput"
            v-model="form.title"
            class="form-input title-input"
            placeholder="任务名称"
            maxlength="200"
            @keydown.enter="onEnter"
          />
          <textarea
            v-model="form.description"
            class="form-input desc-input"
            placeholder="描述（选填）"
            rows="3"
          ></textarea>

          <div class="form-row">
            <div class="form-field">
              <label class="field-label">优先级</label>
              <div class="priority-select">
                <button
                  v-for="p in priorities"
                  :key="p.value"
                  class="prio-btn"
                  :class="{ active: form.priority === p.value }"
                  :style="form.priority === p.value ? { background: p.bg, color: p.color, borderColor: p.color } : {}"
                  @click="form.priority = p.value"
                >{{ p.label }}</button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field date-range-field">
              <label class="field-label">起止时间</label>
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="截止日期"
                value-format="YYYY-MM-DD"
                class="date-range-picker"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="field-label">标签</label>
              <div class="tags-select">
                <button
                  v-for="tag in tags"
                  :key="tag.id"
                  class="tag-select-btn"
                  :class="{ selected: selectedTagIds.includes(tag.id) }"
                  :style="{
                    background: selectedTagIds.includes(tag.id) ? tag.color + '20' : 'transparent',
                    borderColor: selectedTagIds.includes(tag.id) ? tag.color : '#e5e7eb',
                    color: selectedTagIds.includes(tag.id) ? tag.color : '#6b7280',
                  }"
                  @click="toggleTag(tag.id)"
                ><TagIcon width="10" height="10" /> {{ tag.name }}</button>
              </div>
              <button class="add-tag-btn" @click="showNewTagInput = true" title="新建标签">
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>

          <div v-if="showNewTagInput" class="new-tag-row">
            <input
              v-model="newTagName"
              class="tm-input"
              placeholder="标签名"
              @keydown.enter="createAndSelectTag"
              @keydown.esc="showNewTagInput = false"
            />
            <button class="tm-add-btn" @click="createAndSelectTag">添加</button>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="field-label">附件</label>
              <button class="add-attachment-btn" @click="handleUpload" :disabled="uploading">
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                {{ uploading ? '上传中...' : '上传附件' }}
              </button>
            </div>
          </div>
          <div v-if="pendingFiles.length > 0" class="pending-files">
            <div v-for="(f, index) in pendingFiles" :key="index" class="pending-file-item">
              <span class="file-name">{{ f.name }}</span>
              <span class="file-size">{{ formatFileSize(f.size) }}</span>
              <button class="remove-btn" @click="handleRemoveFile(index)">×</button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="close">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="!form.title.trim()">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
            创建
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { file } from '@treasure/sdk';
import { ElMessage } from 'element-plus';
import TagIcon from '@/icon/tag.svg?component';
import type { Priority, CreateTaskInput, Tag } from '@/types';

const emit = defineEmits<{
  create: [input: CreateTaskInput, files: File[]];
  cancel: [];
}>();

const props = defineProps<{
  tags: Tag[];  // ★ 新增：父组件传入标签列表
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>; // ★ 新增
}>();

const titleInput = ref<HTMLInputElement>();
const priorities: { value: Priority; label: string; color: string; bg: string }[] = [
  { value: 'P0', label: 'P0 紧急', color: '#d36c6c', bg: '#fcf5f5' },
  { value: 'P1', label: 'P1 重要', color: '#f97316', bg: '#fff7ed' },
  { value: 'P2', label: 'P2 一般', color: '#6366f1', bg: '#eef2ff' },
  { value: 'P3', label: 'P3 低优', color: '#9ca3af', bg: '#f9fafb' },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const dateRange = ref<[string, string]>([today(), today()]);

const dateShortcuts = [
  { text: '今天', value: () => {
    const end = new Date(); end.setHours(0,0,0,0);
    return [end, end] as [Date, Date];
  }},
  { text: '本周', value: () => {
    const now = new Date(); now.setHours(0,0,0,0);
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return [start, now] as [Date, Date];
  }},
  { text: '本月', value: () => {
    const now = new Date(); now.setHours(0,0,0,0);
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return [start, now] as [Date, Date];
  }},
];

const form = reactive({
  title: '',
  description: '',
  priority: 'P2' as Priority,
  start_date: today(),
  due_date: today(),
});
const pendingFiles = ref<File[]>([]);
const uploading = ref(false);

// ★ 新增：标签选择
const selectedTagIds = ref<number[]>([]);
const showNewTagInput = ref(false);
const newTagName = ref('');

function toggleTag(tagId: number) {
  const idx = selectedTagIds.value.indexOf(tagId);
  if (idx >= 0) selectedTagIds.value.splice(idx, 1);
  else selectedTagIds.value.push(tagId);
}

async function createAndSelectTag() {
  if (!newTagName.value.trim()) return;
  const tag = await props.onCreateTag?.(newTagName.value.trim(), '#6366f1');
  if (tag) {
    selectedTagIds.value.push(tag.id);
    newTagName.value = '';
    showNewTagInput.value = false;
  }
}

onMounted(() => {
  titleInput.value?.focus();
  document.addEventListener('keydown', handleKeydown);
});

function onEnter(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return;
  submit();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

function close() {
  document.removeEventListener('keydown', handleKeydown);
  pendingFiles.value = [];
  emit('cancel');
}

async function handleUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        ElMessage.error(`文件 ${f.name} 超过 10MB 限制`);
        continue;
      }
      pendingFiles.value.push(f);
    }
  };
  input.click();
}

function handleRemoveFile(index: number) {
  pendingFiles.value.splice(index, 1);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function submit() {
  if (!form.title.trim()) return;
  const [start, end] = dateRange.value;
  emit('create', {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    start_date: start || null,
    due_date: end || null,
    tag_ids: selectedTagIds.value,  // ★ 新增
  }, pendingFiles.value);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(75, 66, 87, 0.3);
  animation: overlay-in 0.2s ease;
}
@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal-dialog {
  width: 480px;
  max-height: 80vh;
  background: #faf7f2;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.2);
  display: flex;
  flex-direction: column;
  animation: modal-in 0.2s ease;
}
@keyframes modal-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 0;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #4b4257;
}
.close-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 8px;
  cursor: pointer; color: #9a8fa7;
  transition: background 0.2s;
}
.close-btn:hover { background: rgba(126, 108, 87, 0.08); color: #4b4257; }
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 20px 18px;
}
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 13px;
  color: #4b4257;
  background: #fcfaf7;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}
.form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.title-input { font-size: 15px; font-weight: 500; margin-bottom: 10px; }
.desc-input { resize: vertical; min-height: 64px; margin-bottom: 14px; }
.form-row { display: flex; gap: 12px; margin-bottom: 14px; }
.form-field { flex: 1; }
.field-label { display: block; font-size: 12px; color: #8b7e9a; margin-bottom: 6px; font-weight: 500; }
.priority-select { display: flex; gap: 4px; }
.prio-btn {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fcfaf7;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s;
}
.prio-btn:hover { border-color: #d1d5db; }
.date-input { font-size: 13px; }
.date-range-field { flex: 1; }
.date-range-picker { width: 100%; }
.add-attachment-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #6366f1;
  background: transparent;
  border: 1px dashed rgba(99, 102, 241, 0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.add-attachment-btn:hover:not(:disabled) { background: rgba(99,102,241,0.06); }
.add-attachment-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pending-files { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.pending-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.6);
  border-radius: 8px;
  border: 1px solid rgba(126, 108, 87, 0.08);
}
.file-name { flex: 1; font-size: 12px; color: #4b4257; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 11px; color: #9a8fa7; }
.remove-btn {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 4px;
  cursor: pointer; color: #9a8fa7; font-size: 16px;
}
.remove-btn:hover { color: #d36c6c; background: #fcf5f5; }

/* 标签选择 */
.tags-select { display: flex; gap: 4px; flex-wrap: wrap; }
.tag-select-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.add-tag-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #6366f1;
  background: transparent;
  border: 1px dashed rgba(99, 102, 241, 0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.add-tag-btn:hover { background: rgba(99,102,241,0.06); }
.new-tag-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.tm-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #4b4257;
  background: #fcfaf7;
  outline: none;
  font-family: inherit;
}
.tm-add-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: linear-gradient(135deg, #818cf8, #6366f1);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 12px rgba(99,102,241,0.25);
  transition: all 0.25s ease;
}
.tm-add-btn:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.btn {
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
}
.btn:active { transform: scale(0.97); }
.btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.btn-primary:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-ghost { background: rgba(255,255,255,0.55); border: 1px solid rgba(126,108,87,0.12); color: #655b4f; }
.btn-ghost:hover { background: white; border-color: #6366f1; color: #6366f1; }
</style>