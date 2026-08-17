<template>
  <teleport to="body">
    <transition name="drawer">
      <div v-if="visible" class="drawer-overlay" @click.self="close">
        <div class="drawer-panel">
          <div class="drawer-header">
            <div class="drawer-title-row">
              <span class="drawer-title">{{ task.title }}</span>
              <span class="drawer-priority" :style="{ background: priorityConf.bg, color: priorityConf.color }">
                {{ task.priority }}
              </span>
              <span class="drawer-status" :style="{ color: statusConf.color }">{{ statusConf.label }}</span>
            </div>
            <button class="close-btn" @click.stop="close">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="drawer-body">
            <!-- 描述 -->
            <div class="detail-section">
              <div class="content-row">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 5l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="content-row-body">
                  <p v-if="task.description" class="detail-desc">{{ task.description }}</p>
                  <p v-else class="detail-desc empty">暂无描述</p>
                </div>
              </div>
            </div>

            <div class="detail-divider"></div>

            <!-- 起止时间 -->
            <div class="detail-section">
              <div class="content-row date-content-row">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <span class="date-range" :class="{ overdue: isOverdue }">{{ dateRangeText }}</span>
              </div>
            </div>

            <div class="detail-divider"></div>

            <!-- 进度 -->
            <div class="detail-section">
              <div class="content-row progress-content-row">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M12 3a9 9 0 017.2 14.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <div class="progress-row">
                  <div class="progress-track">
                    <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
                  </div>
                  <span class="progress-value">{{ task.progress }}%</span>
                </div>
              </div>
            </div>

            <div class="detail-divider"></div>

            <!-- 标签 -->
            <div class="detail-section" style="position: relative;">
              <div class="section-header">
                <TagIcon class="section-icon" width="14" height="14" />
                <span class="section-label-text">标签</span>
                <div class="tag-btn-wrapper">
                  <button class="add-tag-btn" @click.stop="showTagEditor = !showTagEditor">
                    <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                  </button>
                  <div v-if="showTagEditor" class="tag-editor-popover" @click.stop>
                    <div class="tag-editor-panel">
                      <div class="tag-editor-list">
                        <button
                          v-for="tag in allTags"
                          :key="tag.id"
                          class="tag-editor-item"
                          :class="{ selected: selectedTagIds.includes(tag.id) }"
                          :style="{
                            background: selectedTagIds.includes(tag.id) ? tag.color + '20' : 'transparent',
                            borderColor: selectedTagIds.includes(tag.id) ? tag.color : '#e5e7eb',
                          }"
                          @click="toggleEditorTag(tag.id)"
                        >
                          <span class="tag-dot" :style="{ background: tag.color }"></span>
                          <span class="tag-name">{{ tag.name }}</span>
                          <span v-if="selectedTagIds.includes(tag.id)" class="tag-check">✓</span>
                        </button>
                      </div>
                      <div class="tag-editor-footer">
                        <input
                          v-model="newTagName"
                          class="tm-input"
                          placeholder="新建标签"
                          @keydown.enter="createAndSelectTag"
                        />
                        <button class="tm-add-btn" @click="createAndSelectTag">添加</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="task-tags" v-if="task.tags?.length">
                <span v-for="tag in task.tags" :key="tag.id" class="tag-pill" :style="{ background: tag.color + '18', color: tag.color }" @click.stop="handleRemoveTag(tag)">
                  <TagIcon width="10" height="10" />
                  {{ tag.name }}
                </span>
              </div>
              <div v-else class="empty-hint">暂无标签</div>
            </div>

            <div class="detail-divider"></div>

            <!-- 子任务 -->
            <div class="detail-section">
              <div class="section-header">
                <svg class="section-icon" viewBox="0 0 1024 1024" fill="currentColor" width="14" height="14">
                  <path d="M256 130.688c22.08 0 40 17.92 40 40v163.84h265.728a140.8 140.8 0 1 1 0 80H296v106.88A216 216 0 0 0 512 737.408h49.728a140.8 140.8 0 1 1 0 80H512a296 296 0 0 1-296-295.936V375.424a38.784 38.784 0 0 1 0-1.856v-202.88c0-22.08 17.92-40 40-40z m440.704 183.04a60.736 60.736 0 1 0 0 121.472 60.736 60.736 0 0 0 0-121.408z m0 402.944a60.736 60.736 0 1 0 0 121.472 60.736 60.736 0 0 0 0-121.472z"/>
                </svg>
                <span class="section-label-text">子任务</span>
                <button class="add-subtask-btn" @click="handleAddSubtask">
                  <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                  </svg>
                  添加子任务
                </button>
              </div>
              <div v-if="subtaskTreeIds.length > 0" class="drawer-subtasks">
                <TaskItem
                  v-for="stId in subtaskTreeIds"
                  :key="stId"
                  :task="drawerTaskMap[stId]"
                  :subtask-counts="drawerSubtaskCounts"
                  :subtask-map="drawerSubtaskMap"
                  :attachment-counts="{}"
                  :all-tags="allTags"
                  :on-create-tag="onCreateTag"
                  @toggle="(t: any) => $emit('toggle', t)"
                  @view="(id: number) => $emit('viewSubtask', id)"
                  @edit="(id: number) => $emit('edit', id)"
                  @delete="handleSubtaskItemDelete"
                  @add-subtask="(pid: number) => $emit('addSubtask', pid)"
                />
              </div>
              <div v-else class="empty-hint">暂无子任务</div>
            </div>

            <div class="detail-divider"></div>

            <!-- 附件 -->
            <div class="detail-section">
              <div class="section-header">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M13.5 2H5a2 2 0 00-2 2v16l3.5-3.5L13.5 20V2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M15 7v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="section-label-text">附件</span>
                <button class="add-attachment-btn" @click="handleUploadAttachment" :disabled="uploading">
                  <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                  {{ uploading ? '上传中...' : '上传' }}
                </button>
              </div>
              <div v-if="attachments.length > 0" class="drawer-attachments">
                <div v-for="item in attachments" :key="item.id" class="attachment-item">
                  <div class="attachment-icon">
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M13.5 2H5a2 2 0 00-2 2v16l3.5-3.5L13.5 20V2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                  <div class="attachment-info">
                    <span class="attachment-name">{{ item.file_name }}</span>
                    <span class="attachment-size">{{ formatFileSize(item.file_size) }}</span>
                  </div>
                  <div class="attachment-actions">
                    <button class="attachment-btn download" @click.stop="handleDownloadAttachment(item)" title="下载">
                      <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                    <button class="attachment-btn delete" @click.stop="handleDeleteAttachment(item.id)" :disabled="deletingId === item.id" :title="deletingId === item.id ? '删除中...' : '删除'">
                      <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="empty-hint">暂无附件</div>
            </div>

            <div class="detail-divider"></div>

            <!-- 任务记录 -->
            <div class="detail-section">
              <div class="section-header">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 5l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="section-label-text">任务记录</span>
                <button class="add-log-btn" @click="handleOpenLogForm">
                  <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                  添加记录
                </button>
              </div>
              <TaskLogTimeline ref="logTimelineRef" hide-title :task-id="task.id" />
            </div>
          </div>

          <div class="drawer-footer">
            <button class="footer-btn edit-btn" @click="handleEdit">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              编辑
            </button>
            <button class="footer-btn delete-btn" @click="handleDelete">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              删除
            </button>
            <div class="footer-spacer"></div>
            <button class="footer-btn cycle-btn" @click="handleCycleStatus">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              {{ nextStatusLabel }}
            </button>
          </div>

        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue';
import { db } from '@/db';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
import { downloadAttachment } from '@/db/attachmentDownload';
import type { Task, TaskStatus, TaskAttachment, Tag } from '@/types';
import TaskItem from './TaskItem.vue';
import TaskLogTimeline from './TaskLogTimeline.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import TagIcon from '@/icon/tag.svg?component';

const props = defineProps<{
  task: Task;
  visible: boolean;
  subtaskReloadTrigger?: number;
  allTags?: Tag[];            // ★ 新增
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>; // ★ 新增
}>();
const emit = defineEmits<{
  close: [];
  edit: [id: number];
  delete: [id: number];
  toggle: [task: Task];
  viewSubtask: [id: number];
  addSubtask: [parentId: number];
  tagsUpdated: [taskId: number];
}>();

const drawerTaskMap = ref<Record<number, Task>>({});
const drawerSubtaskCounts = ref<Record<number, number>>({});
const drawerSubtaskMap = ref<Record<number, Task[]>>({});
const subtaskTreeIds = ref<number[]>([]);
const logTimelineRef = shallowRef<InstanceType<typeof TaskLogTimeline> | null>(null);
const attachments = ref<TaskAttachment[]>([]);
const uploading = ref(false);
const deletingId = ref<number | null>(null);

// ★ 新增：标签编辑
const showTagEditor = ref(false);
const selectedTagIds = ref<number[]>([]);
const newTagName = ref('');

// 监听 task 变化时同步选中状态
watch(() => props.task.id, async () => {
  if (props.task.tags) {
    selectedTagIds.value = props.task.tags.map(t => t.id);
  }
}, { immediate: true });

const allTags = computed(() => {
  return props.allTags || [];
});

/** 组件挂载标记：卸载后不再执行任何 DOM 操作 */
let isMounted = true;
onUnmounted(() => { isMounted = false; });

/** 点击外部关闭标签编辑浮层 */
onMounted(() => {
  document.addEventListener('click', handleDrawerClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('click', handleDrawerClickOutside);
});

function handleDrawerClickOutside() {
  if (!isMounted || showTagEditor.value) {
    showTagEditor.value = false;
  }
}

/** 防竞争标记：递增序列号，只接受最后一次 loadTaskSubtrees 的结果 */
let loadSeq = 0;

const priorityConf = computed(() => PRIORITY_CONFIG[props.task.priority]);
const statusConf = computed(() => STATUS_CONFIG[props.task.status]);
const isOverdue = computed(() => {
  if (!props.task.due_date || props.task.status === 'done' || props.task.status === 'cancelled') return false;
  return new Date(props.task.due_date) < new Date();
});

/** 日期范围文本：起始日期 - 截止日期 */
const dateRangeText = computed(() => {
  const start = props.task.start_date ? formatDate(props.task.start_date) : null;
  const due = props.task.due_date ? formatDate(props.task.due_date) : null;
  if (start && due) return `${start} - ${due}`;
  if (start) return start;
  if (due) return due;
  return '未设置';
});

const nextStatusLabel = computed(() => {
  const next: Record<TaskStatus, string> = {
    todo: '开始处理',
    doing: '标记完成',
    done: '重新打开',
    cancelled: '重新打开',
  };
  return next[props.task.status];
});

/**
 * 监听 task.id（切换子任务时）或 task.status（状态变更后）
 * 注意：不监听 progress，避免 recalcAncestorProgressOptimized 触发不必要的重载
 */
watch(
  () => ({ id: props.task.id, status: props.task.status }),
  async ({ id }) => {
    if (!id || !isMounted) return;
    await loadTaskSubtrees(id);
  },
  { immediate: true }
);

/** 监听子任务重载触发器（来自父组件，新建子任务后触发） */
let _reloadTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.subtaskReloadTrigger,
  (val) => {
    if (!isMounted || val === undefined || !props.task.id) return;
    // 防抖：避免与 props.task 的 watch 同时触发导致竞争
    if (_reloadTimer) clearTimeout(_reloadTimer);
    _reloadTimer = setTimeout(() => {
      loadTaskSubtrees(props.task.id);
    }, 50);
  }
);

/** 监听任务 ID 变化，加载附件列表 */
watch(
  () => props.task.id,
  async (id) => {
    if (!isMounted || !id) return;
    await loadAttachments();
  },
  { immediate: true }
);

async function loadTaskSubtrees(id: number) {
  if (!id || !isMounted) return;
  const seq = ++loadSeq;
  const children = await db.tasks.getSubtasks(id);
  if (loadSeq !== seq || !isMounted) return;

  const nextTaskMap = { ...drawerTaskMap.value };
  const nextCounts = { ...drawerSubtaskCounts.value };
  const nextMap = { ...drawerSubtaskMap.value };

  nextTaskMap[id] = props.task;
  const childIds: number[] = [];
  for (const c of children) {
    nextTaskMap[c.id] = c;
    childIds.push(c.id);
  }
  nextMap[id] = children;

  if (childIds.length) {
    const counts = await db.tasks.getSubtaskCounts(childIds);
    Object.assign(nextCounts, counts);
    await loadDrawerSubtasksIncremental(childIds, nextTaskMap, nextCounts, nextMap);
  }

  // 关键：全部数据加载完成后，再一次性更新所有响应式状态
  // 避免 subtaskTreeIds 先更新但 drawerTaskMap 还未更新导致的 TaskItem 崩溃
  drawerTaskMap.value = nextTaskMap;
  drawerSubtaskCounts.value = nextCounts;
  drawerSubtaskMap.value = nextMap;
  subtaskTreeIds.value = childIds;
}

async function loadDrawerSubtasksIncremental(parentIds: number[], taskMap: Record<number, Task>, counts: Record<number, number>, map: Record<number, Task[]>) {
  if (!parentIds.length) return;
  const countsRes = await db.tasks.getSubtaskCounts(parentIds);
  Object.assign(counts, countsRes);
  const nextIds: number[] = [];
  for (const pid of parentIds) {
    if (countsRes[pid]) {
      const children = await db.tasks.getSubtasks(pid);
      map[pid] = children;
      for (const child of children) {
        taskMap[child.id] = child;
        nextIds.push(child.id);
      }
    }
  }
  if (nextIds.length) {
    await loadDrawerSubtasksIncremental(nextIds, taskMap, counts, map);
  }
}

function close() {
  emit('close');
}

function handleEdit() {
  emit('edit', props.task.id);
}

function handleDelete() {
  emit('delete', props.task.id);
}

function handleCycleStatus() {
  emit('toggle', props.task);
}

function handleAddSubtask() {
  emit('addSubtask', props.task.id);
}

/** 抽屉内子任务的删除：本地删除后刷新列表，不关闭抽屉 */
async function handleSubtaskItemDelete(subtaskId: number) {
  if (!isMounted) return;
  const ok = await db.tasks.softDelete(subtaskId);
  if (ok && props.task.id) {
    await loadTaskSubtrees(props.task.id);
  }
}

/** 打开任务记录的添加表单 */
function handleOpenLogForm() {
  if (!isMounted) return;
  logTimelineRef.value?.openAddForm();
}

/** 加载当前任务的附件列表 */
async function loadAttachments() {
  if (!isMounted || !props.task.id) return;
  const list = await db.attachments.listByTask(props.task.id);
  attachments.value = list;
}

/** 触发文件选择并上传附件 */
async function handleUploadAttachment() {
  if (!props.task.id || uploading.value) return;
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
      await db.attachments.create(props.task.id, f);
    }
    await loadAttachments();
    uploading.value = false;
  };
  input.click();
}

/** 下载附件 */
async function handleDownloadAttachment(item: TaskAttachment) {
  try {
    const saved = await downloadAttachment(item);
    if (!saved.ok) {
      if (saved.error.code !== 'CANCELLED') ElMessage.error(saved.error.message);
      return;
    }
    ElMessage.success('下载成功');
  } catch (e: any) {
    ElMessage.error('下载失败：' + e.message);
  }
}

/** 删除附件 */
async function handleDeleteAttachment(id: number) {
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

function toggleEditorTag(tagId: number) {
  if (!isMounted) return;
  const idx = selectedTagIds.value.indexOf(tagId);
  if (idx >= 0) selectedTagIds.value.splice(idx, 1);
  else selectedTagIds.value.push(tagId);
  
  // 即时保存
  saveTags();
}

async function saveTags() {
  if (!isMounted || !props.task.id) return;
  const ok = await db.taskTags.set(props.task.id, selectedTagIds.value);
  if (ok) {
    // 刷新 task.tags
    props.task.tags = await db.taskTags.getByTask(props.task.id);
    emit('tagsUpdated', props.task.id);
  }
}

async function createAndSelectTag() {
  if (!isMounted || !newTagName.value.trim()) return;
  const tag = await props.onCreateTag?.(newTagName.value.trim(), '#6366f1');
  if (tag) {
    selectedTagIds.value.push(tag.id);
    newTagName.value = '';
    saveTags();
  }
}

async function handleRemoveTag(tag: Tag) {
  if (!isMounted) return;
  try {
    await ElMessageBox.confirm(`确定要删除「${props.task.title}」任务的标签「${tag.name}」吗？`, '删除标签', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    });
  } catch {
    return;
  }
  const idx = selectedTagIds.value.indexOf(tag.id);
  if (idx >= 0) {
    selectedTagIds.value.splice(idx, 1);
    saveTags();
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return '今天';
  if (d.toDateString() === tomorrow.toDateString()) return '明天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(122, 96, 77, 0.2);
}
.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  background: #faf7f2;
  backdrop-filter: blur(16px);
  border-radius: 16px 0 0 16px;
  box-shadow: -8px 0 30px rgba(122, 96, 77, 0.12);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.drawer-enter-active { transition: transform 0.25s ease; }
.drawer-leave-active { transition: transform 0.2s ease; }
.drawer-enter-from { transform: translateX(100%); }
.drawer-leave-to { transform: translateX(100%); }

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 12px;
  gap: 12px;
}
.drawer-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: #4b4257;
  line-height: 1.4;
  word-break: break-word;
  width: 100%;
}
.drawer-priority {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.drawer-status {
  font-size: 12px;
  font-weight: 600;
}
.close-btn {
  flex-shrink: 0;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 8px;
  cursor: pointer; color: #9a8fa7;
  transition: background 0.2s;
}
.close-btn:hover { background: rgba(126, 108, 87, 0.08); color: #4b4257; }

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}
.drawer-body::-webkit-scrollbar { width: 4px; }
.drawer-body::-webkit-scrollbar-thumb { background: #d3d7da; border-radius: 2px; }

.detail-section { padding: 8px 0; }
.detail-divider {
  height: 1px;
  background: rgba(126, 108, 87, 0.08);
  margin: 4px 0;
}
.detail-desc {
  font-size: 13px;
  color: #6b5d6e;
  line-height: 1.6;
  white-space: pre-wrap;
  background: rgba(255,255,255,0.5);
  padding: 10px 12px;
  border-radius: 8px;
  max-height: 120px;
  overflow-y: auto;
}
.detail-desc.empty {
  color: #b0a5b8;
  font-style: italic;
  background: transparent;
  padding: 6px 12px;
}

/* section-header 统一布局（用于子任务、任务记录等带标题/按钮的区域） */
.section-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  width: 100%;
}
/* content-row：图标后直接跟内容（无文字标题） */
.content-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.content-row .section-icon {
  margin-top: 3px;
  flex-shrink: 0;
}
.content-row-body {
  flex: 1;
  min-width: 0;
}
.progress-content-row {
  align-items: center;
}
.section-icon {
  width: 14px;
  height: 14px;
  color: #8b7e9a;
  flex-shrink: 0;
}
.section-label-text {
  font-size: 12px;
  color: #8b7e9a;
  font-weight: 500;
}

/* 日期范围：起始日期 - 截止日期 */
.date-content-row {
  align-items: center;
}
.date-range {
  font-size: 13px;
  color: #4b4257;
  font-weight: 500;
}
.date-range.overdue { color: #d36c6c; }

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.progress-track {
  flex: 1;
  height: 8px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 4px;
  transition: width 0.3s ease;
  max-width: 100%;
}
.progress-value {
  font-size: 12px;
  font-weight: 600;
  color: #6366f1;
  width: 36px;
  text-align: right;
}

.drawer-subtasks {
  margin: 0 -4px;
}

.empty-hint {
  text-align: center;
  padding: 12px 0;
  color: #b0a5b8;
  font-size: 13px;
}

.add-subtask-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #6366f1;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
  margin-left: auto;
}
.add-subtask-btn:hover { background: rgba(99,102,241,0.06); color: #4f46e5; }
.add-subtask-btn svg { color: #6366f1; }

.add-log-btn {
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
  margin-left: auto;
}
.add-log-btn:hover { background: rgba(99,102,241,0.06); }

.drawer-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px 18px;
  border-top: 1px solid rgba(126, 108, 87, 0.08);
}
.footer-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(126,108,87,0.12);
  border-radius: 8px;
  background: rgba(255,255,255,0.55);
  cursor: pointer;
  color: #655b4f;
  transition: all 0.25s ease;
  font-family: inherit;
}
.footer-btn:hover { border-color: #6366f1; color: #6366f1; background: white; transform: translateY(-1px); }
.edit-btn:hover { border-color: #6366f1; color: #6366f1; }
.delete-btn:hover { border-color: #d36c6c; color: #d36c6c; background: #fcf5f5; }
.cycle-btn {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(99,102,241,0.25);
}
.cycle-btn:hover { background: linear-gradient(135deg, #6366f1, #4f46e5); border-color: transparent; color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.35); transform: translateY(-1px); }
.footer-spacer { flex: 1; }

/* 附件 */
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
  margin-left: auto;
}
.add-attachment-btn:hover:not(:disabled) { background: rgba(99,102,241,0.06); }
.add-attachment-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.add-attachment-btn svg { color: #6366f1; }

.drawer-attachments { display: flex; flex-direction: column; gap: 6px; }
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

/* 标签编辑 */
.task-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.tag-pill { font-size: 11px; padding: 1px 8px; border-radius: 999px; font-weight: 500; cursor: pointer; }

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
  margin-left: auto;
}
 .add-tag-btn:hover { background: rgba(99,102,241,0.06); }

.tag-btn-wrapper {
  position: relative;
  display: inline-flex;
  margin-left: auto;
}
.tag-editor-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 280px;
  max-height: 320px;
  overflow-y: auto;
  background: #faf7f2;
  border: 1px solid rgba(126, 108, 87, 0.08);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(122, 96, 77, 0.12);
  padding: 8px;
}
.tag-editor-panel { display: flex; flex-direction: column; gap: 8px; }
.tag-editor-list { display: flex; flex-direction: column; gap: 4px; }
.tag-editor-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #4b4257;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}
.tag-editor-item:hover { background: rgba(126, 108, 87, 0.06); }
.tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tag-name { flex: 1; }
.tag-check { color: #6366f1; font-weight: 700; margin-left: auto; }
.tag-editor-footer {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(126, 108, 87, 0.08);
}
.tm-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #4b4257;
  background: white;
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
</style>
