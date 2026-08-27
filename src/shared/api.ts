import type {
  CreateSessionOptions,
  CreateSessionResult,
  PersistedState,
  PtyDataEvent,
  PtyExitEvent,
  SessionId
} from './types'

/** The contract between preload and renderer — the renderer's entire capability set. */
export interface TerminalApi {
  createSession(options: CreateSessionOptions): Promise<CreateSessionResult>
  write(sessionId: SessionId, data: string): void
  resize(sessionId: SessionId, cols: number, rows: number): void
  kill(sessionId: SessionId): void
  onData(listener: (event: PtyDataEvent) => void): () => void
  onExit(listener: (event: PtyExitEvent) => void): () => void
  onMenuCommand(listener: (event: { command: string; arg?: unknown }) => void): () => void
  readState(): Promise<PersistedState | null>
  writeState(state: PersistedState): Promise<boolean>
  appInfo(): Promise<{ home: string; defaultShell: string; platform: string }>
}
