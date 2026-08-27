import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Settings, Workspace } from '@shared/types'
import { clampRatio, layoutDividers, layoutRects, listPanes, type Path, type Rect } from '@/layout/tree'
import { TerminalPane } from './TerminalPane'

interface Props {
  workspace: Workspace
  settings: Settings
  searchPaneId: string | null
  onFocusPane: (paneId: string) => void
  onTitle: (paneId: string, title: string) => void
  onExit: (paneId: string, exitCode: number) => void
  onRestart: (paneId: string) => void
  onRatio: (path: Path, ratio: number) => void
  onCloseSearch: () => void
  registerClear: (paneId: string, clear: () => void) => void
}

const FULL: Rect = { x: 0, y: 0, w: 100, h: 100 }

/**
 * Panes are absolutely positioned from computed geometry rather than nested in
 * the shape of the tree. That keeps every TerminalPane mounted under a stable key
 * when the layout changes — reparenting a live xterm would wipe its scrollback.
 */
export function PaneGrid(props: Props): React.JSX.Element {
  const { workspace } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const dragRef = useRef<{ path: Path; dir: 'h' | 'v'; parent: Rect } | null>(null)

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

  const onDividerDown = useCallback(
    (event: React.MouseEvent, path: Path, dir: 'h' | 'v', parent: Rect) => {
      event.preventDefault()
      dragRef.current = { path, dir, parent }
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
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [props, size.w])

  return (
    <div className="grid" ref={hostRef}>
      {listPanes(workspace.layout).map((pane) => {
        const rect = rects.get(pane.id)
        const meta = workspace.panes[pane.id] ?? { cwd: '' }
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
            <TerminalPane
              paneId={pane.id}
              sessionId={pane.sessionId}
              meta={meta}
              settings={props.settings}
              focused={workspace.focusedPaneId === pane.id}
              searchOpen={props.searchPaneId === pane.id}
              onFocus={() => props.onFocusPane(pane.id)}
              onTitle={(title) => props.onTitle(pane.id, title)}
              onExit={(code) => props.onExit(pane.id, code)}
              onRestart={() => props.onRestart(pane.id)}
              onCloseSearch={props.onCloseSearch}
              registerClear={props.registerClear}
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
