import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PaneMeta, Settings, Workspace } from '@shared/types'
import {
  clampRatio,
  layoutDividers,
  layoutRects,
  listPanes,
  readingOrder,
  type Leaf,
  type Path,
  type Rect
} from '@/layout/tree'
import { TerminalPane, type TerminalHandle } from './TerminalPane'
import { BrowserPane, type BrowserHandle } from './BrowserPane'

interface Props {
  workspace: Workspace
  settings: Settings
  home: string
  searchPaneId: string | null
  onFocusPane: (paneId: string) => void
  onSplitPane: (paneId: string, dir: 'h' | 'v') => void
  onZoomPane: (paneId: string) => void
  onClosePane: (paneId: string) => void
  onToggleKind: (paneId: string) => void
  onTitle: (paneId: string, title: string) => void
  onPageTitle: (paneId: string, title: string) => void
  onVisit: (paneId: string, url: string) => void
  onExit: (paneId: string, exitCode: number) => void
  onRestart: (paneId: string) => void
  onRatio: (path: Path, ratio: number) => void
  onCloseSearch: () => void
  registerTerminal: (paneId: string, handle: TerminalHandle | null) => void
  registerBrowser: (paneId: string, handle: BrowserHandle | null) => void
}

const FULL: Rect = { x: 0, y: 0, w: 100, h: 100 }

/**
 * Panes are absolutely positioned from computed geometry rather than nested in
 * the shape of the tree. That keeps every pane mounted under a stable key when the
 * layout changes — reparenting a live xterm would wipe its scrollback.
 */
export function PaneGrid(props: Props): React.JSX.Element {
  const { workspace } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const dragRef = useRef<{ path: Path; dir: 'h' | 'v'; parent: Rect } | null>(null)
  const [dragging, setDragging] = useState(false)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = (): void => setSize({ w: host.clientWidth, h: host.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const zoomed = workspace.zoomedPaneId
  const rects = zoomed
    ? new Map([[zoomed, FULL]])
    : layoutRects(workspace.layout, FULL)
  const dividers = zoomed ? [] : layoutDividers(workspace.layout, FULL, 1.2)
  const numbers = new Map(readingOrder(workspace.layout).map((pane, i) => [pane.id, i + 1]))
  // Rendered in a fixed order (by id) so layout changes never move a pane's DOM node:
  // moving a <webview> reloads its page.
  const panes = listPanes(workspace.layout).sort((p, q) => (p.id < q.id ? -1 : 1))

  const onDividerDown = useCallback(
    (event: React.MouseEvent, path: Path, dir: 'h' | 'v', parent: Rect) => {
      event.preventDefault()
      dragRef.current = { path, dir, parent }
      setDragging(true)
    },
    []
  )

  useEffect(() => {
    if (size.w === 0) return

    const onMove = (event: MouseEvent): void => {
      const drag = dragRef.current
      const host = hostRef.current
      if (!drag || !host) return
      const box = host.getBoundingClientRect()
      // Percentages, matching the units the layout maths works in.
      const px = ((event.clientX - box.left) / box.width) * 100
      const py = ((event.clientY - box.top) / box.height) * 100
      const ratio =
        drag.dir === 'h'
          ? (px - drag.parent.x) / drag.parent.w
          : (py - drag.parent.y) / drag.parent.h
      props.onRatio(drag.path, clampRatio(ratio))
    }
    const onUp = (): void => {
      dragRef.current = null
      setDragging(false)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [props, size.w])

  return (
    // While a divider is dragged, web pages stop taking the mouse, or the drag would
    // stall the moment the pointer crossed one.
    <div className={`grid${dragging ? ' grid--dragging' : ''}`} ref={hostRef}>
      {panes.map((pane) => {
        const rect = rects.get(pane.id)
        return (
          <div
            key={pane.id}
            className="grid__slot"
            style={{
              left: `${rect?.x ?? 0}%`,
              top: `${rect?.y ?? 0}%`,
              width: `${rect?.w ?? 0}%`,
              height: `${rect?.h ?? 0}%`,
              // A zoomed pane fills the grid; the others stay mounted but hidden.
              visibility: rect ? 'visible' : 'hidden',
              pointerEvents: rect ? 'auto' : 'none'
            }}
          >
            <PaneView
              {...props}
              pane={pane}
              meta={workspace.panes[pane.id] ?? { cwd: '' }}
              index={numbers.get(pane.id) ?? 0}
            />
          </div>
        )
      })}

      {dividers.map((divider) => (
        <div
          key={divider.path.join('') || 'root'}
          className={`grid__divider grid__divider--${divider.dir}`}
          style={{
            left: `${divider.rect.x}%`,
            top: `${divider.rect.y}%`,
            width: `${divider.rect.w}%`,
            height: `${divider.rect.h}%`
          }}
          onMouseDown={(event) =>
            onDividerDown(event, divider.path, divider.dir, divider.parentRect)
          }
        />
      ))}
    </div>
  )
}

/**
 * One slot's content. A pane switched to the web keeps its terminal mounted but
 * hidden, so the shell and whatever it is running carry on; the terminal is only
 * started once the pane has actually shown one.
 */
function PaneView(props: Props & { pane: Leaf; meta: PaneMeta; index: number }): React.JSX.Element {
  const { pane, meta, workspace } = props
  const kind = meta.kind ?? 'terminal'
  const [terminalStarted, setTerminalStarted] = useState(kind === 'terminal')
  useEffect(() => {
    if (kind === 'terminal') setTerminalStarted(true)
  }, [kind])

  const focused = workspace.focusedPaneId === pane.id
  const zoomed = workspace.zoomedPaneId === pane.id
  const shared = {
    focused,
    zoomed,
    onFocus: () => props.onFocusPane(pane.id),
    onSplit: (dir: 'h' | 'v') => props.onSplitPane(pane.id, dir),
    onZoom: () => props.onZoomPane(pane.id),
    onClose: () => props.onClosePane(pane.id),
    onToggleKind: () => props.onToggleKind(pane.id)
  }

  return (
    <>
      {terminalStarted && (
        <TerminalPane
          {...shared}
          paneId={pane.id}
          sessionId={pane.sessionId}
          meta={meta}
          settings={props.settings}
          index={props.index}
          home={props.home}
          visible={kind === 'terminal'}
          searchOpen={props.searchPaneId === pane.id}
          onTitle={(title) => props.onTitle(pane.id, title)}
          onExit={(code) => props.onExit(pane.id, code)}
          onRestart={() => props.onRestart(pane.id)}
          onCloseSearch={props.onCloseSearch}
          registerTerminal={props.registerTerminal}
        />
      )}
      {kind === 'browser' && (
        <BrowserPane
          {...shared}
          paneId={pane.id}
          meta={meta}
          onVisit={(url) => props.onVisit(pane.id, url)}
          onPageTitle={(title) => props.onPageTitle(pane.id, title)}
          registerBrowser={props.registerBrowser}
        />
      )}
    </>
  )
}
