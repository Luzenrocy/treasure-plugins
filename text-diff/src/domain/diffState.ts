import type { DiffSettings } from './diffSettings';

export type DiffKind = 'same' | 'added' | 'removed' | 'changed';
export interface DiffLine { left?: string; right?: string; kind: DiffKind; line: number; }
export interface DiffResult { generation: number; leftVersion: number; rightVersion: number; differences: DiffLine[]; total: number; precision: 'exact' | 'coarse'; phase: 'completed' | 'failed' | 'cancelled'; }
export interface DiffState { generation: number; settings: DiffSettings; result?: DiffResult; }
