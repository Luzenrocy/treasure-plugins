import { describe, expect, it } from 'vitest';
import { displayDrawingName } from '../src/domain/drawing';

describe('displayDrawingName', () => {
  it('hides only the Excalidraw suffix used for storage', () => {
    expect(displayDrawingName('项目草图.excalidraw')).toBe('项目草图');
    expect(displayDrawingName('ARCHITECTURE.EXCALIDRAW')).toBe('ARCHITECTURE');
    expect(displayDrawingName('notes.backup')).toBe('notes.backup');
  });
});
