<template>
  <div class="log-timeline">
    <div v-if="!hideTitle" class="timeline-header">
      <span class="timeline-title">任务记录</span>
      <button v-if="!showAddForm" class="add-log-btn" @click="showAddForm = true">
        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        添加记录
      </button>
    </div>

    <!-- 添加记录表单 -->
    <div v-if="showAddForm" class="add-log-form">
      <textarea
        v-model="newLogContent"
        class="log-input"
        placeholder="记录今日处理内容..."
        rows="2"
      ></textarea>
      <div class="add-log-actions">
        <input
          v-model="newLogDate"
          type="datetime-local"
          class="log-date-input"
        />
        <div class="add-log-btns">
          <button class="btn btn-sm btn-primary" :disabled="!newLogContent.trim() || !newLogDate" @click="submitLog">
            添加
          </button>
          <button class="btn btn-sm btn-ghost" @click="cancelAdd">取消</button>
        </div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div v-if="logs.length === 0 && !showAddForm" class="timeline-empty">
      暂无处理记录
    </div>
    <div v-else class="timeline-items">
      <div v-for="log in sortedLogs" :key="log.id" class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="log-meta">
            <span class="log-date">{{ formatLogDate(log.log_date) }}</span>
            <button class="log-delete" @click="handleDelete(log.id)" title="删除">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="log-text">{{ log.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { database } from 'treasure-sdk';
import { ElMessage } from 'element-plus';
import { db } from '@/db';
import type { TaskLog } from '@/types';

let isMounted = true;
onMounted(() => { isMounted = true; });
onUnmounted(() => { isMounted = false; });

const props = defineProps<{
  taskId: number;
  hideTitle?: boolean;
}>();

const logs = ref<TaskLog[]>([]);
const showAddForm = ref(false);
const newLogContent = ref('');
const newLogDate = ref('');

function todayStr(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

watch(showAddForm, (v) => {
  if (v) newLogDate.value = todayStr();
});

const sortedLogs = computed(() =>
  [...logs.value].sort((a, b) => {
    const dateCmp = b.log_date.localeCompare(a.log_date);
    if (dateCmp !== 0) return dateCmp;
    return a.sort_order - b.sort_order;
  })
);

onMounted(() => {
  loadLogs();
});

async function loadLogs() {
  if (!isMounted) return;
  logs.value = await db.taskLogs.list(props.taskId);
}

function formatLogDate(dateStr: string): string {
  if (dateStr.length === 16) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (dateStr.length === 8) {
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    return `${parseInt(m)}月${parseInt(d)}日`;
  }
  return dateStr;
}

async function submitLog() {
  if (!isMounted || !newLogContent.value.trim() || !newLogDate.value) return;
  const ts = new Date().toISOString();
  const logDate = newLogDate.value.replace('T', ' ');
  const res = await database.execute({ sql: `INSERT INTO task_logs (task_id, content, log_date, sort_order, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, ?, ?)`, tables: ['task_logs'], params: [props.taskId, newLogContent.value.trim(), logDate, ts, ts] });
  if (!res.ok) {
    console.error('task_logs INSERT failed:', res.error.message);
    ElMessage.error('保存失败: ' + res.error.message);
    return;
  }
  await loadLogs();
  newLogContent.value = '';
  newLogDate.value = '';
  showAddForm.value = false;
}

function cancelAdd() {
  newLogContent.value = '';
  newLogDate.value = '';
  showAddForm.value = false;
}

async function handleDelete(logId: number) {
  if (!isMounted) return;
  const ok = await db.taskLogs.delete(logId);
  if (ok) {
    logs.value = logs.value.filter(l => l.id !== logId);
  }
}

function openAddForm() {
  showAddForm.value = true;
}

defineExpose({ openAddForm });
</script>

<style scoped>
.log-timeline {
  padding: 0;
}
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.timeline-title {
  font-size: 13px;
  font-weight: 600;
  color: #4b4257;
}
.add-log-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #6366f1;
  background: none;
  border: 1px dashed rgba(99, 102, 241, 0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.add-log-btn:hover { background: rgba(99, 102, 241, 0.06); }

.add-log-form {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(243, 236, 223, 0.25);
  border-radius: 10px;
}
.log-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #4b4257;
  background: white;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
  font-family: inherit;
}
.log-input:focus { border-color: #6366f1; }
.add-log-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.log-date-input {
  padding: 5px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #4b4257;
  outline: none;
  font-family: inherit;
}
.add-log-btns { display: flex; gap: 6px; }

.timeline-empty {
  text-align: center;
  padding: 16px 0;
  color: #b0a5b8;
  font-size: 13px;
}
.timeline-items { position: relative; }
.timeline-item {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
  position: relative;
}
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: rgba(99, 102, 241, 0.12);
}
.timeline-dot {
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid white;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}
.timeline-content { flex: 1; min-width: 0; }
.log-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}
.log-date {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
}
.log-delete {
  opacity: 0;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 4px;
  cursor: pointer; color: #9a8fa7;
  transition: opacity 0.15s, background 0.15s;
}
.timeline-item:hover .log-delete { opacity: 1; }
.log-delete:hover { color: #d36c6c; background: #fcf5f5; }
.log-text {
  font-size: 13px;
  color: #4b4257;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.btn-primary:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-ghost { background: rgba(255,255,255,0.55); border: 1px solid rgba(126,108,87,0.12); color: #655b4f; }
.btn-ghost:hover { background: white; border-color: #6366f1; color: #6366f1; }
</style>
