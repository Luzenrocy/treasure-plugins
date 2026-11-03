<template>
  <div ref="container" class="excalidraw-canvas" aria-label="Excalidraw 画布" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mountExcalidraw, type ExcalidrawBridge } from '../adapters/excalidraw-react';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types';
import type { DrawingFile } from '../domain/drawing';
type CanvasElement = { id: string; type: string; customData?: Record<string, unknown>; [key: string]: unknown };

const props = defineProps<{ libraryOpen?: boolean; mindMapAvailable?: boolean; mindMapEditorOpen?: boolean; drawingFiles?: readonly DrawingFile[]; drawingFilesLoading?: boolean }>();
const emit = defineEmits<{ error: [error: unknown]; change: [elements: readonly CanvasElement[], appState: AppState, files: BinaryFiles]; libraryChange: [items: LibraryItems]; libraryToggle: []; drawingOpen: [file: DrawingFile]; drawingDelete: [file: DrawingFile]; drawingNew: []; mindMapImport: []; mindMapEdit: []; drawingSave: []; drawingClose: []; api: [api: ExcalidrawImperativeAPI] }>();
const container = ref<HTMLElement | null>(null);
let bridge: ExcalidrawBridge | null = null;

function mount() { if (container.value) bridge = mountExcalidraw(container.value, { libraryOpen: props.libraryOpen, mindMapAvailable: props.mindMapAvailable, mindMapEditorOpen: props.mindMapEditorOpen, drawingFiles: props.drawingFiles, drawingFilesLoading: props.drawingFilesLoading, onError: (value) => emit('error', value), onChange: (elements, appState, files) => emit('change', elements, appState, files), onLibraryChange: (items) => emit('libraryChange', items), onLibraryToggle: () => emit('libraryToggle'), onDrawingOpen: (file) => emit('drawingOpen', file), onDrawingDelete: (file) => emit('drawingDelete', file), onDrawingNew: () => emit('drawingNew'), onMindMapImport: () => emit('mindMapImport'), onMindMapEdit: () => emit('mindMapEdit'), onDrawingSave: () => emit('drawingSave'), onDrawingClose: () => emit('drawingClose'), onApi: (api) => emit('api', api) }); }
onMounted(mount);

watch([() => props.drawingFiles, () => props.drawingFilesLoading, () => props.mindMapAvailable, () => props.mindMapEditorOpen], ([drawingFiles, drawingFilesLoading, mindMapAvailable, mindMapEditorOpen]) => {
  bridge?.update({ drawingFiles, drawingFilesLoading, mindMapAvailable, mindMapEditorOpen });
}, { deep: true });

onBeforeUnmount(() => {
  bridge?.unmount();
  bridge = null;
});
</script>
