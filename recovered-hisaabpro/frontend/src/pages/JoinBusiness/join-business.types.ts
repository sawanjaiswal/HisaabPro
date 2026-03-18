export type JoinBusinessStatus = 'idle' | 'loading' | 'success' | 'error';

export interface JoinBusinessState {
  status: JoinBusinessStatus;
  error: string | null;
  joinedName: string | null;
}
