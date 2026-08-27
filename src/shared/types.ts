/** Types shared by the main, preload and renderer processes. */

export type PaneId = string
export type SessionId = string
export type SplitDir = 'h' | 'v'

/** A binary split tree. Leaves hold one terminal each. */
export type LayoutNode =
  | { kind: 'leaf'; id: PaneId; sessionId: SessionId }
  | { kind: 'split'; dir: SplitDir; ratio: number; a: LayoutNode; b: LayoutNode }

export interface PaneMeta {
  /** Directory the shell was started in. Persisted so restores land in the same place. */
  cwd: string
  /** Optional command sent to the shell right after it starts. */
  startupCommand?: string
  /** Title reported by the shell via OSC 0/2, if any. */
  title?: string
  /** Set once the pty has exited; the pane stays put and offers a restart. */
  exitCode?: number
}

export interface Workspace {
  id: string
  name: string
  layout: LayoutNode
  /** Keyed by PaneId. */
  panes: Record<PaneId, PaneMeta>
  focusedPaneId: PaneId
  zoomedPaneId?: PaneId
}

export interface Settings {
  fontFamily: string
  fontSize: number
  theme: 'dark' | 'light'
  shell: string
  scrollback: number
}

export interface PersistedState {
  version: 1
  workspaces: Workspace[]
  activeWorkspaceId: string
  settings: Settings
}

export interface CreateSessionOptions {
  sessionId: SessionId
  cwd?: string
  shell?: string
  cols: number
  rows: number
  startupCommand?: string
}

export interface CreateSessionResult {
  ok: boolean
  /** Present when ok is false: a human-readable reason to print into the pane. */
  error?: string
  /** The directory the shell actually started in. */
  cwd?: string
}

export interface PtyDataEvent {
  sessionId: SessionId
  data: string
}

export interface PtyExitEvent {
  sessionId: SessionId
  exitCode: number
  signal?: number
}
