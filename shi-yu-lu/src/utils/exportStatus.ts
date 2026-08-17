export function exportStatus(stage: string, type: 'pdf' | 'img' | ''): string {
  if (stage) return stage;
  return type === 'pdf' ? '正在导出 PDF，请稍候…' : '正在导出图片，请稍候…';
}

/** The native save sheet owns the selection phase; the app overlay starts afterwards. */
export function exportStageAfterSave(saveConfirmed: boolean): string {
  return saveConfirmed ? '正在分析导出内容…' : '请选择导出位置…';
}
