import { computed, onUnmounted, ref, shallowRef } from 'vue';
import { directories, files, permissions, settings, type DirectoryReference, type FileReference } from '@luzenrocy/treasure-sdk';
import { cloneWorkbook, findNode, makeEditableCopy, newWorkbook, outlineForSheet, type Workbook } from './domain';
import { decodeWorkbook, encodeWorkbook, OPEN_FILTERS } from './format';
import { parseSmm, parseXmind } from './external';

export interface Dialog {
  title: string;
  message: string;
  fileName?: string;
  confirmText?: string;
  danger?: boolean;
  confirm: (fileName?: string) => void | Promise<void>;
  secondary?: () => void;
}
interface HistoryEntry { book: Workbook; revision: number; sheetId: string }
const WORKSPACE_KEY = 'workspace_dir';
const DIRECTORY_EXPIRED = '工作目录授权已失效，请重新授权或选择其他目录。已打开的内容会保留。';
// Older hosts require settings.set before granting a different directory.
const LEGACY_DIRECTORY_MISMATCH = '目录设置与待授权目录不一致，请重新选择目录';
const LEGACY_EXPIRED_GRANT = '目录授权不存在、已撤销或引用已过期';

export function useWorkbook(initial?: Workbook) {
  const workbook = ref<Workbook>(cloneWorkbook(initial ?? newWorkbook()));
  const hasDocument = ref(true), mode = ref<'editable' | 'external'>('editable');
  const target = shallowRef<FileReference | null>(null), directory = shallowRef<DirectoryReference | null>(null);
  const directoryName = ref(''), directoryError = ref('');
  const directoryFiles = shallowRef<{ name: string; file: FileReference }[]>([]);
  let saveDestination: DirectoryReference | null = null;
  let directoryGrantId: string | undefined;
  let selectingDirectory = false;
  const activeSheetId = ref(workbook.value.sheets[0].id), selectedNodeId = ref<string | null>(null);
  const revision = ref(0), savedRevision = ref(0);
  const undoStack = ref<HistoryEntry[]>([]), redoStack = ref<HistoryEntry[]>([]);
  const busy = ref<'opening' | 'saving' | 'deleting' | null>(null);
  const dialog = ref<Dialog | null>(null), dialogError = ref(''), notice = ref('');
  let sequence = 0, noticeTimer: ReturnType<typeof setTimeout> | undefined;
  const currentSheet = computed(() => workbook.value.sheets.find((sheet) => sheet.id === activeSheetId.value) ?? workbook.value.sheets[0]);
  const selectedNode = computed(() => selectedNodeId.value ? findNode(currentSheet.value.root, selectedNodeId.value) : undefined);
  const dirty = computed(() => hasDocument.value && mode.value === 'editable' && revision.value !== savedRevision.value);
  const fileName = computed(() => mode.value === 'external' ? workbook.value.source?.name ?? workbook.value.title : workbook.value.title.replace(/\.gxp$/i, '') + '.gxp');
  const outlineItems = computed(() => hasDocument.value ? outlineForSheet(currentSheet.value) : []);

  function show(message: string) {
    notice.value = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.value = ''; }, 3200);
  }
  onUnmounted(() => clearTimeout(noticeTimer));
  function historyEntry(): HistoryEntry { return { book: cloneWorkbook(workbook.value), revision: revision.value, sheetId: activeSheetId.value }; }
  function change(mutate: () => void): boolean {
    if (!hasDocument.value || mode.value === 'external' || busy.value) return false;
    undoStack.value.push(historyEntry());
    if (undoStack.value.length > 60) undoStack.value.shift();
    redoStack.value = [];
    mutate(); revision.value = ++sequence;
    return true;
  }
  function history(direction: 'undo' | 'redo') {
    if (mode.value === 'external' || busy.value) return;
    const source = direction === 'undo' ? undoStack : redoStack, destination = direction === 'undo' ? redoStack : undoStack;
    const entry = source.value.pop();
    if (!entry) return;
    destination.value.push(historyEntry());
    workbook.value = entry.book; revision.value = entry.revision; activeSheetId.value = entry.sheetId;
    if (selectedNodeId.value && !findNode(currentSheet.value.root, selectedNodeId.value)) selectedNodeId.value = null;
  }
  function replace(book: Workbook, nextMode: 'editable' | 'external', file: FileReference | null, destination: DirectoryReference | null = null) {
    workbook.value = book; mode.value = nextMode; target.value = file; hasDocument.value = true;
    saveDestination = destination;
    activeSheetId.value = book.sheets[0].id; selectedNodeId.value = null;
    undoStack.value = []; redoStack.value = []; sequence = 0; revision.value = 0; savedRevision.value = 0;
  }
  function confirmLeave(next: () => void | Promise<void>, action: string, saveCopy = false) {
    if (busy.value) return;
    if (!dirty.value) { void next(); return; }
    dialogError.value = '';
    dialog.value = {
      title: '未保存的更改', message: `要保存对《${fileName.value}》的更改吗？保存完成后${action}。`,
      fileName: needsSaveName(saveCopy) ? suggestedName(saveCopy) : undefined,
      confirmText: saveCopy ? '另存副本后继续' : '保存并继续',
      confirm: async (name) => { if (await save(saveCopy, name)) { dialog.value = null; await next(); } },
      secondary: () => { dialog.value = null; void next(); },
    };
  }
  async function newDocument(name: string, layout: Workbook['sheets'][number]['layout']): Promise<boolean> {
    const book = newWorkbook();
    book.sheets[0].layout = layout;
    return saveNewWorkspaceFile(book, name, '思维导图已创建。');
  }
  function closeDocument() {
    confirmLeave(() => { hasDocument.value = false; selectedNodeId.value = null; }, '关闭当前文件');
  }
  function report(message: string) { if (dialog.value) dialogError.value = message; else show(message); }

  function setDirectory(reference: DirectoryReference, grantId: string) {
    if (grantId === directoryGrantId && directory.value && saveDestination === directory.value) {
      saveDestination = reference;
    }
    directoryGrantId = grantId;
    directory.value = reference;
    directoryName.value = reference.name;
    directoryFiles.value = [];
  }

  function invalidateDirectory() {
    directory.value = null;
    directoryName.value = '';
    directoryGrantId = undefined;
    directoryFiles.value = [];
    directoryError.value = DIRECTORY_EXPIRED;
  }

  function isExpired(code: string) {
    return code === 'GRANT_NOT_FOUND' || code === 'REFERENCE_EXPIRED';
  }

  async function refreshDirectory(retry = true): Promise<boolean> {
    const requested = directory.value;
    if (!requested) return false;
    const result = await directories.list(requested);
    if (directory.value !== requested) return false;
    if (!result.ok) {
      if (isExpired(result.error.code)) {
        if (retry) return restoreDirectory(requested);
        invalidateDirectory();
      } else {
        directoryError.value = result.error.message;
      }
      return false;
    }
    directoryError.value = '';
    directoryFiles.value = result.value.filter((entry) => entry.kind === 'file' && entry.name.toLowerCase().endsWith('.gxp') && entry.file)
      .map((entry) => ({ name: entry.name, file: entry.file! }));
    return true;
  }
  async function chooseDirectory(): Promise<boolean> {
    if (selectingDirectory) return false;
    selectingDirectory = true;
    try {
      const picked = await files.openDialog({ kind: 'directory', title: '选择观象谱工作目录' });
      if (!picked.ok) {
        if (picked.error.code !== 'CANCELLED') directoryError.value = picked.error.message;
        return false;
      }
      if (Array.isArray(picked.value)) return false;
      const directory = picked.value;
      let granted = await permissions.grantDirectory({ permissionKey: WORKSPACE_KEY, directory });
      if (!granted.ok && granted.error.message === LEGACY_DIRECTORY_MISMATCH) {
        const configured = await settings.set({ key: WORKSPACE_KEY, directory });
        if (!configured.ok) {
          directoryError.value = configured.error.message;
          return false;
        }
        granted = await permissions.grantDirectory({ permissionKey: WORKSPACE_KEY, directory });
      }
      if (!granted.ok) {
        directoryError.value = granted.error.message;
        return false;
      }
      setDirectory(granted.value.directory, granted.value.accessGrantId);
      return await refreshDirectory(false);
    } finally {
      selectingDirectory = false;
    }
  }
  async function restoreDirectory(expected = directory.value): Promise<boolean> {
    const saved = await settings.get(WORKSPACE_KEY);
    if (directory.value !== expected) return false;
    if (!saved.ok) {
      directoryError.value = saved.error.message;
      return false;
    }
    if (saved.value.paramType !== 'dir' || !saved.value.accessGrantId || !saved.value.pathHash) {
      if (expected || saved.value.paramType === 'dir' && saved.value.directoryName) invalidateDirectory();
      return false;
    }
    const verified = await permissions.verifyDirectoryGrant({ permissionKey: WORKSPACE_KEY, accessGrantId: saved.value.accessGrantId, pathHash: saved.value.pathHash });
    if (directory.value !== expected) return false;
    if (!verified.ok) {
      const { code, message } = verified.error;
      if (isExpired(code) || code === 'PERMISSION_DENIED' || code === 'INTERNAL' && message === LEGACY_EXPIRED_GRANT) {
        invalidateDirectory();
      } else {
        directoryError.value = message;
      }
      return false;
    }
    setDirectory(verified.value.directory, verified.value.accessGrantId);
    return refreshDirectory(false);
  }
  async function loadFile(file: FileReference, fromDirectory: DirectoryReference | null = null) {
    if (busy.value) return;
    busy.value = 'opening';
    try {
      const read = await files.readFile(file);
      if (!read.ok) { show(read.error.message); return; }
      const name = file.name.toLowerCase();
      if (name.endsWith('.gxp')) replace(decodeWorkbook(read.value), 'editable', file, fromDirectory);
      else if (name.endsWith('.smm')) replace(parseSmm(read.value, file.name), 'external', null);
      else if (name.endsWith('.xmind')) replace(await parseXmind(read.value, file.name), 'external', null);
      else show('请选择 .gxp、.smm 或 .xmind 文件。');
    } catch (error) { show(error instanceof Error ? error.message : '文件无法打开。'); }
    finally { busy.value = null; }
  }
  function openFile() {
    confirmLeave(async () => {
      const picked = await files.openDialog({ kind: 'file', title: '打开导图文件', filters: OPEN_FILTERS });
      if (!picked.ok) { if (picked.error.code !== 'CANCELLED') show(picked.error.message); return; }
      if (Array.isArray(picked.value) && picked.value[0]) await loadFile(picked.value[0]);
    }, '打开另一个文件');
  }
  function openExisting(file: FileReference) {
    const fromDirectory = directory.value;
    confirmLeave(() => loadFile(file, fromDirectory), `打开《${file.name}》`);
  }

  function isWorkspaceTarget(file: FileReference) {
    return target.value?.id === file.id || !!directory.value && saveDestination === directory.value && target.value?.name === file.name;
  }

  function needsSaveName(asCopy: boolean) {
    return asCopy || !target.value || !saveDestination || saveDestination !== directory.value;
  }

  function suggestedName(asCopy: boolean) {
    const title = fileName.value.replace(/\.gxp$/i, '');
    return asCopy ? title + ' 副本' : title;
  }

  function requestSaveName(asCopy: boolean) {
    if (dialog.value) {
      dialog.value.fileName = suggestedName(asCopy);
      return;
    }
    dialogError.value = '';
    dialog.value = {
      title: asCopy ? '另存副本' : '保存思维导图',
      message: '文件将保存到当前工作目录。',
      fileName: suggestedName(asCopy),
      confirmText: '保存',
      confirm: async (name) => { if (await save(asCopy, name)) dialog.value = null; },
    };
  }

  async function saveNewWorkspaceFile(book: Workbook, name: string, success: string, keepEditing = false): Promise<boolean> {
    if (busy.value) return false;
    const title = name.trim().replace(/\.gxp$/i, '').trim();
    if (!title || /[\\/:*?"<>|\u0000-\u001f]/.test(title) || title.endsWith('.')) {
      dialogError.value = !title ? '请输入文件名称。' : '文件名称包含无效字符，请修改后重试。';
      return false;
    }
    if (!directory.value) {
      dialogError.value = '请先选择并授权工作目录。';
      return false;
    }
    const grantId = directoryGrantId;
    const fileName = title + '.gxp';
    busy.value = 'saving'; dialogError.value = '';
    try {
      if (!await refreshDirectory() || !directory.value || directoryGrantId !== grantId) {
        dialogError.value = directoryError.value || '工作目录已变化，请确认后重试。';
        return false;
      }
      const destination = directory.value;
      const compareName = (value: string) => value.normalize('NFC').toLowerCase();
      if (directoryFiles.value.some((entry) => compareName(entry.name) === compareName(fileName))) {
        dialogError.value = '工作目录中已有同名文件，请换一个名称。';
        return false;
      }
      const next = { ...book, title };
      const result = await files.writeFile({ directory: destination, fileName, data: encodeWorkbook(next) });
      if (!result.ok) {
        if (isExpired(result.error.code)) await refreshDirectory();
        dialogError.value = result.error.message;
        return false;
      }
      if (keepEditing) {
        workbook.value.title = title;
        target.value = result.value;
        saveDestination = destination;
        savedRevision.value = revision.value;
      } else {
        replace(next, 'editable', result.value, destination);
      }
      await refreshDirectory();
      show(success);
      return true;
    } catch (error) {
      dialogError.value = error instanceof Error ? error.message : '工作簿写入失败，请重试。';
      return false;
    } finally {
      busy.value = null;
    }
  }

  async function save(asCopy = false, name?: string): Promise<boolean> {
    if (!hasDocument.value || busy.value || mode.value === 'external') return false;
    if (name !== undefined) return saveNewWorkspaceFile(workbook.value, name, '工作簿已保存。', true);
    const file = target.value;
    const destination = saveDestination;
    if (needsSaveName(asCopy) || !file || !destination) {
      if (!directory.value) report('请先选择并授权工作目录。');
      else requestSaveName(asCopy);
      return false;
    }
    busy.value = 'saving'; dialogError.value = '';
    try {
      const savedAt = revision.value;
      const data = encodeWorkbook(workbook.value);
      let result = await files.writeFile({ directory: destination, fileName: file.name, data });
      if (!result.ok && isExpired(result.error.code)) {
        if (await refreshDirectory() && saveDestination && saveDestination === directory.value && saveDestination !== destination) {
          result = await files.writeFile({ directory: saveDestination, fileName: file.name, data });
        }
      }
      if (!result.ok) { report(result.error.message); return false; }
      target.value = result.value; workbook.value.title = result.value.name.replace(/\.gxp$/i, '');
      savedRevision.value = savedAt; await refreshDirectory(); show('工作簿已保存。'); return true;
    } catch (error) { report(error instanceof Error ? error.message : '保存失败，请重试。'); return false; }
    finally { busy.value = null; }
  }
  async function createEditableCopy(name: string): Promise<boolean> {
    return saveNewWorkspaceFile(makeEditableCopy(workbook.value), name, '已创建可编辑 .gxp 副本。');
  }
  function askDelete(file: FileReference) {
    const request = () => {
      dialogError.value = '';
      dialog.value = {
        title: '删除文件', message: `将《${file.name}》移到回收站？如需恢复，请从系统回收站找回。`, confirmText: '移到回收站', danger: true,
        confirm: async () => {
          if (!directory.value || busy.value) return;
          busy.value = 'deleting'; dialogError.value = '';
          try {
            const result = await directories.remove({ directory: directory.value, name: file.name });
            if (!result.ok) { dialogError.value = result.error.message; return; }
            if (isWorkspaceTarget(file)) { replace(newWorkbook(), 'editable', null); hasDocument.value = false; }
            dialog.value = null; await refreshDirectory(); show('文件已移到系统回收站。');
          } finally { busy.value = null; }
        },
      };
    };
    if (isWorkspaceTarget(file)) confirmLeave(request, '删除原文件', true); else request();
  }
  return { workbook, hasDocument, mode, target, directory, directoryName, directoryError, directoryFiles, activeSheetId, selectedNodeId,
    currentSheet, selectedNode, dirty, fileName, outlineItems, busy, dialog, dialogError, notice, undoStack, redoStack,
    show, change, history, replace, confirmLeave, newDocument, closeDocument, refreshDirectory, chooseDirectory, restoreDirectory,
    openFile, openExisting, isWorkspaceTarget, save, createEditableCopy, askDelete };
}
