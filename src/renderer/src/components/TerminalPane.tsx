import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import type { PaneMeta, Settings } from '@shared/types'
import { THEMES } from '@/theme'
import { shortenPath } from '@/util/path'
import { PaneActions } from './PaneActions'

interface Props {
  paneId: string
  sessionId: string
  meta: PaneMeta
  settings: Settings
  /** 1-based position in the layout, used when the shell reports no title. */
  index: number
  home: string
  focused: boolean
  zoomed: boolean
  /** False while the pane shows a web page: the shell keeps running out of sight. */
  visible: boolean
  searchOpen: boolean
  onFocus: () => void
  onSplit: (dir: 'h' | 'v') => void
  onZoom: () => void
  onClose: () => void
  onToggleKind: () => void
  onTitle: (title: string) => void
  onExit: (exitCode: number) => void
  onRestart: () => void
  onCloseSearch: () => void
  registerTerminal: (paneId: string, handle: TerminalHandle | null) => void
}

/** What the menu can ask of a pane's terminal. */
export interface TerminalHandle {
  clear: () => void
  selectAll: () => void
}

/**
 * One xterm instance and its pty. The component owns the whole lifecycle: it
 * creates the session on mount and kills it on unmount, so a pane that leaves the
 * layout never leaves a shell behind.
 */
export function TerminalPane(props: Props): React.JSX.Element {
  const { paneId, sessionId, settings, focused } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  // Keystrokes that arrive before the pty exists would otherwise be dropped by
  // the main process, which silently ignores writes to an unknown session.
  const readyRef = useRef(false)
  const pendingRef = useRef<string[]>([])
  const [exitCode, setExitCode] = useState<number | null>(props.meta.exitCode ?? null)

  // Latest callbacks, so the mount effect below never needs them as dependencies
  // (re-running it would tear down a live shell).
  const callbacks = useRef(props)
  callbacks.current = props

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      scrollback: settings.scrollback,
      theme: THEMES[settings.theme],
      cursorBlink: true,
      allowProposedApi: true,
      macOptionIsMeta: true
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.loadAddon(new WebLinksAddon())
    term.open(host)

    try {
      term.loadAddon(new WebglAddon())
    } catch {
      // No WebGL (remote display, old GPU): the DOM renderer still works.
    }

    termRef.current = term
    fitRef.current = fit
    searchRef.current = search
    fit.fit()

    callbacks.current.registerTerminal(paneId, {
      clear: () => term.clear(),
      selectAll: () => term.selectAll()
    })

    const offData = window.terminalApi.onData((event) => {
      if (event.sessionId === sessionId) term.write(event.data)
    })
    const offExit = window.terminalApi.onExit((event) => {
      if (event.sessionId !== sessionId) return
      setExitCode(event.exitCode)
      callbacks.current.onExit(event.exitCode)
    })

    const input = term.onData((data) => {
      if (readyRef.current) window.terminalApi.write(sessionId, data)
      else pendingRef.current.push(data)
    })
    const title = term.onTitleChange((value) => callbacks.current.onTitle(value))
    const scroll = term.onScroll(() =>
      setAtBottom(term.buffer.active.viewportY >= term.buffer.active.baseY)
    )

    void window.terminalApi
      .createSession({
        sessionId,
        cwd: props.meta.cwd,
        shell: settings.shell || undefined,
        cols: term.cols,
        rows: term.rows,
        startupCommand: props.meta.startupCommand
      })
      .then((result) => {
        if (!result.ok) {
          term.writeln(`\x1b[31mFailed to start shell: ${result.error ?? 'unknown error'}\x1b[0m`)
          pendingRef.current = []
          setExitCode(-1)
          return
        }
        readyRef.current = true
        for (const data of pendingRef.current) window.terminalApi.write(sessionId, data)
        pendingRef.current = []
      })

    const observer = new ResizeObserver(() => {
      if (host.clientWidth < 2 || host.clientHeight < 2) return
      fit.fit()
      window.terminalApi.resize(sessionId, term.cols, term.rows)
    })
    observer.observe(host)

    return () => {
      readyRef.current = false
      pendingRef.current = []
      observer.disconnect()
      offData()
      offExit()
      input.dispose()
      title.dispose()
      scroll.dispose()
      callbacks.current.registerTerminal(paneId, null)
      window.terminalApi.kill(sessionId)
      term.dispose()
      termRef.current = null
    }
    // Only a new session id should rebuild the terminal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Live settings changes apply to the running terminal without a restart.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = settings.fontFamily
    term.options.fontSize = settings.fontSize
    term.options.scrollback = settings.scrollback
    term.options.theme = THEMES[settings.theme]
    fitRef.current?.fit()
    window.terminalApi.resize(sessionId, term.cols, term.rows)
  }, [settings, sessionId])

  // A hidden terminal must never take focus, or it would swallow the page's keystrokes.
  useEffect(() => {
    if (focused && props.visible && !props.searchOpen) termRef.current?.focus()
  }, [focused, props.visible, props.searchOpen])

  useEffect(() => {
    if (props.searchOpen && focused && props.visible) searchInputRef.current?.focus()
  }, [props.searchOpen, focused, props.visible])

  return (
    <div
      className={`pane${focused ? ' pane--focused' : ''}`}
      style={props.visible ? undefined : { display: 'none' }}
      onMouseDown={props.onFocus}
      data-pane-id={paneId}
    >
      <div className="pane__bar">
        <span className="pane__title" title={props.meta.cwd}>
          {props.meta.title?.trim() || `Pane ${props.index}`}
        </span>
        <span className="pane__where">{shortenPath(props.meta.cwd, props.home, 28)}</span>
        <PaneActions
          kind="terminal"
          zoomed={props.zoomed}
          onToggleKind={props.onToggleKind}
          onSplit={props.onSplit}
          onZoom={props.onZoom}
          onClose={props.onClose}
        />
      </div>

      <div className="pane__term" ref={hostRef} />

      {props.searchOpen && focused && (
        <div className="pane__search">
          <input
            ref={searchInputRef}
            placeholder="Find in terminal"
            onChange={(event) => searchRef.current?.findNext(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                searchRef.current?.[event.shiftKey ? 'findPrevious' : 'findNext'](
                  event.currentTarget.value
                )
              }
              if (event.key === 'Escape') props.onCloseSearch()
            }}
          />
          <button type="button" onClick={props.onCloseSearch} aria-label="Close search">
            ✕
          </button>
        </div>
      )}

      {!atBottom && (
        <button
          type="button"
          className="pane__to-bottom"
          onClick={() => termRef.current?.scrollToBottom()}
        >
          ↓ jump to bottom
        </button>
      )}

      {exitCode !== null && (
        <div className="pane__exited">
          <span>process exited{exitCode >= 0 ? ` (${exitCode})` : ''}</span>
          <button type="button" onClick={props.onRestart}>
            Restart
          </button>
        </div>
      )}
    </div>
  )
}
