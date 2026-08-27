import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateSessionOptions,
  CreateSessionResult,
  PersistedState,
  PtyDataEvent,
  PtyExitEvent,
  SessionId
} from '@shared/types'
import type { TerminalApi } from '@shared/api'

/** The entire surface the renderer gets. No Node, no ipcRenderer, no fs. */
const api: TerminalApi = {
  createSession: (options: CreateSessionOptions): Promise<CreateSessionResult> =>
    ipcRenderer.invoke('pty:create', options),
  write: (sessionId: SessionId, data: string): void =>
    ipcRenderer.send('pty:write', sessionId, data),
  resize: (sessionId: SessionId, cols: number, rows: number): void =>
    ipcRenderer.send('pty:resize', sessionId, cols, rows),
  kill: (sessionId: SessionId): void => ipcRenderer.send('pty:kill', sessionId),

  onData: (listener: (event: PtyDataEvent) => void): (() => void) => {
    const handler = (_e: unknown, payload: PtyDataEvent): void => listener(payload)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.off('pty:data', handler)
  },
  onExit: (listener: (event: PtyExitEvent) => void): (() => void) => {
    const handler = (_e: unknown, payload: PtyExitEvent): void => listener(payload)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.off('pty:exit', handler)
  },

  onMenuCommand: (
    listener: (event: { command: string; arg?: unknown }) => void
  ): (() => void) => {
    const handler = (_e: unknown, payload: { command: string; arg?: unknown }): void =>
      listener(payload)
    ipcRenderer.on('menu:command', handler)
    return () => ipcRenderer.off('menu:command', handler)
  },

  readState: (): Promise<PersistedState | null> => ipcRenderer.invoke('store:read'),
  writeState: (state: PersistedState): Promise<boolean> => ipcRenderer.invoke('store:write', state),
  appInfo: (): Promise<{ home: string; defaultShell: string; platform: string }> =>
    ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('terminalApi', api)
