import { beforeEach, describe, expect, it } from 'vitest'
import { activeWorkspace, initialState, reducer, type AppState, type IdSource } from '@/state/reducer'
import { layoutRects, listPanes, readingOrder } from '@/layout/tree'

let counter = 0
const ids: IdSource = {
  pane: () => `pane-${++counter}`,
  session: () => `sess-${++counter}`
}

const start = (): AppState => {
  counter = 0
  return initialState(ids, '/home/test')
}

const dispatch = (state: AppState, ...actions: Parameters<typeof reducer>[1][]): AppState =>
  actions.reduce((acc, action) => reducer(acc, action, ids), state)

beforeEach(() => {
  counter = 0
})

describe('initialState', () => {
  it('starts with one workspace holding one pane in the given directory', () => {
    const state = start()
    expect(state.workspaces).toHaveLength(1)
    const workspace = activeWorkspace(state)
    expect(listPanes(workspace.layout)).toHaveLength(1)
    expect(workspace.panes[workspace.focusedPaneId]?.cwd).toBe('/home/test')
  })
})

describe('split', () => {
  it('adds a pane, focuses it, and inherits the focused pane cwd', () => {
    const state = dispatch(start(), { type: 'split', dir: 'h' })
    const workspace = activeWorkspace(state)
    expect(listPanes(workspace.layout)).toHaveLength(2)
    expect(workspace.panes[workspace.focusedPaneId]?.cwd).toBe('/home/test')
    expect(workspace.focusedPaneId).toBe(listPanes(workspace.layout)[1]!.id)
  })

  it('clears zoom, because a zoomed split would hide the new pane', () => {
    const state = dispatch(start(), { type: 'zoom' }, { type: 'split', dir: 'v' })
    expect(activeWorkspace(state).zoomedPaneId).toBeUndefined()
  })
})

describe('close-pane', () => {
  it('removes the pane and its metadata', () => {
    const split = dispatch(start(), { type: 'split', dir: 'h' })
    const doomed = activeWorkspace(split).focusedPaneId
    const state = dispatch(split, { type: 'close-pane' })
    const workspace = activeWorkspace(state)
    expect(listPanes(workspace.layout)).toHaveLength(1)
    expect(workspace.panes[doomed]).toBeUndefined()
    expect(workspace.focusedPaneId).toBe(listPanes(workspace.layout)[0]!.id)
  })

  it('refuses to close the last pane of the last workspace', () => {
    const state = start()
    expect(dispatch(state, { type: 'close-pane' })).toEqual(state)
  })
})

describe('restart-pane', () => {
  it('gives the pane a new session and clears the exit marker, keeping the pane', () => {
    const state = start()
    const paneId = activeWorkspace(state).focusedPaneId
    const before = listPanes(activeWorkspace(state).layout)[0]!.sessionId
    const exited = dispatch(state, { type: 'pane-meta', paneId, patch: { exitCode: 130 } })
    const restarted = dispatch(exited, { type: 'restart-pane' })
    const workspace = activeWorkspace(restarted)
    expect(listPanes(workspace.layout)[0]!.id).toBe(paneId)
    expect(listPanes(workspace.layout)[0]!.sessionId).not.toBe(before)
    expect(workspace.panes[paneId]?.exitCode).toBeUndefined()
    expect(workspace.panes[paneId]?.cwd).toBe('/home/test')
  })
})

describe('workspaces', () => {
  it('adds and activates a new workspace', () => {
    const state = dispatch(start(), { type: 'new-workspace', cwd: '/tmp' })
    expect(state.workspaces).toHaveLength(2)
    expect(state.activeWorkspaceId).toBe(state.workspaces[1]!.id)
  })

  it('never closes the final workspace', () => {
    const state = start()
    expect(dispatch(state, { type: 'close-workspace' })).toEqual(state)
  })

  it('activates a neighbour when the active workspace closes', () => {
    const two = dispatch(start(), { type: 'new-workspace', cwd: '/tmp' })
    const state = dispatch(two, { type: 'close-workspace' })
    expect(state.workspaces).toHaveLength(1)
    expect(state.activeWorkspaceId).toBe(state.workspaces[0]!.id)
  })

  it('cycles forwards and wraps backwards', () => {
    const two = dispatch(start(), { type: 'new-workspace', cwd: '/tmp' })
    expect(dispatch(two, { type: 'cycle-workspace', delta: 1 }).activeWorkspaceId).toBe(
      two.workspaces[0]!.id
    )
    expect(dispatch(two, { type: 'cycle-workspace', delta: -1 }).activeWorkspaceId).toBe(
      two.workspaces[0]!.id
    )
  })
})

describe('preset', () => {
  it('keeps the running pane and adds fresh ones in the given directory', () => {
    const before = activeWorkspace(start())
    const original = listPanes(before.layout)[0]!
    const state = dispatch(start(), { type: 'preset', size: 6, cwd: '/srv' })
    const workspace = activeWorkspace(state)
    const panes = readingOrder(workspace.layout)
    expect(panes).toHaveLength(6)
    expect(Object.keys(workspace.panes)).toHaveLength(6)
    // The existing pane keeps its id, session and directory, and takes the first slot.
    expect(panes[0]).toEqual(original)
    expect(workspace.panes[original.id]?.cwd).toBe('/home/test')
    expect(panes.slice(1).every((p) => workspace.panes[p.id]?.cwd === '/srv')).toBe(true)
    expect(workspace.focusedPaneId).toBe(original.id)
  })

  it('never restarts a running terminal when growing the grid', () => {
    const four = dispatch(start(), { type: 'preset', size: 4, cwd: '/a' })
    const sessionsBefore = readingOrder(activeWorkspace(four).layout).map((p) => p.sessionId)
    const nine = dispatch(four, { type: 'preset', size: 9, cwd: '/b' })
    const sessionsAfter = readingOrder(activeWorkspace(nine).layout).map((p) => p.sessionId)
    expect(sessionsAfter.slice(0, 4)).toEqual(sessionsBefore)
    expect(new Set(sessionsAfter).size).toBe(9)
  })

  it('keeps the focused pane when shrinking the grid', () => {
    const six = dispatch(start(), { type: 'preset', size: 6, cwd: '/a' })
    const last = readingOrder(activeWorkspace(six).layout)[5]!
    const focused = dispatch(six, { type: 'focus-pane', paneId: last.id })
    const two = activeWorkspace(dispatch(focused, { type: 'preset', size: 2, cwd: '/a' }))
    const ids = readingOrder(two.layout).map((p) => p.id)
    expect(ids).toHaveLength(2)
    expect(ids).toContain(last.id)
    expect(two.focusedPaneId).toBe(last.id)
    expect(Object.keys(two.panes).sort()).toEqual([...ids].sort())
  })

  it('fills a closed grid pane from above or below, not from the side', () => {
    const four = activeWorkspace(dispatch(start(), { type: 'preset', size: 4, cwd: '/a' }))
    const [topLeft, topRight, bottomLeft, bottomRight] = readingOrder(four.layout)
    const state = { ...start(), workspaces: [four], activeWorkspaceId: four.id }
    const closed = activeWorkspace(dispatch(state, { type: 'close-pane', paneId: topLeft!.id }))
    const rects = layoutRects(closed.layout, { x: 0, y: 0, w: 100, h: 100 })
    // The pane below grows to fill the whole left column; the right column is untouched.
    expect(rects.get(bottomLeft!.id)).toEqual({ x: 0, y: 0, w: 50, h: 100 })
    expect(rects.get(topRight!.id)).toEqual({ x: 50, y: 0, w: 50, h: 50 })
    expect(rects.get(bottomRight!.id)).toEqual({ x: 50, y: 50, w: 50, h: 50 })
  })
})

describe('web panes', () => {
  it('turns the focused pane into a web pane and back, keeping its session', () => {
    const state = start()
    const pane = listPanes(activeWorkspace(state).layout)[0]!
    const web = dispatch(state, { type: 'set-pane-kind', kind: 'browser' })
    expect(activeWorkspace(web).panes[pane.id]?.kind).toBe('browser')
    expect(listPanes(activeWorkspace(web).layout)[0]).toEqual(pane)
    const back = dispatch(web, { type: 'set-pane-kind', kind: 'terminal' })
    expect(activeWorkspace(back).panes[pane.id]?.kind).toBe('terminal')
    expect(listPanes(activeWorkspace(back).layout)[0]).toEqual(pane)
  })

  it('remembers the address a web pane was showing', () => {
    const state = dispatch(start(), { type: 'set-pane-kind', kind: 'browser' })
    const paneId = activeWorkspace(state).focusedPaneId
    const visited = dispatch(state, { type: 'pane-meta', paneId, patch: { url: 'https://example.com/' } })
    expect(activeWorkspace(visited).panes[paneId]?.url).toBe('https://example.com/')
  })
})

describe('zoom and focus', () => {
  it('toggles zoom on the focused pane', () => {
    const zoomed = dispatch(start(), { type: 'zoom' })
    expect(activeWorkspace(zoomed).zoomedPaneId).toBe(activeWorkspace(zoomed).focusedPaneId)
    expect(activeWorkspace(dispatch(zoomed, { type: 'zoom' })).zoomedPaneId).toBeUndefined()
  })

  it('ignores directional focus while zoomed', () => {
    const split = dispatch(start(), { type: 'split', dir: 'h' })
    const zoomed = dispatch(split, { type: 'zoom' })
    const moved = dispatch(zoomed, { type: 'focus-direction', dir: 'left' })
    expect(activeWorkspace(moved).focusedPaneId).toBe(activeWorkspace(zoomed).focusedPaneId)
  })

  it('moves focus to the pane on that side', () => {
    const split = dispatch(start(), { type: 'split', dir: 'h' })
    const moved = dispatch(split, { type: 'focus-direction', dir: 'left' })
    expect(activeWorkspace(moved).focusedPaneId).toBe(listPanes(activeWorkspace(split).layout)[0]!.id)
  })
})

describe('settings', () => {
  it('merges patches', () => {
    const state = dispatch(start(), { type: 'settings', patch: { fontSize: 16 } })
    expect(state.settings.fontSize).toBe(16)
    expect(state.settings.theme).toBe('dark')
  })
})

describe('per-pane actions from a pane title bar', () => {
  it('splits the named pane, not the focused one', () => {
    const two = dispatch(start(), { type: 'split', dir: 'h' })
    const [first, second] = listPanes(activeWorkspace(two).layout)
    expect(activeWorkspace(two).focusedPaneId).toBe(second!.id)

    const three = dispatch(two, { type: 'split', dir: 'v', paneId: first!.id })
    const panes = listPanes(activeWorkspace(three).layout)
    expect(panes).toHaveLength(3)
    // The new pane is the first one's sibling, so it sorts next to it.
    expect(panes.map((p) => p.id).indexOf(first!.id)).toBe(0)
    expect(panes[1]!.id).not.toBe(second!.id)
  })

  it('inherits the named pane cwd, not the focused pane cwd', () => {
    const two = dispatch(start(), { type: 'split', dir: 'h' })
    const [first] = listPanes(activeWorkspace(two).layout)
    const moved = dispatch(two, {
      type: 'pane-meta',
      paneId: first!.id,
      patch: { cwd: '/srv/app' }
    })
    const three = dispatch(moved, { type: 'split', dir: 'v', paneId: first!.id })
    const workspace = activeWorkspace(three)
    expect(workspace.panes[workspace.focusedPaneId]?.cwd).toBe('/srv/app')
  })

  it('zooms the named pane and focuses it', () => {
    const two = dispatch(start(), { type: 'split', dir: 'h' })
    const [first, second] = listPanes(activeWorkspace(two).layout)
    const zoomed = dispatch(two, { type: 'zoom', paneId: first!.id })
    expect(activeWorkspace(zoomed).zoomedPaneId).toBe(first!.id)
    expect(activeWorkspace(zoomed).focusedPaneId).toBe(first!.id)
    expect(second!.id).not.toBe(first!.id)
  })

  it('moves the zoom when a different pane is zoomed', () => {
    const two = dispatch(start(), { type: 'split', dir: 'h' })
    const [first, second] = listPanes(activeWorkspace(two).layout)
    const zoomedFirst = dispatch(two, { type: 'zoom', paneId: first!.id })
    const zoomedSecond = dispatch(zoomedFirst, { type: 'zoom', paneId: second!.id })
    expect(activeWorkspace(zoomedSecond).zoomedPaneId).toBe(second!.id)
  })

  it('unzooms when the already-zoomed pane is zoomed again', () => {
    const two = dispatch(start(), { type: 'split', dir: 'h' })
    const [first] = listPanes(activeWorkspace(two).layout)
    const zoomed = dispatch(two, { type: 'zoom', paneId: first!.id })
    expect(activeWorkspace(dispatch(zoomed, { type: 'zoom', paneId: first!.id })).zoomedPaneId)
      .toBeUndefined()
  })

  it('closes the named pane and leaves the others alone', () => {
    const three = dispatch(start(), { type: 'split', dir: 'h' }, { type: 'split', dir: 'v' })
    const [first] = listPanes(activeWorkspace(three).layout)
    const closed = dispatch(three, { type: 'close-pane', paneId: first!.id })
    const remaining = listPanes(activeWorkspace(closed).layout)
    expect(remaining).toHaveLength(2)
    expect(remaining.map((p) => p.id)).not.toContain(first!.id)
  })

  it('ignores a split or zoom aimed at a pane that is gone', () => {
    const state = start()
    expect(dispatch(state, { type: 'split', dir: 'h', paneId: 'ghost' })).toEqual(state)
    expect(dispatch(state, { type: 'zoom', paneId: 'ghost' })).toEqual(state)
  })
})
