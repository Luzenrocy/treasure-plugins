<template>
  <div ref="appRoot" class="app" :class="{ 'is-locked': modalOpen }" tabindex="0" aria-label="观象谱工作台" @keydown="handleKeydown" @pointerdown="dismissMenuOutside">
    <div class="workspace" :inert="modalOpen || !!busy">
      <aside class="file-sidebar" tabindex="0" aria-label="左侧目录与大纲，鼠标移入或聚焦展开">
        <div v-if="outlineItems.length" class="outline-preview" aria-hidden="true" :style="{ '--outline-gap': outlineGap + 'px' }">
          <i v-for="(item, index) in outlineItems" :key="item.node.id" class="outline-marker" :class="['depth-' + Math.min(item.depth, 2), { 'is-active': selectedNodeId ? selectedNodeId === item.node.id : index === outlineItems.length - 1 }]"></i>
        </div>
        <div class="sidebar-content">
          <div class="sidebar-tabs" role="tablist" aria-label="侧栏内容">
            <button role="tab" :class="{ active: panelTab === 'files' }" :aria-selected="panelTab === 'files'" @click="panelTab = 'files'"><UiIcon name="folder" />文件</button>
            <button role="tab" :class="{ active: panelTab === 'outline' }" :aria-selected="panelTab === 'outline'" @click="panelTab = 'outline'"><UiIcon name="outline" />大纲</button>
          </div>
          <template v-if="panelTab === 'outline'">
            <div class="sidebar-eyebrow">{{ hasDocument ? fileName : '当前文档' }}</div>
            <div class="outline-list" role="tree" aria-label="主题大纲">
              <div v-for="item in outlineItems" :key="item.node.id" class="outline-row" :class="{ selected: selectedNodeId === item.node.id }" :style="{ '--indent': 8 + item.depth * 15 + 'px' }" role="treeitem" :aria-level="item.depth + 1" :aria-expanded="item.node.children.length ? !outlineCollapsedIds.has(item.node.id) : undefined">
                <button v-if="item.node.children.length" class="outline-toggle" :aria-label="(outlineCollapsedIds.has(item.node.id) ? '展开' : '折叠') + item.node.text" :aria-expanded="!outlineCollapsedIds.has(item.node.id)" @click="toggleOutline(item.node.id)"><UiIcon :name="outlineCollapsedIds.has(item.node.id) ? 'right' : 'chevron'" :size="12" /></button>
                <span v-else class="outline-leaf" aria-hidden="true"><UiIcon name="minus" :size="12" /></span>
                <button class="outline-select" :aria-label="item.node.text" @click="selectNode(item.node.id)"><span class="outline-label">{{ item.node.text }}</span></button>
              </div>
              <div v-if="!outlineItems.length" class="empty-sidebar">打开导图后查看大纲</div>
            </div>
          </template>
          <template v-else>
            <div class="sidebar-eyebrow">工作目录</div>
            <div v-if="directoryError" class="permission-card" role="alert"><UiIcon name="lock" :size="26" /><strong>目录暂不可用</strong><span class="small muted">{{ directoryError }}</span><button v-if="directory" class="button primary" @click="refreshDirectory()">重试</button><button v-else class="button primary" @click="pickDirectory">重新授权</button><button class="button" @click="showOverlay('directory')">选择其他目录</button></div>
            <template v-else>
              <div class="folder-row"><UiIcon name="folder" :size="17" /><strong>{{ directoryName || '未选择工作目录' }}</strong><IconButton label="刷新目录" icon="refresh" :disabled="!directory" @click="refreshDirectory()" /><IconButton label="更换工作目录" icon="more" @click="showOverlay('directory')" /></div>
              <label class="file-search"><UiIcon name="search" :size="14" /><input v-model="fileQuery" aria-label="搜索文件名" placeholder="搜索文件名" /></label>
              <div class="file-list">
                <div v-for="entry in filteredFiles" :key="entry.file.id" class="file-row" :class="{ selected: isWorkspaceTarget(entry.file) }" role="button" tabindex="0" :aria-label="'打开 ' + entry.name" :aria-current="isWorkspaceTarget(entry.file) ? 'true' : undefined" @click="openExisting(entry.file)" @keydown.enter.prevent="openExisting(entry.file)" @keydown.space.prevent="openExisting(entry.file)">
                  <span class="file-format">T</span><span class="file-row-name">{{ entry.name }}</span><i v-if="isWorkspaceTarget(entry.file) && dirty" class="dirty-dot"></i>
                  <IconButton class="file-options" :class="{ active: menu === 'file-options' && menuFile?.id === entry.file.id }" :label="entry.name + '的文件操作'" icon="more" aria-haspopup="menu" @click.stop="openFileOptions(entry.file, $event)" />
                </div>
                <div v-if="!filteredFiles.length" class="empty-sidebar">{{ fileQuery ? '没有匹配的文件' : directory ? '这里还没有思维导图，创建一份新的想法。' : '选择工作目录后，可管理其中的思维导图。' }}<button v-if="!directory" class="button directory-choice" @click="showOverlay('directory')">选择工作目录</button></div>
              </div>
            </template>
          </template>
        </div>
      </aside>
      <main class="main-region">
        <div ref="viewport" class="viewport" :class="{ panning: panning }" tabindex="0" aria-label="思维导图画布" @pointerdown="beginPan" @pointermove="movePan" @pointerup="endPan" @pointercancel="cancelPan" @wheel.prevent="onWheel">
          <svg id="map-svg" class="map-svg" xmlns="http://www.w3.org/2000/svg" aria-label="当前思维导图">
            <g v-if="hasDocument" :transform="mapTransform">
              <path v-for="edge in graph.edges" :key="edge.to.node.id" class="mm-edge" :d="edgePath(edge, currentSheet.layout)" :stroke="graph.theme.lines[edge.to.branch % 4]" />
              <g v-for="item in graph.nodes" :key="item.node.id" class="mm-node" :class="{ 'node-root': item.depth === 0, 'node-leaf': item.depth > 1, 'is-selected': selectedNodeId === item.node.id }" :transform="`translate(${item.x},${item.y})`" role="button" :aria-label="item.node.text" :data-node-id="item.node.id" @click.stop="selectNode(item.node.id)" @dblclick.stop="beginEdit(item.node.id)">
                <rect v-if="selectedNodeId === item.node.id" class="selection-ring" :x="-item.width / 2 - 5" :y="-item.height / 2 - 5" :width="item.width + 10" :height="item.height + 10" rx="15" />
                <rect class="node-shape" :x="-item.width / 2" :y="-item.height / 2" :width="item.width" :height="item.height" :rx="item.depth === 0 ? 15 : 11" :fill="nodeFill(item, graph.theme)" />
                <path v-if="item.depth > 1" :d="`M ${-item.width / 2 + 8} ${item.height / 2 - 3} H ${item.width / 2 - 8}`" :stroke="graph.theme.lines[item.branch % 4]" stroke-width="1.5" />
                <text class="node-title" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif" :font-size="item.depth === 0 ? 19 : 15" :font-weight="item.depth > 1 ? 400 : 500" :style="{ fill: item.node.style?.color || (item.depth === 0 ? '#fff' : '#302b38') }"><tspan v-for="(line, index) in item.lines" :key="index" x="0" :y="(index - (item.lines.length - 1) / 2) * (item.depth === 0 ? 24 : 20) + 5">{{ line }}</tspan></text>
                <g v-if="item.node.note" class="node-note" :transform="`translate(${item.width / 2 - 13},${-item.height / 2 + 10})`"><path d="M-3-3h6v7h-6Z" fill="none" stroke="#756e7d" /></g>
                <g v-for="control in collapseControls(item)" :key="control.branch || 'node'" class="node-collapse" :transform="`translate(${control.x},${control.y})`" :aria-label="(control.collapsed ? '展开' : '折叠') + (control.branch === 'left' ? '左侧分支' : control.branch === 'right' ? '右侧分支' : item.node.text)" @click.stop="toggleCollapsed(item.node, control.branch)">
                  <circle r="9" :fill="graph.theme.root" /><path :d="control.collapsed ? 'M-4 0H4M0-4V4' : 'M-4 0H4'" stroke="#fff" stroke-width="1.3" />
                </g>
              </g>
            </g>
          </svg>
          <nav class="app-header" aria-label="工作台操作">
            <div class="floating-group app-menu-group" role="group" aria-label="主菜单"><IconButton label="主菜单" icon="menu" aria-haspopup="menu" :aria-expanded="menu === 'file'" @click="toggleMenu('file', $event)" /></div>
            <div class="floating-group app-action-group" role="group" aria-label="保存与导出"><span class="save-control" :class="{ 'is-dirty': dirty, 'is-saving': busy === 'saving' }"><IconButton :label="dirty ? '保存（有未保存更改）' : '保存'" icon="save" :disabled="!hasDocument || mode === 'external' || !!busy" @click="save()" /></span><IconButton label="导出当前思维导图" icon="export" :disabled="!hasDocument || !!busy" @click="showOverlay('export')" /></div>
          </nav>
          <div v-if="hasDocument" class="canvas-commands">
            <template v-if="mode === 'editable'"><IconButton label="撤销" icon="undo" :disabled="!undoStack.length" @click="history('undo')" /><IconButton label="重做" icon="redo" :disabled="!redoStack.length" @click="history('redo')" /><span class="divider"></span><IconButton label="主题" icon="palette" @click="openInspector('theme', $event)" /><IconButton label="选择导图结构" icon="tree" aria-haspopup="menu" :aria-expanded="menu === 'layout'" @click="toggleMenu('layout', $event)" /></template>
            <template v-else><span class="preview-label"><UiIcon name="lock" :size="14" />只读预览</span><button class="text-button" @click="showOverlay('compat')">兼容说明</button><span class="divider"></span><button class="text-button" @click="ensureEditable()">创建可编辑副本</button></template>
          </div>
          <div v-if="hasDocument && selectedItem && !editingNodeId && !modalOpen" ref="contextbar" class="contextbar" :style="contextStyle">
            <button class="text-button" @click="addNode(false)"><UiIcon name="child" />子主题</button><button class="text-button" :disabled="selectedItem.depth === 0" @click="addNode(true)"><UiIcon name="sibling" />同级</button><span class="divider"></span><button class="text-button" @click="openInspector('style', $event)"><UiIcon name="palette" />样式</button><button class="text-button" @click="openNote"><UiIcon name="note" />备注</button>
          </div>
          <div v-if="hasDocument" id="view-controls" class="view-controls"><div class="view-control-group"><IconButton label="缩小" icon="minus" @click="zoomBy(1 / 1.15)" /><span class="zoom-value">{{ Math.round(zoom * 100) }}%</span><IconButton label="放大" icon="plus" @click="zoomBy(1.15)" /><span class="divider"></span><button class="text-button" @click="fitView"><UiIcon name="fit" />适应画布</button><button class="text-button" aria-label="重置视图" title="恢复缩放与位置，不修改内容" @click="resetView"><UiIcon name="target" /><span class="reset-label">重置视图</span></button></div></div>
          <div v-if="mode === 'external' && hasDocument" class="canvas-status">{{ fileName }} · 只读预览</div>
          <textarea v-if="editingNodeId" ref="inlineEditor" v-model="editValue" class="inline-editor" aria-label="编辑主题文字" maxlength="500" :style="editorStyle" @blur="finishEdit()" @compositionstart="composing = true" @compositionend="composing = false" @keydown="editorKeydown"></textarea>
          <div v-if="!hasDocument" class="empty-canvas"><div class="empty-card"><div class="empty-icon"><UiIcon name="map" :size="34" /></div><h1>让新的想法展开</h1><p>从工作目录打开思维导图，<br />或创建一份新的导图。</p><div class="empty-actions"><button class="button primary" @click="beginNewDocument"><UiIcon name="plus" />新建思维导图</button><button class="button" @click="openFile"><UiIcon name="folder" />打开文件</button></div></div></div>
        </div>
        <footer class="sheetbar" aria-label="画布列表">
          <template v-if="hasDocument"><template v-for="sheet in workbook.sheets" :key="sheet.id"><input v-if="sheetEditId === sheet.id" ref="sheetInput" v-model="sheetName" class="sheet-name-input" maxlength="80" aria-label="画布名称" @blur="finishSheetRename()" @keydown="sheetKeydown" /><button v-else class="sheet-tab" :class="{ active: sheet.id === activeSheetId }" :aria-pressed="sheet.id === activeSheetId" :aria-label="'画布 ' + sheet.name + '，双击重命名'" title="双击重命名" @click="switchSheet(sheet.id)" @dblclick="beginSheetRename(sheet.id)">{{ sheet.name }}</button></template><IconButton label="添加画布" icon="plus" @click="addSheet" /><span class="sheet-status">{{ visibleNodes(currentSheet.root).length }} 个主题 · {{ workbook.sheets.length }} 张画布</span></template>
          <span v-else class="sheet-status">未打开文件</span>
        </footer>
      </main>
      <aside v-if="inspector && !narrow && hasDocument" class="inspector" aria-label="属性面板"><InspectorPanel :kind="inspector" :theme-key="currentSheet.theme" :node="selectedNode" @close="closeInspector" @theme="setTheme" @text="updateText" @note="updateNote" @fill="updateFill" /></aside>
    </div>
    <div v-if="menu && !modalOpen" class="popover" role="menu" :style="menuStyle">
      <template v-if="menu === 'file'">
        <button class="menu-item" role="menuitem" @click="menuAction(beginNewDocument)"><UiIcon name="plus" />新建思维导图<span class="shortcut">{{ modifier }} N</span></button>
        <button class="menu-item" role="menuitem" @click="menuAction(openFile)"><UiIcon name="folder" />打开文件<span class="shortcut">{{ modifier }} O</span></button><div class="menu-separator"></div>
        <button class="menu-item" role="menuitem" :disabled="!hasDocument" @click="menuAction(closeDocument)"><UiIcon name="close" />关闭当前文件</button>
        <button class="menu-item" role="menuitem" @click="menuAction(() => showOverlay('directory'))"><UiIcon name="folder" />更换工作目录</button>
        <button class="menu-item" role="menuitem" :disabled="!hasDocument" @click="menuAction(resetView)"><UiIcon name="target" />重置视图（缩放与位置）<span class="shortcut">{{ modifier }} 0</span></button>
        <button class="menu-item" role="menuitem" :disabled="!hasDocument" @click="menuAction(resetSheet)"><UiIcon name="trash" />重置画布</button><div class="menu-separator"></div>
        <button class="menu-item" role="menuitem" @click="menuAction(() => showOverlay('shortcuts'))"><UiIcon name="keyboard" />快捷键</button>
      </template>
      <template v-else-if="menu === 'layout'"><button v-for="(label, key) in layoutLabels" :key="key" class="menu-item" role="menuitemradio" :aria-checked="currentSheet.layout === key" @click="setLayout(key)"><UiIcon :name="currentSheet.layout === key ? 'check' : 'tree'" />{{ label }}</button></template>
      <template v-else-if="menuFile"><button class="menu-item" role="menuitem" @click="menuAction(() => openExisting(menuFile!))"><UiIcon name="file" />打开</button><button v-if="isWorkspaceTarget(menuFile)" class="menu-item" role="menuitem" @click="menuAction(() => save(true))"><UiIcon name="save" />另存副本</button><div class="menu-separator"></div><button class="menu-item danger" role="menuitem" @click="menuAction(() => askDelete(menuFile!))"><UiIcon name="trash" />移到回收站</button></template>
    </div>
    <div v-if="modalOpen" class="overlay" :class="{ 'drawer-overlay': overlay === 'directory' || narrowInspector }" @click.self="dismissOverlay">
      <section ref="dialogElement" class="dialog" :class="{ 'wide-dialog': overlay === 'export' || overlay === 'compat', drawer: overlay === 'directory' || narrowInspector, 'right-drawer': narrowInspector }" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1" @keydown.tab="trapFocus">
        <div class="dialog-header"><div id="dialog-title" class="dialog-title">{{ dialogTitle }}</div><IconButton v-if="!directoryGate" label="关闭对话框" icon="close" :disabled="!!busy || exporting" @click="dismissOverlay" /></div>
        <div class="dialog-content">
          <div v-if="dialogError || exportError" class="dialog-note error-note" role="alert">{{ dialogError || exportError }}</div>
          <template v-if="dialog">
            <p>{{ dialog.message }}</p>
            <div v-if="dialog.fileName !== undefined" class="field">
              <label class="field-label" for="save-name">文件名称</label>
              <input id="save-name" v-model="dialog.fileName" maxlength="80" :disabled="!!busy" @keydown.enter.prevent="confirmDialog" />
            </div>
            <div v-if="busy" class="locked-message"><i class="busy-spinner"></i>{{ busy === 'deleting' ? '正在移到回收站…' : '正在保存，请稍候…' }}</div>
          </template>
          <template v-else-if="narrowInspector"><InspectorPanel :kind="inspector!" :theme-key="currentSheet.theme" :node="selectedNode" drawer @theme="setTheme" @text="updateText" @note="updateNote" @fill="updateFill" /></template>
          <template v-else-if="overlay === 'new'"><div class="field"><label class="field-label" for="new-name">文件名称</label><input id="new-name" v-model="newName" maxlength="80" :disabled="!!busy" @keydown.enter.prevent="createDocument" /></div><div class="field"><label class="field-label" for="new-layout">结构</label><select id="new-layout" v-model="newLayout" :disabled="!!busy"><option v-for="(label, key) in layoutLabels" :key="key" :value="key">{{ label }}</option></select></div></template>
          <template v-else-if="overlay === 'directory'"><p class="drawer-description">先选择一个工作目录，观象谱才能创建、打开和管理思维导图。</p><div v-if="directoryError" class="dialog-note error-note" role="alert">{{ directoryError }}</div><div v-if="directoryName" class="folder-choice selected"><UiIcon name="folder" :size="21" /><span>{{ directoryName }}</span><UiIcon name="check" /></div><button class="folder-choice" @click="pickDirectory"><UiIcon name="folder" :size="21" /><span>{{ directoryName ? '选择其他目录…' : '选择工作目录…' }}</span><UiIcon name="right" :size="14" /></button></template>
          <template v-else-if="overlay === 'export'"><div class="field"><label class="field-label" for="export-format">格式</label><select id="export-format" v-model="exportFormat" :disabled="exporting"><option value="svg">SVG · 矢量图</option><option value="png">PNG · 图片</option></select></div><div class="field"><label class="field-label" for="export-range">范围</label><select id="export-range" v-model="exportRange" :disabled="exporting"><option value="current">当前画布</option><option value="all">全部画布 · 每张一个文件</option><option value="selected" :disabled="!selectedNode">选中主题及子树</option></select></div><label class="checkbox-row"><input v-model="exportTransparent" type="checkbox" :disabled="exporting" />透明背景</label><div v-if="exportFormat === 'png'" class="field" style="margin-top:12px"><label class="field-label" for="export-scale">分辨率</label><select id="export-scale" v-model.number="exportScale" :disabled="exporting"><option :value="1">1×</option><option :value="2">2×</option></select></div><p class="small muted export-destination-note">导出时将打开系统“另存为”，由你选择电脑上的目标路径。</p><div class="export-results"><div v-for="result in exportResults" :key="result.name" class="export-download" :class="{ 'is-saved': result.ok }"><span>{{ result.name }}</span><small>{{ result.message }}</small><UiIcon v-if="result.ok" name="check" :size="14" /></div></div></template>
          <template v-else-if="overlay === 'note'"><div class="field"><label class="field-label" for="note-text">{{ selectedNode?.text }}</label><textarea id="note-text" v-model="noteDraft" rows="6" placeholder="添加备注…"></textarea></div></template>
          <template v-else-if="overlay === 'compat'"><p><strong>{{ fileName }}</strong> 已以只读方式打开。</p><ul class="compat-list"><li><UiIcon name="check" /><div>主题层级与文字可预览<small>可切换已有画布、缩放和查看大纲。</small></div></li><li><UiIcon name="alert" /><div>当前解析范围<small>保留主题文字与层级；不保证高级样式、附件、关系线、概要和布局信息。编辑前需创建新的 .gxp 副本。</small></div></li></ul></template>
          <template v-else-if="overlay === 'shortcuts'"><dl class="shortcut-list"><dt>{{ modifier }} S</dt><dd>保存</dd><dt>{{ modifier }} O</dt><dd>打开文件</dd><dt>{{ modifier }} N</dt><dd>新建思维导图</dd><dt>{{ modifier }} Z / ⇧ Z</dt><dd>撤销 / 重做</dd><dt>Tab / Enter</dt><dd>选中主题后添加子主题 / 同级主题</dd><dt>双击</dt><dd>编辑主题或画布名称</dd><dt>Delete / Backspace</dt><dd>删除所选主题</dd><dt>{{ modifier }} 0</dt><dd>重置视图</dd><dt>Esc</dt><dd>关闭浮层或取消选择</dd></dl></template>
        </div>
        <div class="dialog-footer">
          <template v-if="dialog"><button class="button" :disabled="!!busy" @click="dismissOverlay">取消</button><button v-if="dialog.secondary" class="button text-danger" :disabled="!!busy" @click="dialog.secondary">放弃更改</button><button class="button" :class="dialog.danger ? 'danger' : 'primary'" :disabled="!!busy" @click="confirmDialog">{{ busy === 'deleting' ? '正在删除…' : busy === 'saving' ? '正在保存…' : dialog.confirmText || '确认' }}</button></template>
          <template v-else-if="overlay === 'new'"><button class="button" :disabled="!!busy" @click="dismissOverlay">取消</button><button class="button primary" :disabled="!!busy" @click="createDocument">{{ busy ? '正在创建…' : '创建' }}</button></template>
          <template v-else-if="overlay === 'export'"><button class="button" :disabled="exporting" @click="dismissOverlay">取消</button><button class="button primary" :disabled="exporting" @click="generateExport">{{ exporting ? '正在导出…' : '导出' }}</button></template>
          <template v-else-if="overlay === 'note'"><button class="button" @click="dismissOverlay">取消</button><button class="button primary" @click="saveNote">完成</button></template>
          <button v-else-if="!directoryGate" class="button primary" @click="dismissOverlay">{{ overlay === 'compat' ? '知道了' : '完成' }}</button>
        </div>
      </section>
    </div>
    <div v-if="notice" class="toast" role="status" aria-live="polite">{{ notice }}</div>
    <div v-if="busy === 'opening'" class="operation-status" role="status"><i class="busy-spinner"></i>正在打开文件…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { files, type FileReference } from '@luzenrocy/treasure-sdk';
import { collapseKey, findNode, findParent, navigationOutlineForSheet, newNode, newSheet, nodeCollapsed, rootBranchCollapsed, rootChildSide, visibleNodes, type Branch, type Layout, type MindNode, type Theme, type Workbook } from './domain';
import { edgePath, layoutSheet, nodeFill, type PositionedNode } from './canvas';
import { sheetToSvg, svgToPng } from './exporter';
import { useWorkbook } from './useWorkbook';
import IconButton from './IconButton.vue';
import InspectorPanel from './InspectorPanel.vue';
import UiIcon from './UiIcon.vue';
import './style.css';
import './floating-controls.css';
import './workspace.css';

const props = defineProps<{ initialWorkbook?: Workbook }>();
const session = useWorkbook(props.initialWorkbook);
const { workbook, hasDocument, mode, directory, directoryName, directoryError, activeSheetId, selectedNodeId,
  currentSheet, selectedNode, dirty, fileName, busy, dialog, dialogError, notice, undoStack, redoStack,
  show, change, history, newDocument, closeDocument, refreshDirectory, chooseDirectory, restoreDirectory, openFile, openExisting, isWorkspaceTarget, save, askDelete } = session;
const appRoot = ref<HTMLElement>(), viewport = ref<HTMLElement>(), contextbar = ref<HTMLElement>(), inlineEditor = ref<HTMLTextAreaElement>();
const dialogElement = ref<HTMLElement>(), sheetInput = ref<HTMLInputElement[]>();
const panelTab = ref<'files' | 'outline'>('outline'), fileQuery = ref('');
const outlineCollapsedIds = ref(new Set<string>());
const outlineItems = computed(() => navigationOutlineForSheet(currentSheet.value, outlineCollapsedIds.value));
const directoryGate = ref(true);
const filteredFiles = computed(() => session.directoryFiles.value.filter((entry) => entry.name.toLowerCase().includes(fileQuery.value.toLowerCase())));
const outlineGap = computed(() => Math.max(3, Math.min(10, Math.floor(150 / Math.max(1, outlineItems.value.length)))));
const menu = ref<'file' | 'layout' | 'file-options' | null>(null), menuFile = shallowRef<FileReference | null>(null), menuStyle = ref({ left: '16px', top: '62px' });
const inspector = ref<'theme' | 'style' | null>(null), windowWidth = ref(window.innerWidth);
const narrow = computed(() => windowWidth.value <= 940), narrowInspector = computed(() => !!inspector.value && narrow.value);
type Overlay = 'new' | 'directory' | 'export' | 'note' | 'compat' | 'shortcuts';
const overlay = ref<Overlay | null>('directory'), modalOpen = computed(() => directoryGate.value || !!dialog.value || !!overlay.value || narrowInspector.value);
const layoutLabels = { both: '左右思维导图', right: '向右逻辑图', down: '向下组织图' } as const;
const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
const dialogTitle = computed(() => dialog.value?.title ?? (narrowInspector.value ? inspector.value === 'theme' ? '主题' : '节点样式' : ({ new: '新建思维导图', directory: '选择工作目录', export: '导出思维导图', note: '主题备注', compat: '预览兼容说明', shortcuts: '快捷键' }[overlay.value!] ?? '')));
let lastTrigger: HTMLElement | undefined;
function rememberTrigger(event?: Event) { const element = event?.currentTarget ?? document.activeElement; if (element instanceof HTMLElement && !element.closest('.overlay')) lastTrigger = element; }
function restoreFocus() { void nextTick(() => { (lastTrigger?.isConnected && !lastTrigger.closest('[inert]') && lastTrigger.offsetParent ? lastTrigger : viewport.value)?.focus({ preventScroll: true }); }); }
function dismissMenuOutside(event: PointerEvent) { if (!(event.target as Element).closest('.popover,[aria-haspopup="menu"]')) menu.value = null; }
function toggleMenu(kind: 'file' | 'layout' | 'file-options', event: Event) {
  if (menu.value === kind) { menu.value = null; return; }
  finishEdit(); rememberTrigger(event); menu.value = kind;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(), app = appRoot.value!.getBoundingClientRect();
  menuStyle.value = { left: Math.max(8, Math.min(app.width - 270, rect.left - app.left)) + 'px', top: rect.bottom - app.top + 6 + 'px' };
}
function openFileOptions(file: FileReference, event: Event) { menuFile.value = file; toggleMenu('file-options', event); }
function menuAction(action: () => unknown) { menu.value = null; action(); }
function showOverlay(kind: Overlay) {
  if (directoryGate.value && kind !== 'directory') return;
  if (!finishEdit() || !finishSheetRename()) return;
  rememberTrigger(); menu.value = null; inspector.value = null; dialogError.value = ''; exportError.value = '';
  overlay.value = kind;
  if (kind === 'new') { newName.value = '未命名导图'; newLayout.value = 'both'; }
  if (kind === 'export') { exportResults.value = []; if (!selectedNode.value) exportRange.value = 'current'; }
}
function dismissOverlay() {
  if (busy.value || exporting.value || directoryGate.value) return;
  dialog.value = null; overlay.value = null; dialogError.value = ''; inspector.value = null; restoreFocus();
}
function confirmDialog(event?: Event) {
  if (busy.value || (event instanceof KeyboardEvent && event.isComposing)) return;
  void dialog.value?.confirm(dialog.value.fileName);
}
function trapFocus(event: KeyboardEvent) {
  const controls = Array.from(dialogElement.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []).filter((el) => el.offsetParent !== null);
  if (!controls.length) { event.preventDefault(); return; }
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogElement.value)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogElement.value)) { event.preventDefault(); first.focus(); }
}
watch(dialog, (value) => { if (value) { rememberTrigger(); overlay.value = null; inspector.value = null; menu.value = null; } });
watch(modalOpen, async (value, previous) => { await nextTick(); if (value) { (dialogElement.value?.querySelector<HTMLElement>('input,textarea,button:not(:disabled)') ?? dialogElement.value)?.focus(); } else if (previous) restoreFocus(); });

const graph = computed(() => layoutSheet(currentSheet.value));
const size = ref({ width: 0, height: 0 }), zoom = ref(1), pan = ref({ x: 0, y: 0 }), autoFit = ref(true);
const mapTransform = computed(() => `translate(${size.value.width / 2 + pan.value.x},${size.value.height / 2 + pan.value.y}) scale(${zoom.value})`);
function fitView() {
  autoFit.value = true;
  const bounds = graph.value.bounds, { width, height } = size.value;
  zoom.value = Math.min(1, Math.max(.25, Math.min((width - 110) / Math.max(1, bounds.width), (height - 170) / Math.max(1, bounds.height))));
  pan.value = { x: -(bounds.minX + bounds.maxX) / 2 * zoom.value, y: -(bounds.minY + bounds.maxY) / 2 * zoom.value + 12 };
}
watch([graph, size], () => { if (autoFit.value) fitView(); }, { flush: 'post' });
function resetView() { autoFit.value = false; zoom.value = 1; pan.value = { x: 0, y: 0 }; }
function zoomBy(factor: number) { finishEdit(); autoFit.value = false; zoom.value = Math.max(.25, Math.min(2, zoom.value * factor)); }
const selectedItem = computed(() => graph.value.nodes.find((item) => item.node.id === selectedNodeId.value));
const contextWidth = ref(300);
const contextStyle = computed(() => {
  const item = selectedItem.value;
  if (!item) return {};
  const x = size.value.width / 2 + pan.value.x + item.x * zoom.value - contextWidth.value / 2;
  let y = size.value.height / 2 + pan.value.y + (item.y - item.height / 2) * zoom.value - 48;
  if (y < 74) y = size.value.height / 2 + pan.value.y + (item.y + item.height / 2) * zoom.value + 15;
  return { left: Math.max(12, Math.min(size.value.width - contextWidth.value - 12, x)) + 'px', top: Math.max(75, Math.min(size.value.height - 100, y)) + 'px' };
});
watch([selectedItem, inspector], async () => { await nextTick(); if (contextbar.value) contextWidth.value = contextbar.value.offsetWidth; });
function selectNode(id: string) { if (!finishEdit()) return; selectedNodeId.value = id; if (inspector.value === 'theme') inspector.value = null; viewport.value?.focus({ preventScroll: true }); }
function toggleOutline(id: string) {
  const next = new Set(outlineCollapsedIds.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  outlineCollapsedIds.value = next;
}
function collapseControls(item: PositionedNode) {
  if (!item.node.children.length) return [];
  const branches: (Branch | undefined)[] = item.depth === 0 ? currentSheet.value.layout === 'down' ? ['down'] : ['left', 'right'] : [undefined];
  return branches.filter((branch) => !branch || item.node.children.some((child, index) => rootChildSide(currentSheet.value, child, index) === branch)).map((branch) => {
    const side = branch ?? item.side;
    return { branch, collapsed: branch ? rootBranchCollapsed(currentSheet.value, branch) : !!item.node.collapsed, x: side === 'down' ? 0 : side === 'left' ? -item.width / 2 - 11 : item.width / 2 + 11, y: side === 'down' ? item.height / 2 + 10 : 0 };
  });
}
function ensureEditable(intent?: () => void): boolean {
  if (mode.value === 'editable') return true;
  rememberTrigger(); dialogError.value = '';
  dialog.value = {
    title: '创建可编辑副本',
    message: '可编辑副本将保存到当前工作目录。',
    fileName: workbook.value.title.replace(/\.(smm|xmind)$/i, '') + ' 副本',
    confirmText: '创建可编辑副本',
    confirm: async (name) => { if (await session.createEditableCopy(name ?? '')) { dialog.value = null; intent?.(); } },
  };
  return false;
}
function toggleCollapsed(node: MindNode, branch?: Branch) {
  if (!ensureEditable(() => { const next = findNode(currentSheet.value.root, node.id); if (next) toggleCollapsed(next, branch); })) return;
  change(() => {
    if (node === currentSheet.value.root) {
      if (node.collapsed) { node.collapsed = false; node.collapsedLeft = true; node.collapsedRight = true; node.collapsedDown = true; }
      if (branch) node[collapseKey(branch)] = !node[collapseKey(branch)];
      else { const next = !nodeCollapsed(currentSheet.value, node); node.collapsedLeft = next; node.collapsedRight = next; node.collapsedDown = next; }
    } else node.collapsed = !node.collapsed;
  });
  if (selectedNodeId.value && !graph.value.nodes.some((item) => item.node.id === selectedNodeId.value)) selectedNodeId.value = node.id;
}
function addNode(sibling: boolean) {
  if (!selectedNode.value || !ensureEditable(() => addNode(sibling))) return;
  const selected = selectedNode.value, parent = sibling ? findParent(currentSheet.value.root, selected.id) : selected;
  if (!parent) return;
  const node = newNode();
  change(() => {
    if (sibling) { node.side = selected.side; parent.children.splice(parent.children.indexOf(selected) + 1, 0, node); }
    else { parent.collapsed = false; if (parent === currentSheet.value.root) { node.side = parent.children.filter((child, index) => rootChildSide(currentSheet.value, child, index) === 'right').length <= parent.children.filter((child, index) => rootChildSide(currentSheet.value, child, index) === 'left').length ? 'right' : 'left'; parent[collapseKey(currentSheet.value.layout === 'down' ? 'down' : currentSheet.value.layout === 'right' ? 'right' : node.side)] = false; } parent.children.push(node); }
  });
  selectedNodeId.value = node.id; void nextTick(() => beginEdit(node.id));
}
function removeNode() {
  const node = selectedNode.value;
  if (!node || node === currentSheet.value.root || !ensureEditable(removeNode)) return;
  const parent = findParent(currentSheet.value.root, node.id);
  if (!parent) return;
  change(() => { parent.children = parent.children.filter((child) => child.id !== node.id); }); selectedNodeId.value = parent.id;
}
function openInspector(kind: 'theme' | 'style', event?: Event) { if (!ensureEditable(() => openInspector(kind))) return; finishEdit(); rememberTrigger(event); menu.value = null; overlay.value = null; inspector.value = inspector.value === kind ? null : kind; }
function closeInspector() { inspector.value = null; restoreFocus(); }
function setTheme(theme: Theme) { if (currentSheet.value.theme !== theme) change(() => { currentSheet.value.theme = theme; }); }
function setLayout(layout: Layout) { if (currentSheet.value.layout !== layout) { change(() => { currentSheet.value.layout = layout; }); autoFit.value = true; } menu.value = null; viewport.value?.focus(); }
function updateText(text: string) { const node = selectedNode.value; if (!text.trim()) { show('主题文字不能为空。'); return; } if (node && node.text !== text.trim()) change(() => { node.text = text.trim(); }); }
function updateNote(note: string) { const node = selectedNode.value; if (node && node.note !== note) change(() => { node.note = note; }); }
function updateFill(fill: string | undefined) { const node = selectedNode.value; if (node && node.style?.fill !== fill) change(() => { node.style = { ...node.style, fill }; }); }
function resetSheet() {
  if (!ensureEditable(resetSheet)) return;
  dialogError.value = '';
  dialog.value = { title: '重置画布', message: '移除所有分支并保留中心主题？仅重置内容，不改变缩放或位置；此操作可撤销，也不会删除磁盘文件。', confirmText: '重置画布', danger: true, confirm: () => { autoFit.value = false; change(() => { currentSheet.value.root.children = []; currentSheet.value.root.collapsed = false; currentSheet.value.root.collapsedLeft = false; currentSheet.value.root.collapsedRight = false; currentSheet.value.root.collapsedDown = false; }); dialog.value = null; } };
}

const editingNodeId = ref<string | null>(null), editValue = ref(''), composing = ref(false);
const editorStyle = computed(() => {
  const item = graph.value.nodes.find((item) => item.node.id === editingNodeId.value);
  if (!item) return {};
  return { left: Math.max(8, size.value.width / 2 + pan.value.x + (item.x - item.width / 2) * zoom.value - 8) + 'px', top: Math.max(75, size.value.height / 2 + pan.value.y + (item.y - item.height / 2) * zoom.value - 6) + 'px', width: Math.max(150, item.width * zoom.value + 16) + 'px', height: Math.max(54, item.height * zoom.value + 12) + 'px' };
});
async function beginEdit(id: string) {
  if (!ensureEditable(() => void beginEdit(id))) return;
  const node = findNode(currentSheet.value.root, id); if (!node) return;
  selectedNodeId.value = id; editingNodeId.value = id; editValue.value = node.text; menu.value = null;
  await nextTick(); inlineEditor.value?.focus(); inlineEditor.value?.select();
}
function finishEdit(cancel = false): boolean {
  if (!editingNodeId.value) return true;
  if (composing.value) return false;
  if (!cancel && !editValue.value.trim()) { show('主题文字不能为空。'); void nextTick(() => inlineEditor.value?.focus()); return false; }
  const node = findNode(currentSheet.value.root, editingNodeId.value), value = editValue.value.trim();
  editingNodeId.value = null;
  if (!cancel && node && value !== node.text) change(() => { node.text = value; });
  return true;
}
function editorKeydown(event: KeyboardEvent) { event.stopPropagation(); if (event.isComposing || composing.value) return; if (event.key === 'Escape' || event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); finishEdit(event.key === 'Escape'); viewport.value?.focus(); } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (finishEdit()) void save(); } }
const sheetEditId = ref<string | null>(null), sheetName = ref('');
function switchSheet(id: string) { if (!finishEdit() || !finishSheetRename()) return; if (id !== activeSheetId.value) { inspector.value = null; selectedNodeId.value = null; activeSheetId.value = id; autoFit.value = true; } }
async function beginSheetRename(id: string) { if (!ensureEditable(() => void beginSheetRename(id))) return; const sheet = workbook.value.sheets.find((sheet) => sheet.id === id); if (!sheet) return; sheetEditId.value = id; sheetName.value = sheet.name; await nextTick(); sheetInput.value?.[0]?.focus(); sheetInput.value?.[0]?.select(); }
function finishSheetRename(cancel = false): boolean {
  if (!sheetEditId.value) return true;
  if (!cancel && !sheetName.value.trim()) { show('画布名称不能为空。'); void nextTick(() => sheetInput.value?.[0]?.focus()); return false; }
  const sheet = workbook.value.sheets.find((sheet) => sheet.id === sheetEditId.value); sheetEditId.value = null;
  if (!cancel && sheet && sheet.name !== sheetName.value.trim()) change(() => { sheet.name = sheetName.value.trim(); }); return true;
}
function sheetKeydown(event: KeyboardEvent) { event.stopPropagation(); if (event.isComposing) return; if (event.key === 'Escape' || event.key === 'Enter') { event.preventDefault(); finishSheetRename(event.key === 'Escape'); viewport.value?.focus(); } }
function addSheet() { if (!ensureEditable(addSheet) || !finishEdit() || !finishSheetRename()) return; const sheet = newSheet('画布 ' + (workbook.value.sheets.length + 1)); change(() => { workbook.value.sheets.push(sheet); }); switchSheet(sheet.id); void beginSheetRename(sheet.id); }
const newName = ref('未命名导图'), newLayout = ref<Layout>('both');
function beginNewDocument() {
  if (!finishEdit() || !finishSheetRename()) return;
  session.confirmLeave(() => showOverlay('new'), '新建思维导图');
}
async function createDocument(event?: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return;
  if (await newDocument(newName.value, newLayout.value)) dismissOverlay();
}
const noteDraft = ref('');
function openNote() { if (!selectedNode.value || !ensureEditable(openNote)) return; noteDraft.value = selectedNode.value.note ?? ''; showOverlay('note'); }
function saveNote() { updateNote(noteDraft.value); dismissOverlay(); }
async function pickDirectory() {
  if (await chooseDirectory()) {
    directoryGate.value = false;
    overlay.value = null;
    restoreFocus();
  }
}

const exportFormat = ref<'svg' | 'png'>('svg'), exportRange = ref<'current' | 'all' | 'selected'>('current'), exportTransparent = ref(false), exportScale = ref(2);
const exporting = ref(false), exportError = ref(''), exportResults = ref<{ name: string; ok: boolean; message: string }[]>([]);
async function generateExport() {
  if (exporting.value) return;
  exporting.value = true; exportError.value = ''; exportResults.value = [];
  const sheets = exportRange.value === 'all' ? workbook.value.sheets : exportRange.value === 'selected' && selectedNode.value ? [{ ...currentSheet.value, root: selectedNode.value }] : [currentSheet.value];
  try {
    for (const sheet of sheets) {
      const name = workbook.value.title.replace(/\.(gxp|smm|xmind)$/i, '') + '-' + sheet.name + '.' + exportFormat.value;
      const svg = sheetToSvg(sheet, exportTransparent.value);
      const data = exportFormat.value === 'png' ? await svgToPng(svg, exportScale.value) : new TextEncoder().encode(svg);
      const picked = await files.saveDialog({ title: '导出 ' + exportFormat.value.toUpperCase(), defaultFileName: name, filters: [{ name: exportFormat.value.toUpperCase(), extensions: [exportFormat.value] }], initialDirectory: directory.value ?? undefined });
      if (!picked.ok) { if (picked.error.code !== 'CANCELLED') exportError.value = picked.error.message; exportResults.value.push({ name, ok: false, message: picked.error.code === 'CANCELLED' ? '已取消' : '未保存' }); break; }
      const result = await files.writeFile({ file: picked.value, data });
      exportResults.value.push({ name: result.ok ? result.value.name : name, ok: result.ok, message: result.ok ? '已保存到所选位置' : result.error.message });
      if (!result.ok) exportError.value = result.error.message;
    }
    if (sheets.length && exportResults.value.length === sheets.length && exportResults.value.every((result) => result.ok)) {
      overlay.value = null;
      show(sheets.length === 1 ? '导出成功。' : '导出成功，已保存 ' + sheets.length + ' 个文件。');
      restoreFocus();
    }
  } catch (error) { exportError.value = error instanceof Error ? error.message : '导出失败，请重试。'; }
  finally { exporting.value = false; }
}

const panning = ref(false);
let panStart: { x: number; y: number; origin: { x: number; y: number }; moved: boolean } | undefined;
function beginPan(event: PointerEvent) { if (event.button !== 0 || (event.target as Element).closest('.mm-node,button,textarea,input,a')) return; if (!finishEdit()) return; viewport.value?.focus(); panStart = { x: event.clientX, y: event.clientY, origin: { ...pan.value }, moved: false }; viewport.value?.setPointerCapture(event.pointerId); }
function movePan(event: PointerEvent) { if (!panStart) return; const dx = event.clientX - panStart.x, dy = event.clientY - panStart.y; if (Math.abs(dx) + Math.abs(dy) > 4) panStart.moved = true; if (panStart.moved) { panning.value = true; autoFit.value = false; pan.value = { x: panStart.origin.x + dx, y: panStart.origin.y + dy }; } }
function endPan() { if (panStart && !panStart.moved) { selectedNodeId.value = null; inspector.value = null; } cancelPan(); }
function cancelPan() { panStart = undefined; panning.value = false; }
function onWheel(event: WheelEvent) { if ((event.target as Element).closest('textarea,input,.popover') || !finishEdit()) return; autoFit.value = false; if (event.ctrlKey || event.metaKey) zoomBy(Math.exp(-event.deltaY * .003)); else pan.value = { x: pan.value.x - event.deltaX, y: pan.value.y - event.deltaY }; }
function handleKeydown(event: KeyboardEvent) {
  if (event.isComposing || composing.value || event.keyCode === 229) return;
  if (event.key === 'Escape') { event.preventDefault(); if (busy.value || exporting.value || directoryGate.value) return; if (modalOpen.value) dismissOverlay(); else if (menu.value) { menu.value = null; restoreFocus(); } else if (inspector.value) closeInspector(); else { selectedNodeId.value = null; viewport.value?.focus(); } return; }
  if (modalOpen.value || busy.value) { if ((event.ctrlKey || event.metaKey) && ['s', 'o', 'n'].includes(event.key.toLowerCase())) event.preventDefault(); return; }
  const typing = (event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'), mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); return; }
  if (typing) return;
  if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); history(event.shiftKey ? 'redo' : 'undo'); return; }
  if (mod && event.key.toLowerCase() === 'o') { event.preventDefault(); openFile(); return; }
  if (mod && event.key.toLowerCase() === 'n') { event.preventDefault(); beginNewDocument(); return; }
  if (mod && event.key === '0') { event.preventDefault(); resetView(); return; }
  if (menu.value && event.key === 'Tab') menu.value = null;
  if (!viewport.value?.contains(event.target as Node) || !selectedNode.value) return;
  if (event.key === 'Tab' || event.key === 'Enter') { event.preventDefault(); addNode(event.key === 'Enter'); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeNode(); }
}
watch(activeSheetId, () => { autoFit.value = true; inspector.value = null; editingNodeId.value = null; void nextTick(fitView); });
let resizeObserver: ResizeObserver;
function onResize() { windowWidth.value = window.innerWidth; }
onMounted(() => {
  resizeObserver = new ResizeObserver(() => { if (viewport.value) size.value = { width: viewport.value.clientWidth, height: viewport.value.clientHeight }; });
  if (viewport.value) resizeObserver.observe(viewport.value);
  window.addEventListener('resize', onResize);
  void restoreDirectory().finally(() => {
    if (directory.value) { directoryGate.value = false; overlay.value = null; }
    else { directoryGate.value = true; overlay.value = 'directory'; }
  });
  viewport.value?.focus({ preventScroll: true });
});
onUnmounted(() => { resizeObserver?.disconnect(); window.removeEventListener('resize', onResize); });
</script>
