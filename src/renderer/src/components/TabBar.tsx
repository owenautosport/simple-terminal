import { useState } from 'react'
import type { Workspace } from '@shared/types'
import { listPanes } from '@/layout/tree'

interface Props {
  workspaces: Workspace[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  onRename: (id: string, name: string) => void
}

export function TabBar(props: Props): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="tabs">
      <div className="tabs__drag" />
      {props.workspaces.map((workspace) => {
        const paneCount = listPanes(workspace.layout).length
        const active = workspace.id === props.activeId
        return (
          <div
            key={workspace.id}
            className={`tab${active ? ' tab--active' : ''}`}
            onMouseDown={() => props.onSelect(workspace.id)}
            onDoubleClick={() => setEditing(workspace.id)}
            title={`${workspace.name} — ${paneCount} pane${paneCount === 1 ? '' : 's'}`}
          >
            {editing === workspace.id ? (
              <input
                className="tab__input"
                autoFocus
                defaultValue={workspace.name}
                onBlur={(event) => {
                  props.onRename(workspace.id, event.target.value)
                  setEditing(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <>
                <span className="tab__name">{workspace.name}</span>
                <span className="tab__count">{paneCount}</span>
                {props.workspaces.length > 1 && (
                  <button
                    type="button"
                    className="tab__close"
                    aria-label={`Close ${workspace.name}`}
                    onMouseDown={(event) => {
                      event.stopPropagation()
                      props.onClose(workspace.id)
                    }}
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
      <button type="button" className="tabs__new" onClick={props.onNew} aria-label="New workspace">
        +
      </button>
    </div>
  )
}
