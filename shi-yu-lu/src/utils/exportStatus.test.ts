import { describe, expect, it } from 'vitest';
import { exportStatus, exportStageAfterSave } from './exportStatus';

describe('exportStatus', () => {
  it('shows the current phase without exposing a percentage or progress state', () => {
    expect(exportStatus('正在保存文件…', 'pdf')).toBe('正在保存文件…');
    expect(exportStatus('', 'img')).toBe('正在导出图片，请稍候…');
  });

  it('enters document analysis only after the user confirms the native save dialog', () => {
    expect(exportStageAfterSave(false)).toBe('请选择导出位置…');
    expect(exportStageAfterSave(true)).toBe('正在分析导出内容…');
  });
});
