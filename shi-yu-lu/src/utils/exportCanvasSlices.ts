import type { PageSlice } from './exportPagination';

/** Converts a CSS-pixel safe page boundary to the rendered canvas coordinate. */
export function canvasSlice(slice: PageSlice, canvasScale: number) {
  return { top: Math.round(slice.top * canvasScale), height: Math.round(slice.height * canvasScale) };
}
