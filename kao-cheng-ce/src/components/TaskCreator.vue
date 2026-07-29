<template>
  <div class="task-creator" @keydown.esc="$emit('cancel')">
    <div class="creator-form">
      <div class="creator-header">
        <span class="creator-title">新建任务</span>
        <button class="close-btn" @click="$emit('cancel')">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
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
        rows="2"
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
        <div class="form-field">
          <label class="field-label">截止日期</label>
          <input
            v-model="form.due_date"
            type="date"
            class="form-input date-input"
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

      <div class="form-actions">
        <button class="btn btn-primary" @click="submit" :disabled="!form.title.trim()">
          创建
        </button>
        <button class="btn btn-ghost" @click="$emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import TagIcon from '@/icon/tag.svg?component';
import type { Priority, CreateTaskInput, Tag } from '@/types';

const props = defineProps<{
  tags: Tag[];
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>;
}>();

const emit = defineEmits<{
  create: [input: CreateTaskInput];
  cancel: [];
}>();

const titleInput = ref<HTMLInputElement>();
const priorities: { value: Priority; label: string; color: string; bg: string }[] = [
  { value: 'P0', label: 'P0 紧急', color: '#d36c6c', bg: '#fcf5f5' },
  { value: 'P1', label: 'P1 重要', color: '#f97316', bg: '#fff7ed' },
  { value: 'P2', label: 'P2 一般', color: '#6366f1', bg: '#eef2ff' },
  { value: 'P3', label: 'P3 低优', color: '#9ca3af', bg: '#f9fafb' },
];

const form = reactive({
  title: '',
  description: '',
  priority: 'P2' as Priority,
  due_date: '',
});

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
});

function onEnter(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return;
  submit();
}

function submit() {
  if (!form.title.trim()) return;
  emit('create', {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    due_date: form.due_date || null,
    tag_ids: selectedTagIds.value,  // ★ 新增
  });
}
</script>

<style scoped>
.task-creator {
  border-bottom: 1px solid rgba(126, 108, 87, 0.08);
  background: rgba(255, 255, 255, 0.5);
}
.creator-form { padding: 16px; }
.creator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.creator-title { font-size: 14px; font-weight: 600; color: #4b4257; }
.close-btn {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 6px;
  cursor: pointer; color: #9a8fa7;
  transition: background 0.2s;
}
.close-btn:hover { background: rgba(126, 108, 87, 0.08); color: #4b4257; }
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
.title-input { font-size: 15px; font-weight: 500; margin-bottom: 8px; }
.desc-input { resize: vertical; min-height: 48px; margin-bottom: 12px; }
.form-row { display: flex; gap: 12px; margin-bottom: 12px; }
.form-field { flex: 1; }
.field-label { display: block; font-size: 12px; color: #8b7e9a; margin-bottom: 6px; }
.priority-select { display: flex; gap: 4px; }
.prio-btn {
  flex: 1;
  padding: 5px 8px;
  font-size: 11px;
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
.form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn {
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}
.btn:active { transform: scale(0.97); }
.btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.btn-primary:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-ghost { background: rgba(255,255,255,0.55); border: 1px solid rgba(126,108,87,0.12); color: #655b4f; }
.btn-ghost:hover { background: white; border-color: #6366f1; color: #6366f1; }
</style>