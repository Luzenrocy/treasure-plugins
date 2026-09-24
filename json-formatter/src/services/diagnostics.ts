export type DiagnosticStage = 'idle' | 'processing' | 'completed' | 'failed' | 'cancelled';
export interface DiagnosticNotice { stage: DiagnosticStage; message: string; line?: number; column?: number; }
