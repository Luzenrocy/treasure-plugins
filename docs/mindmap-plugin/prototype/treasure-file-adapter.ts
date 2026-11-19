import { files, type FileReference } from '@luzenrocy/treasure-sdk';

/**
 * The only file-system boundary for 观象谱.
 *
 * The UI never receives a path. It receives a user-authorized file reference
 * and bytes, then hands them to the format adapter. This matches the public
 * Treasure SDK: `openDialog`/`readFile` for input and
 * `saveDialog`/`writeFile` for output.
 */
const MINDMAP_FILTERS = [
  { name: '观象谱工作簿', extensions: ['gxp'] },
  { name: 'Xmind 导图', extensions: ['xmind'] },
  { name: 'SMM 导图', extensions: ['smm'] },
];

export type ExternalMindmap = { reference: FileReference; name: string; bytes: Uint8Array };
export type ExportPacket = { name: string; mime: 'image/svg+xml' | 'image/png'; data: Uint8Array };

function throwResult(operation: string, error: { code: string; message: string }): never {
  throw new Error(`${operation}失败（${error.code}）：${error.message}`);
}

/** Opens the operating-system file chooser. Cancelling leaves the editor unchanged. */
export async function openExternalMindmap(): Promise<{ cancelled: boolean; file?: ExternalMindmap }> {
  const picked = await files.openDialog({
    kind: 'file',
    multiple: false,
    title: '打开观象谱、Xmind 或 SMM 文件',
    filters: MINDMAP_FILTERS,
  });
  if (!picked.ok) {
    if (picked.error.code === 'CANCELLED') return { cancelled: true };
    return throwResult('打开文件', picked.error);
  }
  if (!Array.isArray(picked.value) || !picked.value[0]) return { cancelled: true };

  const reference = picked.value[0];
  const read = await files.readFile(reference);
  if (!read.ok) return throwResult('读取文件', read.error);
  return { cancelled: false, file: { reference, name: reference.name, bytes: read.value } };
}

function filterFor(name: string, mime: ExportPacket['mime']) {
  const extension = name.toLowerCase().endsWith('.svg') ? 'svg' : 'png';
  return [{ name: extension === 'svg' ? 'SVG 图像' : 'PNG 图片', extensions: [extension] }];
}

/**
 * Opens one native “Save As” dialog per output. This is intentional: the SDK
 * supplies an authorized FileReference rather than an arbitrary filesystem
 * path, and an all-sheets export produces one file per sheet.
 */
export async function saveExports(outputs: ExportPacket[]): Promise<{ cancelled: boolean; savedNames: string[] }> {
  const savedNames: string[] = [];
  for (const output of outputs) {
    const destination = await files.saveDialog({
      title: outputs.length > 1 ? `导出观象谱（${savedNames.length + 1}/${outputs.length}）` : '导出观象谱',
      defaultFileName: output.name,
      filters: filterFor(output.name, output.mime),
    });
    if (!destination.ok) {
      if (destination.error.code === 'CANCELLED') return { cancelled: true, savedNames };
      return throwResult('选择导出位置', destination.error);
    }
    const written = await files.writeFile({ file: destination.value, data: output.data });
    if (!written.ok) return throwResult('写入导出文件', written.error);
    savedNames.push(output.name);
  }
  return { cancelled: false, savedNames };
}

/**
 * A small bridge used only by the dependency-free HTML prototype. Production
 * Vue code should import the two functions above directly rather than depend
 * on `window`.
 */
export function installPrototypeHostBridge() {
  window.__guanXiangPuHostFiles = {
    openExternalFile: openExternalMindmap,
    saveExports,
  };
}

declare global {
  interface Window {
    __guanXiangPuHostFiles?: {
      openExternalFile: typeof openExternalMindmap;
      saveExports: typeof saveExports;
    };
  }
}
