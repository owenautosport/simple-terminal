import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PaneKind, Settings } from '@shared/types'
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
import type { BrowserHandle } from '@/components/BrowserPane'
import type { TerminalHandle } from '@/components/TerminalPane'

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
  const terminalFns = useRef(new Map<string, TerminalHandle>())
  const browserFns = useRef(new Map<string, BrowserHandle>())

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
  const focusedKind: PaneKind = workspace.panes[workspace.focusedPaneId]?.kind ?? 'terminal'

  const toggleKind = useCallback(
    (paneId?: string) => {
      const target = paneId ?? workspace.focusedPaneId
      const current = workspace.panes[target]?.kind ?? 'terminal'
      dispatch({
        type: 'set-pane-kind',
        paneId: target,
        kind: current === 'browser' ? 'terminal' : 'browser'
      })
    },
    [workspace]
  )

  const closePane = useCallback(
    (paneId?: string) => {
      // A workspace's last pane closes the workspace instead of leaving it empty.
      if (paneCount === 1 && state.workspaces.length > 1) {
        dispatch({ type: 'close-workspace' })
      } else {
        dispatch({ type: 'close-pane', paneId })
      }
    },
    [paneCount, state.workspaces.length]
  )

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
          return closePane()
        case 'restart-pane':
          // In a web pane ⌘R does what it does in every browser.
          if (focusedKind === 'browser') return browserFns.current.get(workspace.focusedPaneId)?.reload()
          return dispatch({ type: 'restart-pane' })
        case 'toggle-browser':
          return toggleKind()
        case 'focus-address': {
          const paneId = workspace.focusedPaneId
          if (focusedKind !== 'browser') dispatch({ type: 'set-pane-kind', paneId, kind: 'browser' })
          // A pane that has just become a web pane registers its handle after this render.
          return requestAnimationFrame(() => browserFns.current.get(paneId)?.focusAddress())
        }
        case 'focus':
          return dispatch({ type: 'focus-direction', dir: arg as Direction })
        case 'zoom':
          return dispatch({ type: 'zoom' })
        case 'tidy':
          return dispatch({ type: 'tidy' })
        case 'preset':
          return dispatch({ type: 'preset', size: Number(arg), cwd: cwdOfFocused })
        case 'find':
          if (focusedKind === 'browser') return browserFns.current.get(workspace.focusedPaneId)?.find()
          return setSearchPaneId(workspace.focusedPaneId)
        case 'clear':
          // A web page sees ⌘K before the menu does, and one that uses it (GitHub, Slack)
          // stops it there. Reaching here means the page ignored it: clearing the
          // terminal hidden behind the page would only destroy scrollback unseen.
          if (focusedKind === 'browser') return undefined
          return terminalFns.current.get(workspace.focusedPaneId)?.clear()
        case 'select-all': {
          const active = document.activeElement
          if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
            // xterm's own input is a hidden textarea; for it, "all" means the scrollback.
            if (!active.classList.contains('xterm-helper-textarea')) return active.select()
          }
          return terminalFns.current.get(workspace.focusedPaneId)?.selectAll()
        }
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
    [cwdOfFocused, closePane, workspace.focusedPaneId, state.settings.fontSize, focusedKind, toggleKind]
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

  const registerTerminal = useCallback((paneId: string, handle: TerminalHandle | null) => {
    if (handle) terminalFns.current.set(paneId, handle)
    else terminalFns.current.delete(paneId)
  }, [])

  const registerBrowser = useCallback((paneId: string, handle: BrowserHandle | null) => {
    if (handle) browserFns.current.set(paneId, handle)
    else browserFns.current.delete(paneId)
  }, [])

  const onPick = useCallback((entry: SwitcherEntry) => {
    dispatch({ type: 'select-workspace', workspaceId: entry.workspaceId })
    dispatch({ type: 'focus-pane', paneId: entry.paneId })
    setSwitcherOpen(false)
  }, [])

  const status = useMemo(() => {
    const meta = workspace.panes[workspace.focusedPaneId]
    if (meta?.kind === 'browser') {
      return { cwd: meta.url ?? '', title: meta.pageTitle || 'Web page', panes: paneCount }
    }
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
        focusedKind={focusedKind}
        onToggleKind={() => toggleKind()}
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
          home={home}
          searchPaneId={searchPaneId}
          onFocusPane={(paneId) => dispatch({ type: 'focus-pane', paneId })}
          onSplitPane={(paneId, dir) =>
            dispatch({ type: 'split', dir, paneId, cwd: workspace.panes[paneId]?.cwd || home })
          }
          onZoomPane={(paneId) => dispatch({ type: 'zoom', paneId })}
          onClosePane={closePane}
          onToggleKind={toggleKind}
          onTitle={(paneId, title) => dispatch({ type: 'pane-meta', paneId, patch: { title } })}
          onPageTitle={(paneId, pageTitle) =>
            dispatch({ type: 'pane-meta', paneId, patch: { pageTitle } })
          }
          onVisit={(paneId, url) => dispatch({ type: 'pane-meta', paneId, patch: { url } })}
          onExit={(paneId, exitCode) =>
            dispatch({ type: 'pane-meta', paneId, patch: { exitCode } })
          }
          onRestart={(paneId) => dispatch({ type: 'restart-pane', paneId })}
          onRatio={(path: Path, ratio: number) => dispatch({ type: 'set-ratio', path, ratio })}
          onCloseSearch={() => setSearchPaneId(null)}
          registerTerminal={registerTerminal}
          registerBrowser={registerBrowser}
        />
      )}

      <div className="status">
        <span className="status__title">{status.title || 'simple terminal'}</span>
        <span className="status__cwd">{status.cwd}</span>
        <span className="status__panes">
          {status.panes} pane{status.panes === 1 ? '' : 's'}
          {workspace.zoomedPaneId ? ', zoomed' : ''}
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
