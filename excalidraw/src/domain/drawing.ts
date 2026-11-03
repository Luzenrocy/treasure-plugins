import type { DirectoryReference, FileReference } from 'treasure-sdk';

export type DrawingStatus = 'new' | 'loading' | 'ready' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';
export interface DrawingDirectorySetting { permissionKey: string; directory: DirectoryReference | null; directoryName?: string | null; status: 'unconfigured' | 'ready' | 'needs-reselect' | 'error'; }
export interface DrawingFile { name: string; file: FileReference; modifiedAt?: string | number; }
export interface DrawingFileSession { status: DrawingStatus; current: DrawingFile | null; originalHash: string | null; error?: string; }
/** A drawing is always stored as `.excalidraw`, but the suffix is noise in the workspace menu. */
export function displayDrawingName(fileName: string): string { return fileName.replace(/\.excalidraw$/i, ''); }
export function transitionDrawing(session: DrawingFileSession, status: DrawingStatus, patch: Partial<DrawingFileSession> = {}): DrawingFileSession { return { ...session, ...patch, status }; }
export function isDirty(session: DrawingFileSession): boolean { return session.status === 'dirty' || session.status === 'conflict'; }
export function confirmDiscard(session: DrawingFileSession, _action: 'switch' | 'close' | 'delete', confirm: boolean): boolean { return !isDirty(session) || confirm; }
