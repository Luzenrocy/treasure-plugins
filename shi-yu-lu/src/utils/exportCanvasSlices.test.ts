import { describe, expect, it } from 'vitest';
import { canvasSlice } from './exportCanvasSlices';

describe('canvasSlice', () => {
  it('maps a safe CSS page boundary to canvas pixels without changing its height', () => {
    expect(canvasSlice({ top: 390, height: 230 }, 1.5)).toEqual({ top: 585, height: 345 });
  });
});
