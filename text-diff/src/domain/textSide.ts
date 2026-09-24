export interface FileMetadata {
  fileName: string;
  displayPath?: string;
  lineCount: number;
}

export interface TextSide {
  side: 'left' | 'right';
  text: string;
  documentVersion: number;
  source: 'temporary' | 'file';
  metadata?: FileMetadata;
  dirty: boolean;
}

export function createTextSide(side: TextSide['side']): TextSide {
  return { side, text: '', documentVersion: 0, source: 'temporary', dirty: false };
}

export function updateTextSide(side: TextSide, text: string, metadata?: FileMetadata): TextSide {
  return { ...side, text, documentVersion: side.documentVersion + 1, source: metadata ? 'file' : 'temporary', metadata, dirty: Boolean(metadata) ? false : true };
}

export function markDirty(side: TextSide, text: string): TextSide {
  return { ...side, text, documentVersion: side.documentVersion + 1, dirty: side.source === 'file' || side.dirty };
}
