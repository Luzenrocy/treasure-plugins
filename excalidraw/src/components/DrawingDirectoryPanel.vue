<template>
  <section class="panel" aria-labelledby="drawing-panel-title">
    <header class="panel__header"><div><h2 id="drawing-panel-title">绘图目录</h2><p v-if="directoryName" class="muted">{{ directoryName }}</p></div><button type="button" class="button button--quiet" @click="$emit('choose')">{{ configured ? '更换目录' : '选择目录' }}</button></header>
    <div v-if="!configured" class="empty-state"><strong>请选择绘图目录</strong><p>绘图文件只会从已授权目录读取。</p><button class="button" type="button" @click="$emit('choose')">授权目录</button></div>
    <div v-else class="scrollable-region drawing-list" aria-live="polite"><div v-if="loading" class="empty-state">正在列举绘图…</div><div v-else-if="!files.length" class="empty-state">目录中还没有 .excalidraw 文件</div><button v-for="file in files" v-else :key="file.file.id" type="button" class="drawing-item" :class="{ active: current === file.file.id }" @click="$emit('open', file)"><span>{{ displayDrawingName(file.name) }}</span><small v-if="current === file.file.id">当前打开</small></button></div>
    <footer class="panel__footer"><button type="button" class="button" @click="$emit('new')">新建绘图</button><button type="button" class="button button--primary" :disabled="!canSave" @click="$emit('save')">保存</button></footer>
  </section>
</template>
<script setup lang="ts">
import { displayDrawingName, type DrawingFile } from '../domain/drawing';
defineProps<{ configured: boolean; directoryName?: string | null; files: DrawingFile[]; current?: string | null; loading?: boolean; canSave?: boolean }>();
defineEmits<{ choose: []; open: [file: DrawingFile]; new: []; save: [] }>();
</script>
