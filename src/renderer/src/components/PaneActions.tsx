import type { PaneKind } from '@shared/types'
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  GlobeIcon,
  SplitDownIcon,
  SplitRightIcon,
  TerminalIcon
} from './icons'

interface Props {
  kind: PaneKind
  zoomed: boolean
  onToggleKind: () => void
  onSplit: (dir: 'h' | 'v') => void
  onZoom: () => void
  onClose: () => void
}

/** The buttons at the right of every pane's title bar, the same for both kinds. */
export function PaneActions(props: Props): React.JSX.Element {
  const web = props.kind === 'browser'
  return (
    <span className="pane__actions">
      <button
        type="button"
        className="pane__btn pane__btn--kind"
        onClick={props.onToggleKind}
        title={web ? 'Show the terminal (⇧⌘B)' : 'Show a web page (⇧⌘B)'}
        aria-label={web ? 'Show the terminal' : 'Show a web page'}
      >
        {web ? <TerminalIcon size={14} /> : <GlobeIcon size={14} />}
      </button>
      <button
        type="button"
        className="pane__btn pane__btn--optional"
        onClick={() => props.onSplit('h')}
        title="Split right (⌘D)"
        aria-label="Split right"
      >
        <SplitRightIcon size={14} />
      </button>
      <button
        type="button"
        className="pane__btn pane__btn--optional"
        onClick={() => props.onSplit('v')}
        title="Split down (⇧⌘D)"
        aria-label="Split down"
      >
        <SplitDownIcon size={14} />
      </button>
      <button
        type="button"
        className={`pane__btn${props.zoomed ? ' pane__btn--on' : ''}`}
        onClick={props.onZoom}
        title={props.zoomed ? 'Show every pane (⇧⌘↩)' : 'Zoom this pane (⇧⌘↩)'}
        aria-label={props.zoomed ? 'Show every pane' : 'Zoom this pane'}
        aria-pressed={props.zoomed}
      >
        {props.zoomed ? <CollapseIcon size={14} /> : <ExpandIcon size={14} />}
      </button>
      <button
        type="button"
        className="pane__btn pane__btn--danger"
        onClick={props.onClose}
        title="Close pane (⌘W)"
        aria-label="Close pane"
      >
        <CloseIcon size={14} />
      </button>
    </span>
  )
}
