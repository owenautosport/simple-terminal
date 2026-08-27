import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, Store } from '../src/main/store'
import type { PersistedState } from '@shared/types'

let dir: string

const state = (): PersistedState => ({
  version: 1,
  activeWorkspaceId: 'w1',
  workspaces: [
    {
      id: 'w1',
      name: 'Work',
      layout: { kind: 'leaf', id: 'p1', sessionId: 's1' },
      panes: { p1: { cwd: '/tmp' } },
      focusedPaneId: 'p1'
    }
  ],
  settings: DEFAULT_SETTINGS
})

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-store-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Store', () => {
  it('returns null before anything has been written', () => {
    expect(new Store(dir).read()).toBeNull()
  })

  it('round-trips state', () => {
    const store = new Store(dir)
    store.write(state())
    expect(store.read()).toEqual(state())
  })

  it('quarantines a corrupt file and starts clean', () => {
    const store = new Store(dir)
    fs.writeFileSync(store.file, '{ not json', 'utf8')
    expect(store.read()).toBeNull()
    expect(fs.existsSync(`${store.file}.bak`)).toBe(true)
  })

  it('backfills settings added after the file was written', () => {
    const store = new Store(dir)
    const partial = state()
    // A file written by an older build that had no fontSize.
    delete (partial.settings as Partial<typeof partial.settings>).fontSize
    store.write(partial)
    expect(store.read()?.settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize)
  })
})
