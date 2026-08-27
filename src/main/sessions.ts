import os from 'node:os'
import fs from 'node:fs'
import * as pty from 'node-pty'
import type {
  CreateSessionOptions,
  CreateSessionResult,
  PtyDataEvent,
  PtyExitEvent,
  SessionId
} from '@shared/types'

/**
 * Owns every pty in the app. Knows nothing about panes, tabs or layout — callers
 * address sessions by id and the registry does the rest.
 */
export class SessionRegistry {
  private readonly sessions = new Map<SessionId, pty.IPty>()

  constructor(
    private readonly onData: (event: PtyDataEvent) => void,
    private readonly onExit: (event: PtyExitEvent) => void
  ) {}

  static defaultShell(): string {
    if (process.platform === 'win32') return process.env.COMSPEC ?? 'powershell.exe'
    return process.env.SHELL ?? '/bin/zsh'
  }

  create(options: CreateSessionOptions): CreateSessionResult {
    if (this.sessions.has(options.sessionId)) {
      return { ok: false, error: `session ${options.sessionId} already exists` }
    }

    const shell = options.shell?.trim() || SessionRegistry.defaultShell()
    const cwd = resolveCwd(options.cwd)

    try {
      const proc = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: Math.max(options.cols, 1),
        rows: Math.max(options.rows, 1),
        cwd,
        env: { ...process.env, TERM: 'xterm-256color', TERM_PROGRAM: 'simple-terminal' }
      })

      proc.onData((data) => this.onData({ sessionId: options.sessionId, data }))
      proc.onExit(({ exitCode, signal }) => {
        this.sessions.delete(options.sessionId)
        this.onExit({ sessionId: options.sessionId, exitCode, signal })
      })

      this.sessions.set(options.sessionId, proc)

      if (options.startupCommand) {
        proc.write(`${options.startupCommand}\r`)
      }

      return { ok: true, cwd }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  write(sessionId: SessionId, data: string): void {
    this.sessions.get(sessionId)?.write(data)
  }

  resize(sessionId: SessionId, cols: number, rows: number): void {
    // A hidden or zero-height pane must never drive a pty to 0x0 — that wedges
    // full-screen programs like vim and htop.
    if (cols < 1 || rows < 1) return
    const session = this.sessions.get(sessionId)
    if (!session) return
    try {
      session.resize(cols, rows)
    } catch {
      // The pty can exit between the lookup and the resize; nothing to do.
    }
  }

  kill(sessionId: SessionId): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.sessions.delete(sessionId)
    try {
      session.kill()
    } catch {
      // Already gone.
    }
  }

  has(sessionId: SessionId): boolean {
    return this.sessions.has(sessionId)
  }

  killAll(): void {
    for (const sessionId of [...this.sessions.keys()]) this.kill(sessionId)
  }
}

/** Falls back to home when the persisted directory has since been deleted. */
function resolveCwd(cwd: string | undefined): string {
  if (!cwd) return os.homedir()
  try {
    if (fs.statSync(cwd).isDirectory()) return cwd
  } catch {
    // Fall through.
  }
  return os.homedir()
}
