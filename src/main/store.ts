import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PersistedState, Settings } from '@shared/types'

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: 'Menlo, Monaco, "SF Mono", "Courier New", monospace',
  fontSize: 13,
  theme: 'dark',
  shell: '',
  scrollback: 5000
}

/**
 * Reads and writes the single persisted-state file. A corrupt file is moved aside
 * rather than allowed to stop the app launching.
 */
export class Store {
  readonly file: string

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'workspaces.json')
  }

  read(): PersistedState | null {
    let raw: string
    try {
      raw = fs.readFileSync(this.file, 'utf8')
    } catch {
      return null // No file yet: a first run, not an error.
    }

    try {
      const parsed = JSON.parse(raw) as PersistedState
      if (parsed?.version !== 1 || !Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) {
        throw new Error('unrecognised state shape')
      }
      parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings }
      return parsed
    } catch {
      this.quarantine()
      return null
    }
  }

  write(state: PersistedState): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    // Write-then-rename so a crash mid-write cannot truncate the good file.
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
    fs.renameSync(tmp, this.file)
  }

  private quarantine(): void {
    try {
      fs.renameSync(this.file, `${this.file}.bak`)
    } catch {
      // Nothing we can do; the caller falls back to defaults regardless.
    }
  }
}

export function homeDir(): string {
  return os.homedir()
}
