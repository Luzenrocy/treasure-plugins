<template>
  <main class="workspace" aria-label="Excalidraw 工作区">
    <section class="editor-shell"><ExcalidrawCanvas :library-open="activePanel === 'library'" :mind-map-available="canEnterMindMap" :mind-map-editor-open="mindMapEditorOpen" :drawing-files="drawingFiles" :drawing-files-loading="loadingFiles" @error="handleEditorError" @change="handleChange" @api="handleApi" @library-change="handleLibraryChange" @library-toggle="activePanel = activePanel === 'library' ? 'closed' : 'library'" @drawing-open="openDrawing" @drawing-delete="requestDeleteDrawing" @drawing-new="requestNewDrawing" @mind-map-import="importMindMap" @mind-map-edit="openMindMapEditor" @drawing-save="saveDrawing" @drawing-close="closeDrawing" /><StatusNotice v-if="error" :message="error.message" :details="error.details" @dismiss="error = null" /></section>
    <LibraryQuickToolbar :items="libraryItems" @insert="insertLibraryItem" />
    <div v-if="activePanel !== 'closed'" class="drawer-backdrop" aria-hidden="true" @click="closeDrawer" />
    <aside v-if="activePanel !== 'closed'" class="side-panel side-panel--drawer"><div class="drawer-toolbar"><button class="drawer-close" type="button" aria-label="关闭抽屉" @click="closeDrawer">×</button></div><LibraryPanel @installed="installLibraryItems" @uninstalled="restoreLibrary" @open-canvas-library="openCanvasLibrary" /></aside>
    <MindMapEditorPanel :document="mindMapEditorOpen ? mindMapDocument : null" :selected-id="selectedMindMapNodeId" @close="closeMindMapEditor" @select="selectMindMapNode" @add-child="addMindMapChild" @rename="renameMindMapNode" @remove="removeMindMapNode" @move="moveMindMapNode" @relayout="relayoutActiveMindMap" />
    <NewDrawingDialog :open="newDrawingTypeOpen" @close="newDrawingTypeOpen = false" @create="createNewDrawing" />
    <SaveNameDialog :open="saveNameOpen" @close="saveNameOpen = false" @save="saveDrawingAs" />
    <OverwriteDrawingDialog :open="!!overwriteTarget" :file-name="overwriteTarget?.name || ''" @close="cancelOverwrite" @confirm="confirmOverwrite" />
    <DeleteDrawingDialog :open="!!deleteTarget" :file-name="deleteTarget?.name || ''" @close="deleteTarget = null" @confirm="deleteDrawingConfirmed" />
    <ExportDialog :open="exportOpen" @close="exportOpen = false" @export="exportDrawing" />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItem } from '@excalidraw/excalidraw/types';
import { CaptureUpdateAction, convertToExcalidrawElements, getCommonBounds } from '@excalidraw/excalidraw';
type CanvasElement = { id: string; type: string; customData?: Record<string, unknown>; [key: string]: unknown };
type CaptureUpdate = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['captureUpdate'];
import ExcalidrawCanvas from './components/ExcalidrawCanvas.vue'; import LibraryQuickToolbar from './components/LibraryQuickToolbar.vue'; import LibraryPanel from './components/LibraryPanel.vue'; import MindMapEditorPanel from './components/MindMapEditorPanel.vue'; import NewDrawingDialog from './components/NewDrawingDialog.vue'; import SaveNameDialog from './components/SaveNameDialog.vue'; import OverwriteDrawingDialog from './components/OverwriteDrawingDialog.vue'; import DeleteDrawingDialog from './components/DeleteDrawingDialog.vue'; import ExportDialog from './components/ExportDialog.vue'; import StatusNotice from './components/StatusNotice.vue';
import { DirectoryService } from './services/directory-service'; import { DrawingFileService } from './services/drawing-file-service'; import { ExportService } from './services/export-service'; import { LibraryService } from './services/library-service'; import { MenuActions, type MenuAction } from './adapters/menu-actions'; import type { DrawingDirectorySetting, DrawingFile, DrawingFileSession } from './domain/drawing'; import type { ExportRequest } from './domain/export'; import type { LibraryItems } from '@excalidraw/excalidraw/types';
import { files } from 'treasure-sdk'; import { MindMapImportService } from './services/mind-map-import-service'; import { renderEditableMindMap } from './services/mind-map-renderer'; import { addChild, adoptConnectedManualTopics, createMindMapDocument, mindMapData, relayoutMindMap, removeSubtree, renameNode, reorderNode, restoreMindMapDocument, type MindMapDocument } from './domain/mind-map';
const activePanel = ref<'closed' | 'library'>('closed'); const exportOpen = ref(false); const newDrawingTypeOpen = ref(false); const saveNameOpen = ref(false); const overwriteTarget = ref<DrawingFile | null>(null); const deleteTarget = ref<DrawingFile | null>(null); const loadingFiles = ref(false); const drawingFiles = ref<DrawingFile[]>([]); const editorApi = ref<ExcalidrawImperativeAPI | null>(null); const elements = ref<readonly CanvasElement[]>([]); const appState = ref<AppState | null>(null); const binaryFiles = ref<BinaryFiles>({}); const libraryItems = ref<LibraryItems>([]); const directory = reactive<DrawingDirectorySetting>({ permissionKey: 'workspace_dir', directory: null, status: 'unconfigured', directoryName: null }); const session = reactive<DrawingFileSession>({ status: 'new', current: null, originalHash: null }); const error = ref<{ message: string; details: string } | null>(null); const mindMapDocument = ref<MindMapDocument | null>(null); const selectedMindMapNodeId = ref<string | null>(null); const mindMapEditorOpen = ref(false);
const canEnterMindMap = computed(() => !!mindMapDocument.value || elements.value.every((element) => !!element.isDeleted));
const directoryService = new DirectoryService(); const drawingService = new DrawingFileService(); const exportService = new ExportService(); const libraryService = new LibraryService(); const mindMapImporter = new MindMapImportService(); const menus = new MenuActions();
watch([mindMapEditorOpen, canEnterMindMap], ([inMindMapMode, canEnter]) => { void menus.updateMode(inMindMapMode ? 'mind-map' : 'drawing', canEnter); });
function notice(message: string, details = '') { error.value = { message, details }; }
function handleEditorError(value: unknown) { notice('Excalidraw 编辑器运行时异常', value instanceof Error ? value.message : String(value)); }
function handleApi(api: ExcalidrawImperativeAPI) { editorApi.value = api; void restoreLibrary(); }
function createCenteredMindMapDocument(): MindMapDocument {
  const document = createMindMapDocument({ title: '中心主题', children: [] });
  const state = editorApi.value?.getAppState(); const zoom = state?.zoom.value || 1;
  if (state) { document.layout.originX = -state.scrollX + state.width / zoom / 2 - 138; document.layout.originY = -state.scrollY + state.height / zoom / 2 - 36; }
  return document;
}
function mindMapNodeIdFromElement(element: CanvasElement): string | null { const data = mindMapData(element); return data?.node?.id || data?.nodeId || data?.edge?.childId || null; }
function handleChange(nextElements: readonly CanvasElement[], nextAppState: AppState, nextFiles: BinaryFiles) {
  elements.value = nextElements; appState.value = nextAppState; binaryFiles.value = nextFiles;
  const selectedIds = Object.keys(nextAppState.selectedElementIds || {}).filter((id) => nextAppState.selectedElementIds[id]);
  const selectedNode = selectedIds.map((id) => nextElements.find((element) => element.id === id)).find((element): element is CanvasElement => !!element);
  const selectedNodeId = selectedNode && mindMapNodeIdFromElement(selectedNode);
  if (selectedNodeId && mindMapDocument.value?.nodes[selectedNodeId]) selectedMindMapNodeId.value = selectedNodeId;
  // While the panel is open, the document is the authoritative model. A scene
  // update can arrive after a user command; restoring from that stale scene
  // would otherwise make freshly added themes disappear on the next relayout.
  if (!mindMapEditorOpen.value) {
    const restored = restoreMindMapDocument(nextElements);
    if (restored) {
      mindMapDocument.value = restored;
      if (!selectedMindMapNodeId.value || !restored.nodes[selectedMindMapNodeId.value]) selectedMindMapNodeId.value = restored.rootId;
    } else if (mindMapDocument.value && !nextElements.some((element) => mindMapData(element))) {
      mindMapDocument.value = null; selectedMindMapNodeId.value = null;
    }
  }
  if (session.status === 'saved' || session.status === 'ready' || session.status === 'new') session.status = 'dirty';
}
function handleLibraryChange(items: LibraryItems) { libraryItems.value = items; }
function installLibraryItems(items: LibraryItems) { libraryItems.value = [...libraryItems.value, ...items]; editorApi.value?.updateLibrary({ libraryItems: items, merge: true }); }
function openCanvasLibrary() { activePanel.value = 'closed'; void editorApi.value?.updateLibrary({ libraryItems: [], merge: true, openLibraryMenu: true }); }
function closeDrawer() { activePanel.value = 'closed'; }
async function restoreLibrary() { const restored = await libraryService.readInstalled(); if (restored.ok) { libraryItems.value = restored.value.libraries; if (editorApi.value) await editorApi.value.updateLibrary({ libraryItems: restored.value.libraries, merge: false }); } }
function randomId() { return globalThis.crypto?.randomUUID?.() || `library-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function insertLibraryItem(item: LibraryItem) {
  const api = editorApi.value;
  if (!api || !item.elements.length) return;
  const sourceIds = new Set(item.elements.map((element) => element.id));
  const idMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  for (const element of item.elements) idMap.set(element.id, randomId());
  for (const element of item.elements) {
    for (const groupId of element.groupIds || []) {
      if (!groupIdMap.has(groupId)) groupIdMap.set(groupId, randomId());
    }
  }
  const [minX, minY, maxX, maxY] = getCommonBounds(item.elements as never);
  const width = maxX - minX;
  const height = maxY - minY;
  const state = api.getAppState();
  const zoom = state.zoom.value || 1;
  const centerX = -state.scrollX + state.width / zoom / 2;
  const centerY = -state.scrollY + state.height / zoom / 2;
  const offsetX = centerX - (minX + width / 2);
  const offsetY = centerY - (minY + height / 2);
  const inserted = item.elements.map((element) => {
    const next = { ...element, id: idMap.get(element.id) || randomId(), x: element.x + offsetX, y: element.y + offsetY, version: 1, versionNonce: Math.floor(Math.random() * 2147483647) } as any;
    if (element.groupIds) next.groupIds = element.groupIds.map((id) => groupIdMap.get(id) || id);
    if (element.boundElements) next.boundElements = element.boundElements.map((bound) => ({ ...bound, id: idMap.get(bound.id) || bound.id }));
    const startBinding = (element as any).startBinding;
    const endBinding = (element as any).endBinding;
    if (startBinding?.elementId && sourceIds.has(startBinding.elementId)) next.startBinding = { ...startBinding, elementId: idMap.get(startBinding.elementId) || startBinding.elementId };
    if (endBinding?.elementId && sourceIds.has(endBinding.elementId)) next.endBinding = { ...endBinding, elementId: idMap.get(endBinding.elementId) || endBinding.elementId };
    if (element.frameId && sourceIds.has(element.frameId)) next.frameId = idMap.get(element.frameId) || element.frameId;
    if ('containerId' in element && (element as any).containerId && sourceIds.has((element as any).containerId)) next.containerId = idMap.get((element as any).containerId) || (element as any).containerId;
    return next;
  });
  const selectedElementIds: Record<string, true> = Object.fromEntries(inserted.map((element) => [element.id, true]));
  api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), ...inserted] as never, appState: { selectedElementIds } });
}
async function refreshFiles() { loadingFiles.value = true; const result = await directoryService.list(); loadingFiles.value = false; if (!result.ok) { notice('列举绘图失败', result.error.message); return; } drawingFiles.value = result.value; }
async function chooseDirectory() { const result = await directoryService.choose(); if (!result.ok) { if (result.error.code !== 'CANCELLED') notice('目录授权失败', result.error.message); return; } Object.assign(directory, result.value); await refreshFiles(); }
async function openDrawing(file: DrawingFile) { activePanel.value = 'closed'; const result = await drawingService.read(file.file); if (!result.ok) { notice('打开绘图失败', result.error.message); return; } const restoredMindMap = restoreMindMapDocument(result.value.elements as CanvasElement[]); mindMapDocument.value = restoredMindMap; selectedMindMapNodeId.value = restoredMindMap?.rootId || null; mindMapEditorOpen.value = !!restoredMindMap; editorApi.value?.updateScene({ elements: result.value.elements as never, appState: result.value.appState as AppState, captureUpdate: CaptureUpdateAction.NEVER }); editorApi.value?.addFiles(Object.values(result.value.files)); session.status = 'saved'; session.current = file; session.originalHash = result.value.hash; }
function requestDeleteDrawing(file: DrawingFile) { deleteTarget.value = file; }
async function deleteDrawingConfirmed() { const file = deleteTarget.value; deleteTarget.value = null; if (!file) return; const result = await directoryService.remove(file); if (!result.ok) { notice('删除绘图失败', result.error.message); return; } if (session.current?.file.id === file.file.id) closeDrawing(); await refreshFiles(); }
function requestNewDrawing() { newDrawingTypeOpen.value = true; }
function createNewDrawing(kind: 'drawing' | 'mind-map') {
  newDrawingTypeOpen.value = false; activePanel.value = 'closed'; mindMapDocument.value = null; selectedMindMapNodeId.value = null; editorApi.value?.resetScene(); session.status = 'new'; session.current = null; session.originalHash = null;
  if (kind === 'mind-map') {
    const document = createCenteredMindMapDocument();
    mindMapDocument.value = document; selectedMindMapNodeId.value = document.rootId; mindMapEditorOpen.value = true; applyMindMap(document, CaptureUpdateAction.NEVER);
  } else mindMapEditorOpen.value = false;
}
function applyMindMap(document: MindMapDocument, captureUpdate: CaptureUpdate = CaptureUpdateAction.IMMEDIATELY, consumedElementIds: readonly string[] = []) {
  const api = editorApi.value; if (!api) throw new Error('画布尚未就绪');
  const plan = renderEditableMindMap(document);
  const generated = convertToExcalidrawElements([...plan.connectors, ...plan.nodes, ...plan.labels] as never, { regenerateIds: false }) as unknown as CanvasElement[];
  const consumed = new Set(consumedElementIds);
  const otherElements = api.getSceneElementsIncludingDeleted().filter((element) => !consumed.has(element.id) && mindMapData(element as CanvasElement)?.mindMapId !== document.mindMapId);
  api.updateScene({ elements: [...otherElements, ...generated] as never, captureUpdate });
  mindMapDocument.value = document; selectedMindMapNodeId.value = selectedMindMapNodeId.value && document.nodes[selectedMindMapNodeId.value] ? selectedMindMapNodeId.value : document.rootId;
}
function mutateMindMap(operation: (document: MindMapDocument) => MindMapDocument) { const current = mindMapDocument.value; if (!current) return; try { applyMindMap(operation(current)); } catch (cause) { notice('编辑思维导图失败', cause instanceof Error ? cause.message : String(cause)); } }
function selectMindMapNode(nodeId: string) {
  if (!mindMapDocument.value?.nodes[nodeId]) return;
  selectedMindMapNodeId.value = nodeId;
  const shape = editorApi.value?.getSceneElementsIncludingDeleted().find((element) => mindMapData(element as CanvasElement)?.node?.id === nodeId);
  if (shape) editorApi.value?.updateScene({ appState: { selectedElementIds: { [shape.id]: true } }, captureUpdate: CaptureUpdateAction.NEVER });
}
function addMindMapChild(nodeId: string | null) {
  const current = mindMapDocument.value;
  if (!nodeId || !current) return;
  try {
    const next = addChild(current, nodeId);
    // addChild appends to the parent's ordered child list, so this is the
    // stable identity of the node that has just been created.
    const newNodeId = next.nodes[nodeId].childIds.at(-1);
    selectedMindMapNodeId.value = newNodeId || nodeId;
    applyMindMap(next);
    if (newNodeId) selectMindMapNode(newNodeId);
  } catch (cause) {
    notice('编辑思维导图失败', cause instanceof Error ? cause.message : String(cause));
  }
}
function renameMindMapNode(nodeId: string | null, title: string) { if (!nodeId) return; mutateMindMap((document) => renameNode(document, nodeId, title)); }
function removeMindMapNode(nodeId: string | null) { if (!nodeId) return; mutateMindMap((document) => { const parentId = document.nodes[nodeId]?.parentId || document.rootId; const next = removeSubtree(document, nodeId); selectedMindMapNodeId.value = parentId; return next; }); }
function moveMindMapNode(nodeId: string | null, offset: -1 | 1) { if (!nodeId) return; mutateMindMap((document) => reorderNode(document, nodeId, offset)); }
function relayoutActiveMindMap() {
  const current = mindMapDocument.value; const api = editorApi.value; if (!current || !api) return;
  try {
    const scene = api.getSceneElementsIncludingDeleted() as unknown as CanvasElement[];
    // Undo/redo changes the canvas scene before it changes the panel's
    // in-memory model. Prefer the scene snapshot here so a manually drawn
    // topic is never absorbed twice after Cmd+Z.
    const source = restoreMindMapDocument(scene) || current;
    const adopted = adoptConnectedManualTopics(source, scene);
    const next = relayoutMindMap(adopted.document);
    if (adopted.addedNodeIds.length) selectedMindMapNodeId.value = adopted.addedNodeIds.at(-1) || selectedMindMapNodeId.value;
    applyMindMap(next, CaptureUpdateAction.IMMEDIATELY, adopted.consumedElementIds);
  } catch (cause) { notice('重新整理思维导图失败', cause instanceof Error ? cause.message : String(cause)); }
}
function closeMindMapEditor() { mindMapEditorOpen.value = false; }
function openMindMapEditor() {
  const scene = editorApi.value?.getSceneElementsIncludingDeleted() as unknown as CanvasElement[] || [];
  const fromScene = restoreMindMapDocument(scene);
  // A scene-change callback can briefly precede persistence of customData
  // after an import. The in-memory document is already validated and must
  // remain a valid source for entering edit mode during that interval.
  const restored = fromScene || mindMapDocument.value || (scene.every((element: any) => element.isDeleted) ? createCenteredMindMapDocument() : null);
  if (!restored) { notice('没有可编辑的思维导图', '请先导入思维导图，或打开包含思维导图元数据的绘图文件。'); return; }
  const api = editorApi.value;
  const adopted = api ? adoptConnectedManualTopics(restored, api.getSceneElementsIncludingDeleted() as unknown as CanvasElement[]) : { document: restored, consumedElementIds: [], addedNodeIds: [] };
  mindMapDocument.value = relayoutMindMap(adopted.document);
  selectedMindMapNodeId.value = restored.rootId;
  mindMapEditorOpen.value = true;
  applyMindMap(mindMapDocument.value, CaptureUpdateAction.NEVER, adopted.consumedElementIds);
}
async function chooseAndImportMindMap() {
  const selected = await files.openDialog({ kind: 'file', title: '导入思维导图', filters: [{ name: '思维导图', extensions: ['xmind', 'smm', 'json'] }] });
  if (!selected.ok) { if (selected.error.code !== 'CANCELLED') notice('选择思维导图失败', selected.error.message); return; }
  if (!Array.isArray(selected.value) || !selected.value[0]) { notice('导入思维导图失败', '系统选择器未返回文件'); return; }
  const file = selected.value[0]; const content = await files.readFile(file);
  if (!content.ok) { notice('读取思维导图失败', content.error.message); return; }
  const parsed = await mindMapImporter.parse(file.name, content.value);
  if (!parsed.ok) { notice('导入思维导图失败', parsed.error.message); return; }
  try { const document = createMindMapDocument(parsed.value.root); mindMapEditorOpen.value = false; applyMindMap(document, CaptureUpdateAction.NEVER); const imported = editorApi.value?.getSceneElementsIncludingDeleted() || []; editorApi.value?.scrollToContent(imported as never, { fitToContent: true }); } catch (cause) { notice('导入思维导图失败', cause instanceof Error ? cause.message : String(cause)); return; }
  session.status = 'dirty'; session.current = null; session.originalHash = null; activePanel.value = 'closed';
}
async function importMindMap() { await chooseAndImportMindMap(); }
function closeDrawing() { activePanel.value = 'closed'; mindMapEditorOpen.value = false; mindMapDocument.value = null; selectedMindMapNodeId.value = null; editorApi.value?.resetScene(); session.status = 'new'; session.current = null; session.originalHash = null; }
async function saveDrawing() { if (!directory.directory) { notice('请先选择绘图目录', '保存前需要完成目录授权。'); return; } if (!session.current) { saveNameOpen.value = true; return; } await persistDrawing(session.current.name); }
function storedDrawingName(fileName: string) { return fileName.toLowerCase().endsWith('.excalidraw') ? fileName : `${fileName}.excalidraw`; }
async function saveDrawingAs(fileName: string) {
  const filesResult = await directoryService.list();
  if (!filesResult.ok) { notice('检查同名文件失败', filesResult.error.message); return; }
  drawingFiles.value = filesResult.value;
  const requested = storedDrawingName(fileName).toLocaleLowerCase();
  const existing = filesResult.value.find((file) => file.name.toLocaleLowerCase() === requested);
  if (existing) { saveNameOpen.value = false; overwriteTarget.value = existing; return; }
  saveNameOpen.value = false;
  await persistDrawing(fileName);
}
function cancelOverwrite() { overwriteTarget.value = null; saveNameOpen.value = true; }
async function confirmOverwrite() { const target = overwriteTarget.value; overwriteTarget.value = null; if (target) await persistDrawing(target.name, target); }
async function persistDrawing(fileName: string, target?: DrawingFile) { if (!directory.directory) { notice('请先选择绘图目录', '保存前需要完成目录授权。'); return; } const result = drawingService.serialize(elements.value as never, appState.value || {} as AppState, binaryFiles.value); if (!result.ok) { notice('保存绘图失败', result.error.message); return; } session.status = 'saving'; const saved = target || session.current ? await drawingService.saveExisting((target || session.current)!.file, result.value) : await drawingService.save(directory.directory, fileName, result.value); if (!saved.ok) { session.status = 'dirty'; notice('保存绘图失败', saved.error.message); return; } session.status = 'saved'; session.current = { name: saved.value.name, file: saved.value }; await refreshFiles(); }
async function exportDrawing(request: ExportRequest) { exportOpen.value = false; if (!appState.value) return; const rendered = await exportService.render(request, elements.value, appState.value, binaryFiles.value); if (!rendered.ok) { notice('导出失败', rendered.error.message); return; } const saved = await exportService.save(rendered.value, request); if (!saved.ok && saved.error.code !== 'CANCELLED') notice('导出失败', saved.error.message); }
async function handleMenu(action: MenuAction) { if (action === 'new') requestNewDrawing(); else if (action === 'close') closeDrawing(); else if (action === 'save') await saveDrawing(); else if (action === 'export') exportOpen.value = true; else if (action === 'drawing-mode') closeMindMapEditor(); else openMindMapEditor(); }
onMounted(async () => { const restored = await directoryService.restore(); if (restored.ok) Object.assign(directory, restored.value); if (directory.directory) await refreshFiles(); else await chooseDirectory(); const registered = await menus.register(handleMenu, { new: true, close: true, save: true, export: true }, mindMapEditorOpen.value ? 'mind-map' : 'drawing', canEnterMindMap.value); if (!registered.ok && registered.error.code !== 'UNSUPPORTED') notice('宿主菜单不可用', '请升级 Treasure 宿主后重试。'); }); onBeforeUnmount(() => { void menus.unregister(); });
</script>
