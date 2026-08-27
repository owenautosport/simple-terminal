import type { LayoutNode, PaneId, PaneMeta, PersistedState, Settings, Workspace } from '@shared/types'
import { buildPreset } from '@/layout/presets'
import {
  closePane,
  findPane,
  leaf,
  listPanes,
  neighbour,
  setRatioAt,
  setSessionId,
  splitPane,
  tidy,
  type Direction,
  type Path
} from '@/layout/tree'

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: 'Menlo, Monaco, "SF Mono", "Courier New", monospace',
  fontSize: 13,
  theme: 'dark',
  shell: '',
  scrollback: 5000
}

export interface AppState {
  workspaces: Workspace[]
  activeWorkspaceId: string
  settings: Settings
}

/** Fresh pane and session ids, injected so the reducer stays deterministic in tests. */
export interface IdSource {
  pane: () => PaneId
  session: () => string
}

export type Action =
  | { type: 'replace'; state: AppState }
  | { type: 'new-workspace'; cwd: string }
  | { type: 'close-workspace'; workspaceId?: string }
  | { type: 'select-workspace'; workspaceId: string }
  | { type: 'select-workspace-index'; index: number }
  | { type: 'cycle-workspace'; delta: number }
  | { type: 'rename-workspace'; workspaceId: string; name: string }
  | { type: 'split'; dir: 'h' | 'v'; cwd?: string; paneId?: string }
  | { type: 'close-pane'; paneId?: string }
  | { type: 'restart-pane'; paneId?: string }
  | { type: 'focus-pane'; paneId: string }
  | { type: 'focus-direction'; dir: Direction }
  | { type: 'set-ratio'; path: Path; ratio: number }
  | { type: 'tidy' }
  | { type: 'zoom'; paneId?: string }
  | { type: 'preset'; size: number; cwd: string }
  | { type: 'pane-meta'; paneId: string; patch: Partial<PaneMeta> }
  | { type: 'settings'; patch: Partial<Settings> }

export function createWorkspace(ids: IdSource, cwd: string, name: string): Workspace {
  const paneId = ids.pane()
  const sessionId = ids.session()
  return {
    id: ids.session(),
    name,
    layout: leaf(paneId, sessionId),
    panes: { [paneId]: { cwd } },
    focusedPaneId: paneId
  }
}

export function initialState(ids: IdSource, cwd: string): AppState {
  const workspace = createWorkspace(ids, cwd, 'Workspace 1')
  return { workspaces: [workspace], activeWorkspaceId: workspace.id, settings: DEFAULT_SETTINGS }
}

export function activeWorkspace(state: AppState): Workspace {
  return state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? state.workspaces[0]!
}

export function toPersisted(state: AppState): PersistedState {
  return { version: 1, ...state }
}

/** All reachable pane metadata, dropping entries whose pane has been closed. */
function pruneMeta(layout: LayoutNode, panes: Record<PaneId, PaneMeta>): Record<PaneId, PaneMeta> {
  const live = new Set(listPanes(layout).map((p) => p.id))
  return Object.fromEntries(Object.entries(panes).filter(([id]) => live.has(id)))
}

export function reducer(state: AppState, action: Action, ids: IdSource): AppState {
  const updateActive = (fn: (workspace: Workspace) => Workspace): AppState => ({
    ...state,
    workspaces: state.workspaces.map((w) => (w.id === state.activeWorkspaceId ? fn(w) : w))
  })

  switch (action.type) {
    case 'replace':
      return action.state

    case 'new-workspace': {
      const workspace = createWorkspace(
        ids,
        action.cwd,
        `Workspace ${state.workspaces.length + 1}`
      )
      return {
        ...state,
        workspaces: [...state.workspaces, workspace],
        activeWorkspaceId: workspace.id
      }
    }

    case 'close-workspace': {
      const targetId = action.workspaceId ?? state.activeWorkspaceId
      // The last workspace is never removed — an empty window has nothing to show.
      if (state.workspaces.length === 1) return state
      const index = state.workspaces.findIndex((w) => w.id === targetId)
      const workspaces = state.workspaces.filter((w) => w.id !== targetId)
      const nextActive =
        targetId === state.activeWorkspaceId
          ? (workspaces[Math.min(index, workspaces.length - 1)]?.id ?? workspaces[0]!.id)
          : state.activeWorkspaceId
      return { ...state, workspaces, activeWorkspaceId: nextActive }
    }

    case 'select-workspace':
      return state.workspaces.some((w) => w.id === action.workspaceId)
        ? { ...state, activeWorkspaceId: action.workspaceId }
        : state

    case 'select-workspace-index': {
      const workspace = state.workspaces[action.index]
      return workspace ? { ...state, activeWorkspaceId: workspace.id } : state
    }

    case 'cycle-workspace': {
      const index = state.workspaces.findIndex((w) => w.id === state.activeWorkspaceId)
      const count = state.workspaces.length
      const next = state.workspaces[(((index + action.delta) % count) + count) % count]!
      return { ...state, activeWorkspaceId: next.id }
    }

    case 'rename-workspace':
      return {
        ...state,
        workspaces: state.workspaces.map((w) =>
          w.id === action.workspaceId ? { ...w, name: action.name.trim() || w.name } : w
        )
      }

    case 'split':
      return updateActive((workspace) => {
        const target = action.paneId ?? workspace.focusedPaneId
        if (!findPane(workspace.layout, target)) return workspace
        const paneId = ids.pane()
        const sessionId = ids.session()
        const cwd = action.cwd ?? workspace.panes[target]?.cwd ?? ''
        return {
          ...workspace,
          layout: splitPane(workspace.layout, target, action.dir, {
            id: paneId,
            sessionId
          }),
          panes: { ...workspace.panes, [paneId]: { cwd } },
          focusedPaneId: paneId,
          // A split makes the zoom meaningless: show the whole layout again.
          zoomedPaneId: undefined
        }
      })

    case 'close-pane':
      return updateActive((workspace) => {
        const paneId = action.paneId ?? workspace.focusedPaneId
        const remaining = listPanes(workspace.layout)
        // Closing the only pane of the only workspace would empty the window.
        if (remaining.length === 1 && state.workspaces.length === 1) return workspace
        const layout = closePane(workspace.layout, paneId)
        if (layout === null) return workspace
        const panes = pruneMeta(layout, workspace.panes)
        const focusedPaneId =
          workspace.focusedPaneId === paneId
            ? (listPanes(layout)[0]?.id ?? workspace.focusedPaneId)
            : workspace.focusedPaneId
        return {
          ...workspace,
          layout,
          panes,
          focusedPaneId,
          zoomedPaneId: workspace.zoomedPaneId === paneId ? undefined : workspace.zoomedPaneId
        }
      })

    case 'restart-pane':
      return updateActive((workspace) => {
        const paneId = action.paneId ?? workspace.focusedPaneId
        if (!findPane(workspace.layout, paneId)) return workspace
        const meta = workspace.panes[paneId]
        const { exitCode: _dropped, ...rest } = meta ?? { cwd: '' }
        return {
          ...workspace,
          layout: setSessionId(workspace.layout, paneId, ids.session()),
          panes: { ...workspace.panes, [paneId]: { ...rest } }
        }
      })

    case 'focus-pane':
      return updateActive((workspace) =>
        findPane(workspace.layout, action.paneId)
          ? { ...workspace, focusedPaneId: action.paneId }
          : workspace
      )

    case 'focus-direction':
      return updateActive((workspace) => {
        // Directional movement is meaningless while one pane fills the window.
        if (workspace.zoomedPaneId) return workspace
        const next = neighbour(workspace.layout, workspace.focusedPaneId, action.dir)
        return next ? { ...workspace, focusedPaneId: next } : workspace
      })

    case 'set-ratio':
      return updateActive((workspace) => ({
        ...workspace,
        layout: setRatioAt(workspace.layout, action.path, action.ratio)
      }))

    case 'tidy':
      return updateActive((workspace) => ({ ...workspace, layout: tidy(workspace.layout) }))

    case 'zoom':
      return updateActive((workspace) => {
        const target = action.paneId ?? workspace.focusedPaneId
        if (!findPane(workspace.layout, target)) return workspace
        // Zooming a different pane than the zoomed one moves the zoom to it.
        const zoomedPaneId = workspace.zoomedPaneId === target ? undefined : target
        return { ...workspace, zoomedPaneId, focusedPaneId: target }
      })

    case 'preset':
      return updateActive((workspace) => {
        const panes: Record<PaneId, PaneMeta> = {}
        const layout = buildPreset(action.size, () => {
          const id = ids.pane()
          panes[id] = { cwd: action.cwd }
          return { id, sessionId: ids.session() }
        })
        return {
          ...workspace,
          layout,
          panes,
          focusedPaneId: listPanes(layout)[0]!.id,
          zoomedPaneId: undefined
        }
      })

    case 'pane-meta':
      return updateActive((workspace) =>
        workspace.panes[action.paneId]
          ? {
              ...workspace,
              panes: {
                ...workspace.panes,
                [action.paneId]: { ...workspace.panes[action.paneId]!, ...action.patch }
              }
            }
          : workspace
      )

    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    default:
      return state
  }
}
