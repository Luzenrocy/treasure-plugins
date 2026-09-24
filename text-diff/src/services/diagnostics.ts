export type DiffDiagnosticStage = 'idle' | 'processing' | 'completed' | 'failed' | 'cancelled';
export interface DiffDiagnosticNotice { stage: DiffDiagnosticStage; message: string; }
