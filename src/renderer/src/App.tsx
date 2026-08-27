import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Settings } from '@shared/types'
import { listPanes, type Direction, type Path } from '@/layout/tree'
import {
  activeWorkspace,
  initialState,
  reducer,
  toPersisted,
  type Action,
  type AppState,
  type IdSource
} from '@/state/reducer'
import { shortenPath } from '@/util/path'
import { PaneGrid } from '@/components/PaneGrid'
import { TabBar } from '@/components/TabBar'
import { Toolbar } from '@/components/Toolbar'
import { QuickSwitcher, type SwitcherEntry } from '@/components/QuickSwitcher'
import { SettingsDialog } from '@/components/SettingsDialog'

const ids: IdSource = {
  pane: () => `pane-${crypto.randomUUID()}`,
  session: () => `sess-${crypto.randomUUID()}`
}

const boundReducer = (state: AppState, action: Action): AppState => reducer(state, action, ids)

export function App(): React.JSX.Element {
  const [state, dispatch] = useReducer(boundReducer, null, () => initialState(ids, ''))
  const [loaded, setLoaded] = useState(false)
  const [home, setHome] = useState('')
  const [defaultShell, setDefaultShell] = useState('')
  const [searchPaneId, setSearchPaneId] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const clearFns = useRef(new Map<string, () => void>())

  const workspace = activeWorkspace(state)
  const paneCount = listPanes(workspace.layout).length

  // Restore persisted state, or start a fresh workspace in the home directory.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const info = await window.terminalApi.appInfo()
      const saved = await window.terminalApi.readState()
      if (cancelled) return
      setHome(info.home)
      setDefaultShell(info.defaultShell)
      if (saved) {
        dispatch({
          type: 'replace',
          state: {
            workspaces: saved.workspaces,
            activeWorkspaceId: saved.activeWorkspaceId,
            settings: saved.settings
          }
        })
      } else {
        dispatch({ type: 'replace', state: initialState(ids, info.home) })
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist on change, debounced so a drag-resize does not hammer the disk.
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => void window.terminalApi.writeState(toPersisted(state)), 400)
    return () => clearTimeout(timer)
  }, [state, loaded])

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme
  }, [state.settings.theme])

  const cwdOfFocused = workspace.panes[workspace.focusedPaneId]?.cwd || home

  const closeFocusedPane = useCallback(() => {
    // A workspace's last pane closes the workspace instead of leaving it empty.
    if (paneCount === 1 && state.workspaces.length > 1) {
      dispatch({ type: 'close-workspace' })
    } else {
      dispatch({ type: 'close-pane' })
    }
  }, [paneCount, state.workspaces.length])

  const runCommand = useCallback(
    (command: string, arg?: unknown) => {
      switch (command) {
        case 'new-tab':
          return dispatch({ type: 'new-workspace', cwd: cwdOfFocused })
        case 'close-tab':
          return dispatch({ type: 'close-workspace' })
        case 'next-tab':
          return dispatch({ type: 'cycle-workspace', delta: 1 })
        case 'prev-tab':
          return dispatch({ type: 'cycle-workspace', delta: -1 })
        case 'select-tab':
          return dispatch({ type: 'select-workspace-index', index: Number(arg) })
        case 'split':
          return dispatch({ type: 'split', dir: arg === 'v' ? 'v' : 'h', cwd: cwdOfFocused })
        case 'close-pane':
          return closeFocusedPane()
        case 'restart-pane':
          return dispatch({ type: 'restart-pane' })
        case 'focus':
          return dispatch({ type: 'focus-direction', dir: arg as Direction })
        case 'zoom':
          return dispatch({ type: 'zoom' })
        case 'tidy':
          return dispatch({ type: 'tidy' })
        case 'preset':
          return dispatch({ type: 'preset', size: Number(arg), cwd: cwdOfFocused })
        case 'find':
          return setSearchPaneId(workspace.focusedPaneId)
        case 'clear':
          return clearFns.current.get(workspace.focusedPaneId)?.()
        case 'quick-switcher':
          return setSwitcherOpen(true)
        case 'settings':
          return setSettingsOpen(true)
        case 'font-size':
          return dispatch({
            type: 'settings',
            patch: {
              fontSize: Math.min(32, Math.max(8, state.settings.fontSize + Number(arg)))
            }
          })
        default:
          return undefined
      }
    },
    [cwdOfFocused, closeFocusedPane, workspace.focusedPaneId, state.settings.fontSize]
  )

  useEffect(
    () => window.terminalApi.onMenuCommand(({ command, arg }) => runCommand(command, arg)),
    [runCommand]
  )

  // Escape closes whichever overlay is open, without stealing keys from a pane.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setSwitcherOpen(false)
      setSettingsOpen(false)
      setSearchPaneId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const registerClear = useCallback((paneId: string, clear: () => void) => {
    clearFns.current.set(paneId, clear)
  }, [])

  const onPick = useCallback((entry: SwitcherEntry) => {
    dispatch({ type: 'select-workspace', workspaceId: entry.workspaceId })
    dispatch({ type: 'focus-pane', paneId: entry.paneId })
    setSwitcherOpen(false)
  }, [])

  const status = useMemo(() => {
    const meta = workspace.panes[workspace.focusedPaneId]
    return {
      cwd: shortenPath(meta?.cwd ?? '', home),
      title: meta?.title ?? '',
      panes: paneCount
    }
  }, [workspace, paneCount, home])

  return (
    <div className="app">
      <TabBar
        workspaces={state.workspaces}
        activeId={state.activeWorkspaceId}
        onSelect={(id) => dispatch({ type: 'select-workspace', workspaceId: id })}
        onClose={(id) => dispatch({ type: 'close-workspace', workspaceId: id })}
        onNew={() => dispatch({ type: 'new-workspace', cwd: cwdOfFocused })}
        onRename={(id, name) => dispatch({ type: 'rename-workspace', workspaceId: id, name })}
      />

      <Toolbar
        paneCount={paneCount}
        zoomed={Boolean(workspace.zoomedPaneId)}
        onPreset={(size) => dispatch({ type: 'preset', size, cwd: cwdOfFocused })}
        onSplit={(dir) => dispatch({ type: 'split', dir, cwd: cwdOfFocused })}
        onTidy={() => dispatch({ type: 'tidy' })}
        onZoom={() => dispatch({ type: 'zoom' })}
        onSettings={() => setSettingsOpen(true)}
      />

      {loaded && (
        <PaneGrid
          workspace={workspace}
          settings={state.settings}
          searchPaneId={searchPaneId}
          onFocusPane={(paneId) => dispatch({ type: 'focus-pane', paneId })}
          onTitle={(paneId, title) => dispatch({ type: 'pane-meta', paneId, patch: { title } })}
          onExit={(paneId, exitCode) =>
            dispatch({ type: 'pane-meta', paneId, patch: { exitCode } })
          }
          onRestart={(paneId) => dispatch({ type: 'restart-pane', paneId })}
          onRatio={(path: Path, ratio: number) => dispatch({ type: 'set-ratio', path, ratio })}
          onCloseSearch={() => setSearchPaneId(null)}
          registerClear={registerClear}
        />
      )}

      <div className="status">
        <span className="status__title">{status.title || 'simple terminal'}</span>
        <span className="status__cwd">{status.cwd}</span>
        <span className="status__panes">
          {status.panes} pane{status.panes === 1 ? '' : 's'}
          {workspace.zoomedPaneId ? ' · zoomed' : ''}
        </span>
      </div>

      {switcherOpen && (
        <QuickSwitcher
          workspaces={state.workspaces}
          home={home}
          onPick={onPick}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          settings={state.settings}
          defaultShell={defaultShell}
          onChange={(patch: Partial<Settings>) => dispatch({ type: 'settings', patch })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
