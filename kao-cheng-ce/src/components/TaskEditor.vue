<template>
  <div class="task-editor" v-if="task">
    <div class="editor-body">
      <div class="editor-header">
        <span class="editor-title">编辑任务</span>
      </div>

      <div class="form-section">
        <div class="form-row">
          <div class="form-field">
            <input
              v-model="editForm.title"
              class="form-input title-input"
              placeholder="任务名称"
              maxlength="200"
              @keydown.enter="onEnter"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <textarea
              v-model="editForm.description"
              class="form-input desc-input"
              placeholder="描述"
              rows="3"
            ></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="field-label">状态</label>
            <div class="status-select">
              <button
                v-for="s in statuses"
                :key="s.value"
                class="status-btn"
                :class="{ active: editForm.status === s.value }"
                @click="editForm.status = s.value"
              >{{ s.label }}</button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="field-label">优先级</label>
            <div class="priority-select">
              <button
                v-for="p in priorities"
                :key="p.value"
                class="prio-btn"
                :class="{ active: editForm.priority === p.value }"
                :style="editForm.priority === p.value ? { background: p.bg, color: p.color, borderColor: p.color } : {}"
                @click="editForm.priority = p.value"
              >{{ p.label }}</button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="field-label">进度</label>
            <div class="progress-control">
              <input
                v-model.number="editForm.progress"
                type="range"
                min="0"
                max="100"
                class="progress-slider"
              />
              <span class="progress-value">{{ editForm.progress }}%</span>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
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

        <div class="form-row" v-if="tags.length">
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
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="field-label">附件</label>
            <button class="add-attachment-btn" @click="handleUploadAttachment" :disabled="uploading">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              {{ uploading ? '上传中...' : '上传' }}
            </button>
          </div>
        </div>
        <div v-if="attachments.length > 0" class="editor-attachments">
          <div v-for="item in attachments" :key="item.id" class="attachment-item">
            <div class="attachment-icon">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M13.5 2H5a2 2 0 00-2 2v16l3.5-3.5L13.5 20V2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="attachment-info">
              <span class="attachment-name">{{ item.file_name }}</span>
              <span class="attachment-size">{{ formatFileSize(item.file_size) }}</span>
            </div>
            <div class="attachment-actions">
              <button class="attachment-btn download" @click="handleDownloadAttachment(item)" title="下载">
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
              <button class="attachment-btn delete" @click="handleDeleteAttachment(item.id)" :disabled="deletingId === item.id" :title="deletingId === item.id ? '删除中...' : '删除'">
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" @click="cancel">取消</button>
        <button class="btn btn-primary" @click="save">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onMounted, onUnmounted } from 'vue';
import { db } from '@/db';
import { file, getTreasure } from '@treasure/sdk';
import { ElMessage, ElMessageBox } from 'element-plus';
import TagIcon from '@/icon/tag.svg?component';
import type { Task, UpdateTaskInput, Priority, TaskStatus, Tag, TaskAttachment } from '@/types';

let isMounted = true;
onMounted(() => { isMounted = true; });
onUnmounted(() => { isMounted = false; });

const props = defineProps<{
  task: Task | null;
  tags: Tag[];
}>();
const emit = defineEmits<{
  save: [id: number, input: UpdateTaskInput];
  cancel: [];
}>();

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];
const priorities: { value: Priority; label: string; color: string; bg: string }[] = [
  { value: 'P0', label: 'P0', color: '#d36c6c', bg: '#fcf5f5' },
  { value: 'P1', label: 'P1', color: '#f97316', bg: '#fff7ed' },
  { value: 'P2', label: 'P2', color: '#6366f1', bg: '#eef2ff' },
  { value: 'P3', label: 'P3', color: '#9ca3af', bg: '#f9fafb' },
];

const editForm = reactive({
  title: '',
  description: '',
  status: 'todo' as TaskStatus,
  priority: 'P2' as Priority,
  progress: 0,
});
const selectedTagIds = reactive<number[]>([]);
const dateRange = ref<[string, string] | null>(null);
const attachments = ref<TaskAttachment[]>([]);
const uploading = ref(false);
const deletingId = ref<number | null>(null);

// 当 task 变化时同步表单
watch(() => props.task, (t) => {
  if (!isMounted || !t) return;
  editForm.title = t.title;
  editForm.description = t.description;
  editForm.status = t.status;
  editForm.priority = t.priority;
  editForm.progress = t.progress;
  dateRange.value = t.start_date || t.due_date
    ? [t.start_date ? t.start_date.slice(0, 10) : '', t.due_date ? t.due_date.slice(0, 10) : '']
    : null;
  selectedTagIds.length = 0;
  if (t.tags) {
    t.tags.forEach(tag => selectedTagIds.push(tag.id));
  }
  loadAttachments();
}, { immediate: true });

async function loadAttachments() {
  if (!isMounted || !props.task?.id) return;
  const list = await db.attachments.listByTask(props.task.id);
  attachments.value = list;
}

async function handleUploadAttachment() {
  if (!isMounted || !props.task?.id || uploading.value) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    uploading.value = true;
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        ElMessage.error(`文件 ${f.name} 超过 10MB 限制`);
        continue;
      }
      await db.attachments.create(props.task!.id, f);
    }
    await loadAttachments();
    uploading.value = false;
  };
  input.click();
}

async function handleDownloadAttachment(item: TaskAttachment) {
  if (!isMounted) return;
  try {
    const res = await file.readBinaryFile(item.file_path);
    if (res.code !== 1 || !res.data) {
      ElMessage.error('读取文件失败');
      return;
    }
    const bridge = getTreasure();
    const saveRes = await bridge.request('saveBinaryFile', {
      defaultPath: item.file_name,
      content: res.data,
    });
    if (saveRes?.code !== 1) {
      ElMessage.error(saveRes?.msg || '保存文件失败');
      return;
    }
    ElMessage.success('下载成功');
  } catch (e: any) {
    ElMessage.error('下载失败：' + e.message);
  }
}

async function handleDeleteAttachment(id: number) {
  if (!isMounted) return;
  try {
    await ElMessageBox.confirm('确定要删除该附件吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  deletingId.value = id;
  try {
    const ok = await db.attachments.delete(id);
    if (!ok) {
      ElMessage.error('删除失败：附件不存在或已被删除');
      return;
    }
    await loadAttachments();
    ElMessage.success('删除成功');
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message);
  } finally {
    deletingId.value = null;
  }
}

function toggleTag(tagId: number) {
  const idx = selectedTagIds.indexOf(tagId);
  if (idx >= 0) selectedTagIds.splice(idx, 1);
  else selectedTagIds.push(tagId);
}

function onEnter(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return;
  save();
}

function save() {
  if (!props.task) return;
  emit('save', props.task.id, {
    title: editForm.title,
    description: editForm.description,
    status: editForm.status,
    priority: editForm.priority,
    progress: editForm.progress,
    due_date: dateRange.value?.[1] || null,
    start_date: dateRange.value?.[0] || null,
    tag_ids: [...selectedTagIds],  // ★ 新增
  });
}

function cancel() {
  emit('cancel');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
</script>

<style scoped>
.task-editor {
  border-bottom: 1px solid rgba(126, 108, 87, 0.08);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.editor-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px 0 16px 16px;
  min-height: 0;
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 12px;
  flex-shrink: 0;
}
.editor-title {
  font-size: 16px;
  font-weight: 700;
  color: #4b4257;
}
.form-section {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding-right: 16px;
}
.form-section::-webkit-scrollbar { width: 6px; }
.form-section::-webkit-scrollbar-track { background: transparent; }
.form-section::-webkit-scrollbar-thumb { background: #d3d7da; border-radius: 3px; }
.form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
.form-field { flex: 1; }
.field-label {
  display: block;
  font-size: 12px;
  color: #8b7e9a;
  margin-bottom: 4px;
  font-weight: 500;
}
.form-input {
  width: 100%;
  padding: 8px 12px;
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
.desc-input { resize: vertical; min-height: 64px; }
.status-select, .priority-select { display: flex; gap: 4px; }
.status-btn, .prio-btn {
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
.status-btn:hover, .prio-btn:hover { border-color: #d1d5db; }
.status-btn.active, .prio-btn.active { border-color: #6366f1; background: #eef2ff; color: #6366f1; }
.progress-control { display: flex; align-items: center; gap: 10px; }
.progress-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #e5e7eb;
  border-radius: 2px;
  outline: none;
}
.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6366f1;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.progress-value { font-size: 12px; font-weight: 600; color: #6366f1; width: 36px; text-align: right; }
.date-range-picker { width: 100%; }
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
.add-attachment-btn svg { color: #6366f1; }

.editor-attachments { display: flex; flex-direction: column; gap: 6px; }
.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.6);
  border-radius: 8px;
  border: 1px solid rgba(126, 108, 87, 0.08);
}
.attachment-icon {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  color: #8b7e9a;
  flex-shrink: 0;
}
.attachment-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.attachment-name {
  font-size: 12px;
  color: #4b4257;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachment-size { font-size: 11px; color: #9a8fa7; }
.attachment-actions { display: flex; gap: 4px; }
.attachment-btn {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9a8fa7;
  transition: background 0.15s, color 0.15s;
}
.attachment-btn:hover:not(:disabled) { background: rgba(126, 108, 87, 0.08); }
.attachment-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.attachment-btn.delete:hover:not(:disabled) { color: #d36c6c; background: #fcf5f5; }

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px 0;
}
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
.btn-ghost { background: rgba(255,255,255,0.55); border: 1px solid rgba(126,108,87,0.12); color: #655b4f; }
.btn-ghost:hover { background: white; border-color: #6366f1; color: #6366f1; }
</style>