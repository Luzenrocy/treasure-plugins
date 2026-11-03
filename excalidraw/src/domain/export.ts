export type ExportTarget = 'png' | 'svg' | 'pdf';
export interface ExportRequest { target: ExportTarget; selectedOnly: boolean; transparent: boolean; defaultFileName?: string; }
