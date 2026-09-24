export type TaskPhase = 'idle' | 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JsonTaskState {
  generation: number;
  documentVersion: number;
  phase: TaskPhase;
  message?: string;
}

export function nextGeneration(state: JsonTaskState): JsonTaskState {
  return { ...state, generation: state.generation + 1, phase: 'waiting', message: undefined };
}
