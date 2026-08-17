<template>
  <div class="note-container">
    <div class="note-card">
      <div class="note-sidebar" :class="{ 'is-collapsed': !isSidebarOpen }" @contextmenu.prevent="handleContextMenu($event, null)">
        <div class="sidebar-header">
          <span v-if="isSidebarOpen" class="sidebar-title">目录</span>
          <div v-if="isSidebarOpen" class="mode-trigger" title="切换编辑模式" @click.stop="toggleModeMenu($event)">
            <el-icon><component :is="modeIcon" /></el-icon>
          </div>
          <el-icon v-if="isSidebarOpen" class="rebuild-entry" title="重建资产索引" @click.stop="handleRebuildAssetIndex"><Refresh /></el-icon>
        </div>
        <div class="toggle-icon" @click="toggleSidebar">
          <el-icon><component :is="isSidebarOpen ? 'Fold' : 'Expand'" /></el-icon>
        </div>
        <div class="sidebar-content" v-show="isSidebarOpen">
          <el-tree ref="fileTreeRef" v-if="fileTree.length > 0" :data="fileTree" :props="defaultProps" @node-click="handleNodeClick" highlight-current node-key="path" :expand-on-click-node="false" accordion>
            <template #default="{ node, data }">
              <span class="custom-tree-node">
                <span class="node-content" @contextmenu.prevent.stop="handleContextMenu($event, data)">
                  <el-icon class="tree-icon"><component :is="data.isDirectory ? 'Folder' : 'Document'" /></el-icon>
                  <span class="tree-label" :title="node.label">{{ node.label }}</span>
                </span>
                <span class="node-actions" @click.stop>
                  <template v-if="data.isDirectory">
                    <el-icon class="action-icon" title="新建文件" @click.stop="handleCreateFile(data.path)"><DocumentAdd /></el-icon>
                    <el-icon class="action-icon" title="新建文件夹" @click.stop="handleCreateFolder(data.path)"><FolderAdd /></el-icon>
                  </template>
                  <el-icon class="action-icon delete-icon" title="删除" @click.stop="handleDelete(data)"><Delete /></el-icon>
                </span>
              </span>
            </template>
          </el-tree>
          <div v-else class="empty-tree">暂无文件</div>
        </div>
        <div v-if="contextMenu.visible" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
          <div class="menu-item" @click="handleCreateFile(contextMenu.path)"><el-icon><DocumentAdd /></el-icon> 新建文件</div>
          <div class="menu-item" @click="handleCreateFolder(contextMenu.path)"><el-icon><FolderAdd /></el-icon> 新建文件夹</div>
          <div v-if="contextMenu.data && !contextMenu.data.isDirectory" class="menu-item has-submenu">
            <el-icon><Download /></el-icon> 导出
            <el-icon class="submenu-arrow"><ArrowRight /></el-icon>
            <div class="submenu">
              <div class="menu-item" @click="handleExport(contextMenu.data, 'pdf')"><el-icon><Download /></el-icon> 导出为 PDF</div>
              <div class="menu-item" @click="handleExport(contextMenu.data, 'img')"><el-icon><Download /></el-icon> 导出为图片</div>
            </div>
          </div>
          <div v-if="contextMenu.data" class="menu-item delete-item" @click="handleDelete(contextMenu.data)"><el-icon><Delete /></el-icon> 删除</div>
        </div>
        <div v-if="contextMenu.visible" class="context-menu-mask" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu"></div>
        <div v-if="modeMenu.visible" class="mode-menu" :style="{ top: modeMenu.y + 'px', left: modeMenu.x + 'px' }" @click.stop>
          <div class="menu-item" :class="{ active: editorMode === 'edit&preview' }" @click="switchEditorMode('edit&preview')"><el-icon><Notebook /></el-icon> {{ modeLabels['edit&preview'] }}</div>
          <div class="menu-item" :class="{ active: editorMode === 'editOnly' }" @click="switchEditorMode('editOnly')"><el-icon><EditPen /></el-icon> {{ modeLabels['editOnly'] }}</div>
          <div class="menu-item" :class="{ active: editorMode === 'previewOnly' }" @click="switchEditorMode('previewOnly')"><el-icon><View /></el-icon> {{ modeLabels['previewOnly'] }}</div>
        </div>
        <div v-if="modeMenu.visible" class="context-menu-mask" @click="modeMenu.visible = false" @contextmenu.prevent="modeMenu.visible = false"></div>
      </div>
      <div class="note-main">
        <div v-if="loading" class="loading-container"><el-icon class="is-loading"><Loading /></el-icon><span>正在加载笔记...</span></div>
        <div v-else-if="error" class="error-container"><el-alert title="加载失败" :description="error" type="error" show-icon closable /></div>
        <template v-else>
          <div v-show="!filePath" class="welcome-container">
            <div class="welcome-content">
              <div class="welcome-quote primary">他山之石，可以攻玉</div>
              <div class="welcome-quote secondary">合抱之木，生于毫末；九层之台，起于垒土；千里之行，始于足下。</div>
              <div class="welcome-footer">每一次的学习、每一步的成长都值得记录</div>
            </div>
          </div>
          <div v-show="filePath" id="cherry-markdown-container" class="cherry-container"></div>
        <div v-if="filePath" class="editor-close-btn" title="关闭当前文件" @click="handleCloseCurrentFile">
          <el-icon><Close /></el-icon>
        </div>
        </template>
      </div>
    </div>
    <div v-if="rebuilding" class="rebuild-mask">
      <div class="rebuild-panel">
        <div class="rebuild-title">重建资产索引</div>
        <div class="rebuild-progress-row">
          <div class="rebuild-track">
            <div class="rebuild-bar" :style="{ width: rebuildPercent + '%' }"></div>
          </div>
          <span class="rebuild-percent">{{ rebuildPercent }}%</span>
        </div>
        <div class="rebuild-meta">正在处理：{{ rebuildProgress.processed }} / {{ rebuildProgress.total }}</div>
        <div class="rebuild-current" :title="rebuildProgress.current">当前文件：{{ rebuildProgress.current || '扫描文件中...' }}</div>
        <button class="rebuild-cancel" @click="cancelRebuild">取消</button>
      </div>
    </div>
    <div v-if="exporting" class="export-mask">
      <div class="export-panel">
        <el-icon class="export-loading"><Loading /></el-icon>
        <span class="export-text">{{ getExportStatus() }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Cherry from 'cherry-markdown';
import 'cherry-markdown/dist/cherry-markdown.css';
import { files, logs, menus } from 'treasure-sdk';
import { scanMarkdownDirectory, type FileEntry } from './utils/fileScanner';
import { workspace } from './utils/workspace';
import { resolveContextPath } from './utils/contextMenu';
import { clearAssetPreviewCache, readAssetAsObjectUrl, saveAssetForMarkdown } from './utils/assetStorage';
import { createAssetUrlProcessor } from './utils/assetUrlProcessor';
import { replaceRenderedAssetImages } from './utils/assetPreviewFallback';
import { cleanupAssetsBeforeMarkdownDelete, cleanupRemovedAssets } from './utils/assetCleanup';
import { addAssetRef, loadAssetIndex, rebuildAssetIndex, type RebuildProgress, type RebuildSignal } from './utils/assetIndex';
import { exportStatus, exportStageAfterSave } from './utils/exportStatus';
import { calculatePageSlices, measuredBlockStarts } from './utils/exportPagination';
import { canvasSlice } from './utils/exportCanvasSlices';

export default defineComponent({
  name: 'App',
  data() {
    return {
      filePath: '',
      fileContent: '',
      loading: false,
      error: '',
      cherryInstance: null as Cherry | null,
      autoSaveTimer: null as number | null,
      saveDebounceTimer: null as number | null,
      assetPreviewRefreshTimer: null as number | null,
      isDirty: false,
      isSidebarOpen: true,
      dirPath: '',
      fileTree: [] as FileEntry[],
      defaultProps: { children: 'children', label: 'name', isLeaf: (data: FileEntry) => !data.isDirectory },
      contextMenu: { visible: false, x: 0, y: 0, path: '', data: null as FileEntry | null },
      rebuilding: false,
      rebuildProgress: { phase: 'scan', processed: 0, total: 0, current: '' } as RebuildProgress,
      rebuildSignal: null as RebuildSignal | null,
editorMode: 'edit&preview' as 'edit&preview' | 'editOnly' | 'previewOnly',
      modeMenu: { visible: false, x: 0, y: 0 },
      exporting: false,
      exportingType: '' as 'pdf' | 'img' | '',
      exportStage: '',
      menuRegistered: false,
      modeMenuId: 'shi-yu-lu-view',
      exportMenuId: 'shi-yu-lu-export',
      closeFileMenuId: 'shi-yu-lu-close-file',
      assetPreviewFailureKey: '',
      modeItems: [
        { id: 'edit&preview', labelCN: '双栏编辑', labelEN: 'Split' },
        { id: 'editOnly', labelCN: '纯编辑', labelEN: 'Edit Only' },
        { id: 'previewOnly', labelCN: '只读', labelEN: 'Read Only' },
      ],
    };
  },
  computed: {
    rebuildPercent(): number {
      const total = this.rebuildProgress.total;
      if (!total) return this.rebuildProgress.phase === 'scan' ? 0 : 100;
      return Math.min(100, Math.round((this.rebuildProgress.processed / total) * 100));
    },
    modeIcon(): string {
      return { 'edit&preview': 'Notebook', 'editOnly': 'EditPen', 'previewOnly': 'View' }[this.editorMode];
    },
    isChinese(): boolean {
      return navigator.language.startsWith('zh');
    },
    modeLabels(): Record<string, string> {
      const cn = this.isChinese;
      return { 'edit&preview': cn ? '双栏编辑' : 'Split', 'editOnly': cn ? '纯编辑' : 'Edit Only', 'previewOnly': cn ? '只读' : 'Read Only' };
    },
    exportLabels(): Record<string, string> {
      const cn = this.isChinese;
      return { pdf: cn ? '导出为 PDF' : 'Export as PDF', img: cn ? '导出为图片' : 'Export as Image' };
    },
  },
  async created() {
    const isDirSet = await this.checkAndSetDirectory();
    if (!isDirSet) {
      this.error = '未设置文件存储目录，无法加载笔记';
    }
  },
  mounted() {
    document.addEventListener('click', this.closeContextMenu);
    window.addEventListener('keydown', this.handleKeydown);
    this.registerHostMenu();
    window.addEventListener('message', this.handleHostMenuEvent);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeContextMenu);
    window.removeEventListener('keydown', this.handleKeydown);
    this.unregisterHostMenu();
    window.removeEventListener('message', this.handleHostMenuEvent);
    if (this.isDirty) this.saveFile();
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    if (this.assetPreviewRefreshTimer) clearTimeout(this.assetPreviewRefreshTimer);
    clearAssetPreviewCache();
    if (this.cherryInstance) this.cherryInstance.destroy();
  },
  methods: {
    reportAssetPreviewDiagnostic(level: 'debug' | 'error', stage: string, details: Record<string, unknown>) {
      const event = { stage, filePath: this.filePath, ...details };
      (level === 'error' ? console.error : console.debug)('[asset-preview]', event);
      if (level === 'error' || import.meta.env.DEV) {
        void logs.write({ level, category: 'asset-preview', message: stage, details: event }).catch(() => undefined);
      }
      if (level === 'error') {
        const key = `${stage}:${String(details.url || '')}`;
        if (this.assetPreviewFailureKey !== key) {
          this.assetPreviewFailureKey = key;
          ElMessage.error(`图片预览失败（${stage}），请查看宿主日志`);
        }
      }
    },
    toggleSidebar() { this.isSidebarOpen = !this.isSidebarOpen; },
    async ensureAssetIndex(): Promise<boolean> {
      if (!this.dirPath) return false;
      const index = await loadAssetIndex(this.dirPath);
      if (index) return true;
      try {
        await ElMessageBox.confirm('资产索引不存在或已损坏，无法安全判断附件是否仍被其他笔记引用。请先重建资产索引，重建完成后再执行删除操作。', '资产索引不可用', {
          confirmButtonText: '立即重建',
          cancelButtonText: '取消',
          type: 'warning',
        });
        return this.runRebuildAssetIndex(true);
      } catch (e: any) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '资产索引检查失败');
        return false;
      }
    },
    async handleRebuildAssetIndex() {
      if (!this.dirPath) {
        ElMessage.warning('请先设置文件存储目录');
        return;
      }
      await this.runRebuildAssetIndex(true);
    },
    async runRebuildAssetIndex(showSuccess: boolean): Promise<boolean> {
      this.rebuildSignal = { aborted: false };
      this.rebuildProgress = { phase: 'scan', processed: 0, total: 0, current: '' };
      this.rebuilding = true;
      try {
        const result = await rebuildAssetIndex(this.dirPath, progress => { this.rebuildProgress = progress; }, this.rebuildSignal);
        if (this.rebuildSignal.aborted) {
          ElMessage.warning('资产索引重建已取消');
          return false;
        }
        if (showSuccess) ElMessage.success(`资产索引重建完成，共索引 ${result.indexed} 个附件，发现 ${result.orphaned} 个孤立附件`);
        return true;
      } catch (e: any) {
        ElMessage.error(e.message || '资产索引重建失败');
        return false;
      } finally {
        this.rebuilding = false;
        this.rebuildSignal = null;
      }
    },
    cancelRebuild() {
      if (this.rebuildSignal) this.rebuildSignal.aborted = true;
    },
    async loadDirectoryStructure() {
      if (!this.dirPath) return;
      try {
        this.fileTree = await scanMarkdownDirectory(this.dirPath);
      } catch (e) { console.error('Failed to load directory', e); }
    },
    async handleNodeClick(data: FileEntry, node: any) {
      if (!data.isDirectory) {
        if (this.isDirty) await this.saveFile();
        clearAssetPreviewCache();
        this.filePath = data.path;
        await this.loadFile();
      } else {
        node.expanded = !node.expanded;
      }
    },
    async loadFile() {
      if (!this.cherryInstance) this.loading = true;
      try {
        const content = await workspace.readText(this.filePath);
        if (content === null) throw new Error('文件引用已失效或没有访问权限');
        this.fileContent = content;
        this.loading = false;
        if (this.cherryInstance) {
          this.$nextTick(() => {
            if (this.cherryInstance) {
              this.cherryInstance.setMarkdown(this.fileContent);
              this.cherryInstance.switchModel(this.editorMode); // 切换文件时保持用户上次选择的编辑模式
              this.scheduleAssetPreviewFallback();
              window.dispatchEvent(new Event('resize'));
            }
          });
        } else {
          this.$nextTick(() => this.initializeEditor());
        }
      } catch (err: any) {
        this.loading = false;
        this.error = `无法加载文件: ${err.message || '未知错误'}`;
      }
    },
    async refreshAssetPreviewFallback() {
      const container = document.getElementById('cherry-markdown-container');
      if (!container || !this.filePath) return;
      await replaceRenderedAssetImages(
        Array.from(container.querySelectorAll<HTMLImageElement>('img')),
        (url) => readAssetAsObjectUrl(this.dirPath, this.filePath, url),
      );
    },
    scheduleAssetPreviewFallback() {
      if (this.assetPreviewRefreshTimer) clearTimeout(this.assetPreviewRefreshTimer);
      // Cherry debounces asynchronous URL callback re-rendering for one second.
      this.assetPreviewRefreshTimer = window.setTimeout(() => {
        this.assetPreviewRefreshTimer = null;
        void this.refreshAssetPreviewFallback();
      }, 1100);
    },
    scheduleSave() {
      if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = window.setTimeout(() => {
        if (this.isDirty) this.saveFile();
      }, 800);
    },
    initializeEditor() {
      const container = document.getElementById('cherry-markdown-container');
      if (!container || this.cherryInstance) return;
      this.cherryInstance = new Cherry({
        id: 'cherry-markdown-container',
        value: this.fileContent,
        editor: { defaultModel: this.editorMode, contextMenu: false } as any, // Cherry 类型未声明 contextMenu
        toolbars: { theme: 'light', toolbar: ['bold', 'italic', 'strikethrough', '|', 'header', 'list', 'quote', 'table', '|', 'link', 'image', 'code', 'codeTheme', '|', 'undo', 'redo'] },
        callback: {
          urlProcessor: createAssetUrlProcessor(
            (url) => readAssetAsObjectUrl(this.dirPath, this.filePath, url),
            (level, stage, details) => this.reportAssetPreviewDiagnostic(level, stage, details),
          ),
          fileUpload: async (source: File, callback: (url: string, options?: { name?: string }) => void) => {
            try {
              const asset = await saveAssetForMarkdown(this.dirPath, this.filePath, source);
              await addAssetRef(this.dirPath, asset.path, this.filePath);
              callback(asset.markdownUrl, { name: source.name });
              setTimeout(() => {
                this.scheduleAssetPreviewFallback();
                this.saveFile();
              }, 0);
            } catch (e: any) {
              ElMessage.error(e.message || '附件上传失败');
            }
          },
          afterChange: (markdown: string) => {
            if (markdown !== this.fileContent) {
              this.isDirty = true;
              this.scheduleSave();
            }
            this.scheduleAssetPreviewFallback();
          },
          afterInit: () => this.scheduleAssetPreviewFallback(),
        },
      });
      this.autoSaveTimer = window.setInterval(() => { if (this.isDirty) this.saveFile(); }, 30000);
    },
    async saveFile() {
      if (!this.cherryInstance) return;
      try {
        const oldContent = this.fileContent;
        const content = this.cherryInstance.getMarkdown();
        const slash = this.filePath.lastIndexOf('/');
        const saved = await workspace.writeText(slash < 0 ? '' : this.filePath.slice(0, slash), slash < 0 ? this.filePath : this.filePath.slice(slash + 1), content);
        if (!saved) throw new Error('文件引用已失效或没有写入权限');
        try {
          await cleanupRemovedAssets(this.dirPath, this.filePath, oldContent, content);
        } catch (e: any) {
          ElMessage.warning(e.message || '资产索引不可用，请手动重建资产索引');
        }
        this.fileContent = content;
        this.isDirty = false;
      } catch (err: any) {
        console.error('Error saving file:', err);
      }
    },
    async checkAndSetDirectory(): Promise<boolean> {
      try {
        if (await workspace.restore()) {
          this.dirPath = workspace.getRoot()?.name || '工作目录';
          await this.loadDirectoryStructure();
          return true;
        }
        if (!await workspace.choose()) return false;
        this.dirPath = workspace.getRoot()?.name || '工作目录';
        await this.loadDirectoryStructure();
        return true;
      } catch (e: any) {
        console.error('设置存储目录失败:', e);
        return false;
      }
    },
    handleContextMenu(event: MouseEvent, data: any) {
      this.contextMenu.data = data || null;
      // The workspace root is represented by an empty relative path. `dirPath`
      // is only a display label and must never be sent to the SDK as a path.
      this.contextMenu.path = resolveContextPath(data, '');
      this.contextMenu.x = event.clientX;
      this.contextMenu.y = event.clientY;
      this.contextMenu.visible = true;
    },
    closeContextMenu() { this.contextMenu.visible = false; },
    async renderLocally(previewer: HTMLElement, type: 'pdf' | 'img'): Promise<Uint8Array> {
      const clone = previewer.cloneNode(true) as HTMLElement;
      clone.className = clone.className.replace('cherry-previewer--hidden', '');
      const previewStyle = getComputedStyle(previewer);
      clone.style.cssText += ';width:210mm;height:auto;max-height:none';
      clone.style.backgroundColor = previewStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : previewStyle.backgroundColor;
      clone.style.color = previewStyle.color;
      clone.style.font = previewStyle.font;
      clone.style.lineHeight = previewStyle.lineHeight;
      const wrapper = document.createElement('div');
      wrapper.className = 'cherry-export-wrapper';
      const cherryParent = previewer.closest('.cherry');
      if (cherryParent) {
        wrapper.className += ` ${cherryParent.className}`;
        wrapper.style.cssText = cherryParent.getAttribute('style') || '';
        const parentStyle = getComputedStyle(cherryParent);
        for (const property of Array.from(parentStyle)) {
          if (property.startsWith('--')) wrapper.style.setProperty(property, parentStyle.getPropertyValue(property));
        }
      }
      wrapper.appendChild(clone); document.body.appendChild(wrapper);
      try {
        const html2canvas = (await import('html2canvas')).default;
        if (type === 'img') {
          const canvas = await html2canvas(clone, { scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff' });
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('生成图片失败')), 'image/png'));
          return new Uint8Array(await blob.arrayBuffer());
        }
        const { jsPDF } = await import('jspdf'); const pdf = new jsPDF('p', 'mm', 'a4');
        const pageMargin = 10; const pageWidth = pdf.internal.pageSize.getWidth() - pageMargin * 2; const pageHeightMm = pdf.internal.pageSize.getHeight() - pageMargin * 2;
        const bounds = clone.getBoundingClientRect();
        const pageHeightPx = bounds.width * (pageHeightMm / pageWidth);
        const slices = calculatePageSlices(bounds.height, pageHeightPx, measuredBlockStarts(clone));
        const pages = slices.length ? slices : [{ top: 0, height: bounds.height }];
        // Capture once for visual consistency with the current preview, then
        // crop the resulting bitmap at safe Markdown block boundaries.
        const documentCanvas = await html2canvas(clone, { scale: 1.5, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff' });
        const scale = documentCanvas.width / bounds.width;
        for (let index = 0; index < pages.length; index++) {
          const slice = pages[index];
          this.exportStage = `正在处理第 ${index + 1}/${pages.length} 页…`;
          const crop = canvasSlice(slice, scale);
          const pageCanvas = document.createElement('canvas'); pageCanvas.width = documentCanvas.width; pageCanvas.height = crop.height;
          pageCanvas.getContext('2d')!.drawImage(documentCanvas, 0, crop.top, documentCanvas.width, crop.height, 0, 0, documentCanvas.width, crop.height);
          if (index > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', pageMargin, pageMargin, pageWidth, pageHeightMm * (slice.height / pageHeightPx));
        }
        return new Uint8Array(await pdf.output('blob').arrayBuffer());
      } finally { wrapper.remove(); }
    },
    async handleExport(data: FileEntry | null, type: 'pdf' | 'img') {
      console.log('handleExport called', { type, data, hasCherry: !!this.cherryInstance, filePath: this.filePath });
      this.contextMenu.visible = false;
      const targetPath = data ? data.path : this.filePath;
      if (!targetPath) { ElMessage.warning('未指定导出文件'); return; }
      this.exporting = true;
      this.exportingType = type;
      this.exportStage = exportStageAfterSave(false);
      try {
        if (targetPath !== this.filePath || !this.cherryInstance) {
          if (this.isDirty) await this.saveFile();
          this.filePath = targetPath;
          await this.loadFile();
          await new Promise(r => setTimeout(r, 300));
        }
        if (!this.cherryInstance) { ElMessage.warning('编辑器未就绪，无法导出'); return; }
        const rawName = data ? data.name : (targetPath.split('/').pop() || 'export');
        const fileName = rawName.replace(/\.(md|markdown)$/i, '');
        const destination = await files.saveDialog({ title: type === 'pdf' ? '导出 PDF' : '导出图片', defaultFileName: `${fileName}.${type === 'pdf' ? 'pdf' : 'png'}`, filters: [{ name: type === 'pdf' ? 'PDF 文档' : 'PNG 图片', extensions: [type === 'pdf' ? 'pdf' : 'png'] }] });
        if (!destination.ok) return;
        const previewer = document.querySelector('.cherry-previewer') as HTMLElement | null;
        if (!previewer) throw new Error('预览区域未就绪，无法导出');
        this.exportStage = exportStageAfterSave(true);
        const rendered = await this.renderLocally(previewer, type);
        this.exportStage = '正在保存文件…';
        const output = await files.writeFile({ file: destination.value, data: rendered });
        if (!output.ok) throw new Error(output.error.message);
        this.exportStage = type === 'pdf' ? 'PDF 导出完成' : '图片导出完成';
        ElMessage.success(`${type === 'pdf' ? 'PDF' : '图片'} 已保存`);
      } catch (e: any) { ElMessage.error(e.message || '导出失败'); }
      finally {
        this.exporting = false;
        this.exportingType = '';
        this.exportStage = '';
      }
    },
    getExportStatus() { return exportStatus(this.exportStage, this.exportingType); },
    handleKeydown(e: KeyboardEvent) {
      // Cmd/Ctrl + S 保存快捷键，防止浏览器默认保存对话框弹出
      const isSave = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
      if (!isSave || !this.filePath || !this.cherryInstance) return;
      e.preventDefault();
      if (this.isDirty) this.saveFile().then(() => ElMessage.success('已保存'));
      else ElMessage.info('内容已是最新');
    },
    async handleCloseCurrentFile() {
      if (this.isDirty) await this.saveFile();
      clearAssetPreviewCache();
      this.filePath = ''; this.fileContent = ''; this.isDirty = false;
      if (this.cherryInstance) this.cherryInstance.setMarkdown('');
    },
    toggleModeMenu(event: MouseEvent) {
      if (!this.filePath && !this.cherryInstance) { ElMessage.warning('请先打开一个文件'); return; }
      this.modeMenu.x = event.clientX; this.modeMenu.y = event.clientY; this.modeMenu.visible = true;
    },
    switchEditorMode(mode: 'edit&preview' | 'editOnly' | 'previewOnly') {
      // 切换编辑模式：更新状态 → 调用 Cherry API → 触发 resize → 同步原生菜单勾选
      this.modeMenu.visible = false;
      this.editorMode = mode;
      if (this.cherryInstance) {
        this.cherryInstance.switchModel(mode);
        // Cherry 的 switchModel('edit&preview') 内部：editOnly() 会覆盖 cached layout 为 100/0，
        // 导致 recoverPreviewer() 恢复时预览区宽度不对。强制重置为 50/50。
        if (mode === 'edit&preview') {
          const pw = (this.cherryInstance as any).previewer;
          if (pw?.editor?.options?.editorDom && pw?.options?.previewerDom) {
            pw.options.previewerCache = { layout: { editorPercentage: '50%', previewerPercentage: '50%' } };
            pw.editor.options.editorDom.style.width = '50%';
            pw.options.previewerDom.style.width = '50%';
            pw.syncVirtualLayoutFromReal?.();
          }
        }
        // 双 rAF 确保 Cherry 完成 DOM 过渡后重新计算 flex 比例
        requestAnimationFrame(() => requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
        }));
      }
      this.syncMenuState();
    },
    async registerHostMenu() {
      try {
        const modeReg = { menuId: this.modeMenuId, rootLabel: 'View', submenuLabel: 'Mode', items: this.modeItems.map(it => ({
          id: it.id, label: it.labelEN, type: 'check' as const, checked: it.id === this.editorMode,
        })) };
        const exportReg = { menuId: this.exportMenuId, rootLabel: 'File', submenuLabel: 'Export', items: [
          { id: 'pdf', label: 'Export as PDF', type: 'normal' as const },
          { id: 'img', label: 'Export as Image', type: 'normal' as const },
        ]};
        const closeFileReg = { menuId: this.closeFileMenuId, rootLabel: 'File', items: [
          { id: 'close', label: 'Close Current File', type: 'normal' as const },
        ]};
        // 注册顺序决定菜单在 File 下的排列顺序：Close Current File 放在 Export 之前
        await menus.register(closeFileReg);
        await menus.register(exportReg);
        await menus.register(modeReg);
        this.menuRegistered = true;
      } catch (e) { /* 静默 */ }
    },
    async unregisterHostMenu() {
      if (!this.menuRegistered) return;
      try {
        await menus.unregister(this.modeMenuId);
        await menus.unregister(this.exportMenuId);
        await menus.unregister(this.closeFileMenuId);
        this.menuRegistered = false;
      } catch (e) { /* 静默 */ }
    },
    async syncMenuState() {
      if (!this.menuRegistered) return;
      try {
        const modeReg = { menuId: this.modeMenuId, rootLabel: 'View', submenuLabel: 'Mode', items: this.modeItems.map(it => ({
          id: it.id, label: it.labelEN, type: 'check' as const, checked: it.id === this.editorMode,
        })) };
        await menus.register(modeReg);
      } catch (e) { /* 静默 */ }
    },
    handleHostMenuEvent(event: MessageEvent) {
      const d = event.data;
      if (!d || d.type !== 'treasure-menu-event') return;
      if (d.menuId === this.modeMenuId) {
        const mode = d.itemId as 'edit&preview' | 'editOnly' | 'previewOnly';
        if (['edit&preview','editOnly','previewOnly'].includes(mode)) this.switchEditorMode(mode);
      } else if (d.menuId === this.exportMenuId) {
        this.handleExport(null, d.itemId as 'pdf' | 'img');
      } else if (d.menuId === this.closeFileMenuId) {
        this.handleCloseCurrentFile();
      }
    },
    async handleCreateFile(parentPath: string) {
      this.closeContextMenu();
      if (!parentPath) parentPath = '';
      try {
        const { value } = await ElMessageBox.prompt('请输入文件名 (.md)', '新建文件', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          inputPattern: /\S+/,
          inputErrorMessage: '文件名不能为空',
        });
        let name = value;
        if (!name.endsWith('.md') && !name.endsWith('.markdown')) name += '.md';
        if (!await workspace.writeText(parentPath, name, '')) {
          ElMessage.error(`创建文件失败：${workspace.getLastError() || '未知错误'}`);
          return;
        }
        await this.loadDirectoryStructure();
      } catch (e: any) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '创建文件失败');
      }
    },
    async handleCreateFolder(parentPath: string) {
      this.closeContextMenu();
      if (!parentPath) parentPath = '';
      try {
        const { value } = await ElMessageBox.prompt('请输入文件夹名', '新建文件夹', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          inputPattern: /\S+/,
          inputErrorMessage: '文件夹名不能为空',
        });
        if (!await workspace.createDirectory(parentPath, value)) {
          ElMessage.error('创建文件夹失败');
          return;
        }
        await this.loadDirectoryStructure();
      } catch (e: any) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '创建文件夹失败');
      }
    },
    async handleDelete(data: FileEntry) {
      this.closeContextMenu();
      if (!data || !data.path) return;
      const msg = data.isDirectory
        ? `确定要删除 "${data.name}" 及其所有内容吗？此操作不可恢复。`
        : `确定要删除 "${data.name}" 吗？`;
      try {
        await ElMessageBox.confirm(msg, '删除确认', {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
        });
        if (!data.isDirectory && (data.name.toLowerCase().endsWith('.md') || data.name.toLowerCase().endsWith('.markdown'))) {
          const indexReady = await this.ensureAssetIndex();
          if (!indexReady) return;
          await cleanupAssetsBeforeMarkdownDelete(this.dirPath, data.path);
        }
        if (!await workspace.remove(data.path)) {
          ElMessage.error('删除失败');
          return;
        }
        await this.loadDirectoryStructure();
        if (this.filePath === data.path) {
          this.fileContent = '';
          this.filePath = '';
          if (this.cherryInstance) this.cherryInstance.setMarkdown('');
        }
      } catch (e: any) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '删除失败');
      }
    },
  },
});
</script>

<style>
.note-container {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  color: #4b4257;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 226, 188, 0.90) 0, transparent 36%),
    radial-gradient(circle at 50% 8%, rgba(182, 156, 255, 0.36) 0, transparent 36%),
    radial-gradient(circle at 86% 18%, rgba(218, 232, 255, 0.95) 0, transparent 32%),
    radial-gradient(circle at 10% 90%, rgba(182, 156, 255, 0.42) 0, transparent 34%),
    radial-gradient(circle at 90% 86%, rgba(232, 201, 138, 0.40) 0, transparent 32%),
    linear-gradient(135deg, #fff7ea 0%, #f7f2ff 46%, #eef7ff 100%);
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.note-card {
  width: calc(100% - 32px);
  height: calc(100% - 32px);
  margin: 16px;
  background: transparent;
  border: 0;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.14);
  backdrop-filter: blur(22px);
  display: flex;
  overflow: hidden;
}

.note-sidebar {
  width: 282px;
  display: flex;
  flex-direction: column;
  transition: width 0.3s, opacity 0.3s;
  flex-shrink: 0;
  position: relative;
  border-right: 1px solid rgba(126, 108, 87, 0.08);
}

.note-sidebar.is-collapsed {
  width: 8px;
  opacity: 0.72;
}

.sidebar-header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: transparent;
  border-bottom: 1px solid rgba(154, 132, 189, 0.14);
  box-shadow: 0 4px 16px rgba(154, 132, 189, 0.06);
}

.sidebar-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6d5b7f;
}

.sidebar-title::after {
  content: "";
  display: block;
  width: 34px;
  height: 3px;
  margin-top: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ffb978, #b69cff);
}

.toggle-icon {
  cursor: pointer;
  position: absolute;
  right: -16px;
  top: 8px;
  z-index: 100;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b6fb2;
  background: rgba(255, 255, 255, 0.22);
  border: 0;
  border-radius: 999px;
  box-shadow: 0 10px 26px rgba(122, 96, 77, 0.16);
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
}

.note-sidebar:hover .toggle-icon {
  opacity: 1;
}

.toggle-icon:hover {
  transform: translateY(-1px) scale(1.04);
}

.sidebar-content {
  flex: 1;
  display: flex !important;
  align-items: flex-start !important;
  font-family: monospace;
  line-height: 1.4;
  height: 100%;
  width: 100%;
  position: relative;
  z-index: 0;
  overflow: hidden;
  overflow-anchor: none;
  padding: 14px 0px 20px 12px;
  color: #5c5347;
  background: transparent;
}

.sidebar-content .el-tree {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: transparent;
  color: #5c5347;
}
.sidebar-content .el-tree::-webkit-scrollbar {
  width: 7px;
}
.sidebar-content .el-tree::-webkit-scrollbar:hover {
  background-color: rgba(128,128,128,0.1);
}
.sidebar-content .el-tree::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-content .el-tree::-webkit-scrollbar-thumb {
  background-color: #d3d7da;
  border-radius: 4px;
}
.sidebar-content .el-tree::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0,0,0,0.6); /* todo */
}

.sidebar-content .el-tree-node__content {
  width: 246px;
  height: 38px;
  margin: 4px 0;
  border-radius: 16px;
  color: #5c5347;
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
}

.sidebar-content .el-tree-node__content:hover {
  background: rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 14px rgba(154, 132, 189, 0.14);
  transform: translateX(2px);
}

.sidebar-content .el-tree .el-tree-node.is-current > .el-tree-node__content,
.sidebar-content .el-tree .el-tree-node:focus > .el-tree-node__content,
.sidebar-content .el-tree .el-tree-node.is-current:focus > .el-tree-node__content {
  background: rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(154, 132, 189, 0.30), 0 6px 20px rgba(154, 132, 189, 0.10);
}

.sidebar-content .el-tree-node__expand-icon {
  width: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
}

.custom-tree-node {
  display: flex;
  align-items: center;
  font-size: 13px;
  width: 100%;
  padding-right: 10px;
}

.node-content {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.node-actions {
  display: none;
  align-items: center;
  gap: 6px;
}

.custom-tree-node:hover .node-actions {
  display: flex;
}

.action-icon {
  width: 18px;
  height: 18px;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  color: #9a84bd;
  border-radius: 999px;
  transition: background 0.2s, color 0.2s;
}

.action-icon:hover {
  color: #7656a7;
  background: rgba(255, 255, 255, 0.7);
}

.delete-icon:hover {
  color: #d36c6c;
}

.tree-icon {
  margin-right: 8px;
  font-size: 16px;
  color: #b190d5;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-tree {
  margin: 16px;
  padding: 24px 16px;
  text-align: center;
  color: #9a8fa7;
  background: rgba(255, 255, 255, 0.48);
  border: 1px dashed rgba(154, 132, 189, 0.28);
  border-radius: 22px;
}

.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 148px;
  padding: 8px;
  color: #594b68;
  background: rgba(235, 230, 245, 0.90);
  border: 1px solid rgba(154, 132, 189, 0.40);
  border-radius: 18px;
  box-shadow: 0 22px 44px rgba(96, 74, 110, 0.18);
  backdrop-filter: blur(18px);
}

.context-menu .menu-item {
  padding: 10px 12px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
}

.context-menu .menu-item .el-icon {
  width: 18px;
  height: 18px;
  font-size: 18px;
}

.context-menu .menu-item:hover {
  background: linear-gradient(135deg, rgba(255, 198, 135, 0.45), rgba(188, 169, 255, 0.45));
}

.context-menu-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1999;
  background: transparent;
}

.menu-item.has-submenu { position: relative; }
/* No horizontal gap: the pointer travels from the parent straight into the child menu. */
.menu-item.has-submenu > .submenu { display: none; position: absolute; left: 100%; top: -8px; z-index: 2002; min-width: 148px; padding: 8px; color: #594b68; background: rgba(235, 230, 245, 0.90); border: 1px solid rgba(154, 132, 189, 0.40); border-radius: 18px; box-shadow: 0 22px 44px rgba(96, 74, 110, 0.18); backdrop-filter: blur(18px); }
.menu-item.has-submenu:hover > .submenu { display: block; }
.menu-item.has-submenu > .submenu-arrow { position: absolute; right: 0px; top: 50%; transform: translateY(-50%); font-size: 18px; font-weight: 700; pointer-events: none; }

.editor-close-btn { position: absolute; top: 9px; right: 3px; z-index: 1200; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #655b4f; border-radius: 0; background: transparent; border: 0; box-shadow: none; transition: background .2s, color .2s, transform .2s; }
.editor-close-btn:hover { color: #d36c6c; background: transparent; transform: scale(1.06); }
.editor-close-btn .el-icon { width: 18px; height: 18px; font-size: 18px; }

.mode-trigger { margin-left: 8px; width: 28px; height: 28px; font-size: 16px; cursor: pointer; color: #9a84bd; border-radius: 999px; display: flex; align-items: center; justify-content: center; transition: background .2s, color .2s, transform .2s; }
.mode-trigger:hover { color: #7656a7; background: rgba(255,255,255,0.22); transform: rotate(8deg); }
.mode-menu { position: fixed; z-index: 2000; min-width: 148px; padding: 8px; color: #594b68; background: rgba(235,230,245,0.90); border: 1px solid rgba(154,132,189,0.40); border-radius: 18px; box-shadow: 0 22px 44px rgba(96,74,110,0.18); backdrop-filter: blur(18px); }
.mode-menu .menu-item { cursor: pointer; }
.mode-menu .menu-item:hover { background: linear-gradient(135deg, rgba(255,198,135,0.45), rgba(188,169,255,0.45)); }
.mode-menu .menu-item.active { background: linear-gradient(135deg, rgba(255,198,135,0.55), rgba(188,169,255,0.55)); font-weight: 600; }

.note-main {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #806f91;
}

.error-container {
  padding: 24px;
}

.cherry-container {
  width: 100%;
  height: 100%;
  flex: 1;
  overflow: hidden;
}

.cherry-container .cherry,
.cherry-container .cherry-editor,
.cherry-container .cherry-previewer,
.cherry-container .cherry-previewer .cherry-markdown {
  background: transparent;
}

.cherry-container .cherry {
  border: 0;
  color: #554d43;
}

.cherry-container .cherry-toolbar {
  background: transparent;
  border-bottom: 1px solid rgba(143, 121, 91, 0.16);
}

.cherry-container .cherry-toolbar,
.cherry-container .cherry-toolbar button,
.cherry-container .cherry-toolbar i,
.cherry-container .cherry-toolbar .cherry-toolbar-button,
.cherry-container .cherry-toolbar .ch-icon {
  color: #655b4f;
}

.cherry-container .cherry-toolbar button:hover,
.cherry-container .cherry-toolbar .cherry-toolbar-button:hover {
  background: rgba(214, 198, 174, 0.62);
  color: #4f463b;
}

.cherry-container .cm-editor,
.cherry-container .cm-scroller,
.cherry-container .cm-content,
.cherry-container .cm-line,
.cherry-container .cm-gutters {
  color: #554d43;
  background: transparent;
}

.cherry-container .cm-gutters {
  color: #9a8e7e;
  border-right: 1px solid rgba(143, 121, 91, 0.14);
}

.cherry-container .cm-activeLine,
.cherry-container .cm-activeLineGutter {
  background: rgba(154, 132, 189, 0.18);
}

.cherry-container .cm-selectionBackground,
.cherry-container .cm-content ::selection {
  background: rgba(191, 172, 139, 0.38) !important;
}

.cherry-container .cherry-previewer {
  color: #554d43;
  line-height: 1.82;
  background: transparent;
}

.cherry-container .cherry-markdown .toc {
  background: rgba(255, 255, 255, 0.48);
  border-color: rgba(154, 132, 189, 0.24);
}

.cherry-container .cherry-markdown .toc .toc-li {
  border-left-color: rgba(154, 132, 189, 0.32);
}

.cherry-container .cherry-markdown .toc .toc-li a:hover {
  background-color: rgba(154, 132, 189, 0.10);
}

.cherry-container .cherry-markdown .toc .toc-li a:active {
  background-color: rgba(154, 132, 189, 0.18);
}

.cherry-container .cherry-previewer h1,
.cherry-container .cherry-previewer h2,
.cherry-container .cherry-previewer h3,
.cherry-container .cherry-previewer h4,
.cherry-container .cherry-previewer h5,
.cherry-container .cherry-previewer h6 {
  color: #4f463b;
}

.cherry-container .cherry-previewer blockquote,
.cherry-container .cherry-previewer code,
.cherry-container .cherry-previewer pre {
  color: #5c5347;
  background: rgba(154, 132, 189, 0.12);
  border-color: rgba(143, 121, 91, 0.18);
}

.cherry-container .cherry-previewer .cherry-table th {
  background-color: rgba(232, 201, 138, 0.24);
}

[data-code-block-theme=default] div[data-type=codeBlock] pre[class*=language-] {
  background: rgba(75, 66, 87, 0.06);
}

div[data-type=codeBlock] pre[class*=language-] {
  border-radius: 10px;
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-copy-code-block,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-edit-code-block {
  background-color: rgba(154, 132, 189, 0.16);
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-code-preview-lang-select {
  background-color: rgba(154, 132, 189, 0.16);
}

.cherry-container .cherry-previewer-codeBlock-hover-handler {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: center !important;
  gap: 6px;
  margin-top: -20px !important;
  padding-top: 28px !important;
  width: 100%;
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-expand-code-block {
  top: 10px !important;
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-code-preview-lang-select,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-edit-code-block,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-copy-code-block {
  float: none !important;
  position: static !important;
  top: auto !important;
  right: auto !important;
  height: 18px;
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-edit-code-block,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-copy-code-block {
  width: 18px;
  border-radius: 4px;
  font-size: 10px;
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-code-preview-lang-select {
  height: 18px;
  padding: 2px 28px 2px 8px;
  font-size: 10px;
  border-radius: 4px;
  background-size: 10px 10px;
  background-position: right 8px center;
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-copy-code-block,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-edit-code-block,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-code-preview-lang-select {
  border-color: rgba(143, 121, 91, 0.25);
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-code-block-custom-btn:hover,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-copy-code-block:hover,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-expand-code-block:hover,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-unExpand-code-block:hover,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-edit-code-block:hover {
  color: #7656a7;
  background-color: rgba(154, 132, 189, 0.32);
  border-color: transparent;
  transform: translateY(-2px);
}

.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-code-block-custom-btn:active,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-copy-code-block:active,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-expand-code-block:active,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-unExpand-code-block:active,
.cherry-container .cherry-previewer-codeBlock-hover-handler .cherry-edit-code-block:active {
  color: #7656a7;
  transform: translateY(0);
  box-shadow: none;
  background-color: rgba(154, 132, 189, 0.42);
  transition-duration: 0.1s;
}

.cherry-container .cherry .cm-editor .cm-gutter {
  background-color: transparent;
  border-right-color: rgba(143, 121, 91, 0.25);
}

.cherry-container .cherry-previewer-codeBlock-click-handler .cm-editor {
  background: rgba(75, 66, 87, 0.08);
  box-shadow: 0 8px 32px rgba(75, 66, 87, 0.18);
  border: 2px solid rgba(154, 132, 189, 0.35);
  border-radius: 8px;
}

.cherry-container .cherry-previewer-codeBlock-click-handler .cm-editor .cm-gutters {
  background-color: transparent;
  border-right-color: rgba(143, 121, 91, 0.25);
}

.cherry-container .cherry-previewer-codeBlock-content-handler__input {
  background: rgba(245, 239, 228, 0.92);
}

.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-editor,
.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-scroller,
.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-content,
.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-line,
.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-gutters,
.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-gutter {
  color: #554d43;
  background: transparent;
}

.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-activeLine,
.cherry-container .cherry-previewer-codeBlock-content-handler__input .cm-activeLineGutter {
  background: rgba(154, 132, 189, 0.22);
}

.welcome-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  position: relative;
  overflow: hidden;
}

.welcome-container::before {
  content: "";
  position: absolute;
  width: 360px;
  height: 360px;
  right: 10%;
  top: 8%;
  background: radial-gradient(circle, rgba(255, 190, 126, 0.24), transparent 66%);
  filter: blur(4px);
}

.welcome-content {
  text-align: center;
  max-width: 820px;
  position: relative;
  z-index: 1;
}

.welcome-quote {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.8;
  color: #554861;
}

.welcome-quote.primary {
  font-size: 34px;
  font-weight: 300;
  margin-bottom: 28px;
  letter-spacing: 0.14em;
}

.welcome-quote.secondary {
  font-size: 18px;
  margin-bottom: 58px;
  font-weight: 300;
  color: #756982;
}

.welcome-footer {
  display: inline-block;
  font-size: 14px;
  color: #9b8ca9;
  border-top: 1px solid rgba(126, 108, 87, 0.12);
  padding-top: 20px;
  margin-top: 20px;
}

.rebuild-entry {
  margin-left: auto;
  width: 28px;
  height: 28px;
  font-size: 16px;
  cursor: pointer;
  color: #9a84bd;
  border-radius: 999px;
  transition: background 0.2s, color 0.2s, transform 0.2s;
}

.rebuild-entry:hover {
  color: #7656a7;
  background: transparent;
  transform: rotate(18deg);
}

.rebuild-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(75, 66, 87, 0.16);
  /* A native save sheet remains crisp while this phase indicator is visible. */
  backdrop-filter: none;
  pointer-events: none;
}

.rebuild-panel {
  width: 420px;
  padding: 28px;
  color: #4b4257;
  background: rgba(243, 236, 223, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 22px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.14);
}

.rebuild-title {
  margin-bottom: 22px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6d5b7f;
}

.rebuild-progress-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.rebuild-track {
  flex: 1;
  height: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.58);
  border-radius: 999px;
}

.rebuild-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffb978, #b69cff);
  border-radius: 999px;
  transition: width 0.2s ease;
}

.rebuild-percent {
  width: 42px;
  font-size: 14px;
  font-weight: 700;
  color: #6d5b7f;
  text-align: right;
}

.rebuild-meta,
.rebuild-current {
  margin-top: 8px;
  font-size: 13px;
  color: #756982;
}

.rebuild-current {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rebuild-cancel {
  margin-top: 22px;
  padding: 8px 18px;
  color: #7656a7;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(154, 132, 189, 0.28);
  border-radius: 999px;
  transition: background 0.2s, transform 0.2s;
}

.rebuild-cancel:hover {
  background: rgba(255, 255, 255, 0.82);
  transform: translateY(-1px);
}

.export-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(75, 66, 87, 0.16);
  backdrop-filter: blur(8px);
}

.export-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px 36px;
  color: #4b4257;
  background: rgba(243, 236, 223, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 22px;
  box-shadow: 0 24px 60px rgba(122, 96, 77, 0.14);
}

.export-loading {
  font-size: 28px;
  color: #b69cff;
}

.export-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* 导出时克隆的预览元素：移出视口以避免出现滚动条和视觉干扰 */
.cherry-export-wrapper {
  position: fixed;
  left: -9999px;
  top: 0;
  z-index: -1;
}

</style>
