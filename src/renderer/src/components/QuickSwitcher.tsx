import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from '@shared/types'
import { listPanes } from '@/layout/tree'
import { shortenPath } from '@/util/path'

export interface SwitcherEntry {
  workspaceId: string
  workspaceName: string
  paneId: string
  label: string
  detail: string
}

interface Props {
  workspaces: Workspace[]
  home: string
  onPick: (entry: SwitcherEntry) => void
  onClose: () => void
}

export function collectEntries(workspaces: Workspace[], home = ''): SwitcherEntry[] {
  return workspaces.flatMap((workspace) =>
    listPanes(workspace.layout).map((pane, index) => {
      const meta = workspace.panes[pane.id]
      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        paneId: pane.id,
        label: meta?.title?.trim() || `Pane ${index + 1}`,
        detail: shortenPath(meta?.cwd ?? '', home)
      }
    })
  )
}

/** Fuzzy-ish match: every query character in order, case-insensitive. */
export function matches(query: string, text: string): boolean {
  if (!query) return true
  const haystack = text.toLowerCase()
  let cursor = 0
  for (const char of query.toLowerCase()) {
    cursor = haystack.indexOf(char, cursor)
    if (cursor === -1) return false
    cursor += 1
  }
  return true
}

export function QuickSwitcher(props: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const results = useMemo(
    () =>
      collectEntries(props.workspaces, props.home).filter((entry) =>
        matches(query, `${entry.workspaceName} ${entry.label} ${entry.detail}`)
      ),
    [props.workspaces, props.home, query]
  )

  useEffect(() => setIndex(0), [query])

  return (
    <div className="overlay" onMouseDown={props.onClose}>
      <div className="switcher" onMouseDown={(event) => event.stopPropagation()}>
        <input
          autoFocus
          placeholder="Jump to a pane…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') props.onClose()
            if (event.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, results.length - 1))
            if (event.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0))
            if (event.key === 'Enter' && results[index]) props.onPick(results[index]!)
          }}
        />
        <ul>
          {results.map((entry, i) => (
            <li
              key={`${entry.workspaceId}:${entry.paneId}`}
              className={i === index ? 'on' : undefined}
              onMouseDown={() => props.onPick(entry)}
              onMouseEnter={() => setIndex(i)}
            >
              <span className="switcher__label">{entry.label}</span>
              <span className="switcher__where">{entry.workspaceName}</span>
              <span className="switcher__detail">{entry.detail}</span>
            </li>
          ))}
          {results.length === 0 && <li className="switcher__empty">No panes match</li>}
        </ul>
      </div>
    </div>
  )
}
