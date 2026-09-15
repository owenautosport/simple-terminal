import type { PaneKind } from '@shared/types'
import { PRESET_SIZES, gridShape } from '@/layout/presets'
import {
  CollapseIcon,
  EvenOutIcon,
  ExpandIcon,
  GearIcon,
  GlobeIcon,
  GridGlyph,
  SplitDownIcon,
  SplitRightIcon,
  TerminalIcon
} from './icons'

interface Props {
  paneCount: number
  zoomed: boolean
  focusedKind: PaneKind
  onPreset: (size: number) => void
  onSplit: (dir: 'h' | 'v') => void
  onToggleKind: () => void
  onTidy: () => void
  onZoom: () => void
  onSettings: () => void
}

export function Toolbar(props: Props): React.JSX.Element {
  const web = props.focusedKind === 'browser'
  return (
    <div className="toolbar">
      <div className="layouts" role="group" aria-label="Grid layout">
        {PRESET_SIZES.map((size, index) => {
          const { cols, rows } = gridShape(size)
          const on = props.paneCount === size
          return (
            <button
              key={size}
              type="button"
              className={`layouts__item${on ? ' layouts__item--on' : ''}`}
              aria-pressed={on}
              onClick={() => props.onPreset(size)}
              title={`${size} ${size === 1 ? 'pane' : 'panes'}${index < 8 ? ` (⌥⌘${index + 1})` : ''}. Running terminals stay open.`}
            >
              <GridGlyph cols={cols} rows={rows} />
              <span className="layouts__count">{size}</span>
            </button>
          )
        })}
      </div>

      <div className="toolbar__group" role="group" aria-label="Focused pane">
        <button type="button" className="tool" onClick={() => props.onSplit('h')} title="Split right (⌘D)">
          <SplitRightIcon />
          <span>Split right</span>
        </button>
        <button type="button" className="tool" onClick={() => props.onSplit('v')} title="Split down (⇧⌘D)">
          <SplitDownIcon />
          <span>Split down</span>
        </button>
        <button
          type="button"
          className={`tool${web ? ' tool--web' : ''}`}
          onClick={props.onToggleKind}
          title={web ? 'Show the terminal in this pane (⇧⌘B)' : 'Show a web page in this pane (⇧⌘B)'}
        >
          {web ? <TerminalIcon /> : <GlobeIcon />}
          <span>{web ? 'Terminal' : 'Web'}</span>
        </button>
      </div>

      <div className="toolbar__group" role="group" aria-label="Whole layout">
        <button
          type="button"
          className={`tool${props.zoomed ? ' tool--on' : ''}`}
          aria-pressed={props.zoomed}
          onClick={props.onZoom}
          title={props.zoomed ? 'Show every pane (⇧⌘↩)' : 'Fill the window with the focused pane (⇧⌘↩)'}
        >
          {props.zoomed ? <CollapseIcon /> : <ExpandIcon />}
          <span>{props.zoomed ? 'Unzoom' : 'Zoom'}</span>
        </button>
        <button type="button" className="tool" onClick={props.onTidy} title="Make every pane the same size (⇧⌘T)">
          <EvenOutIcon />
          <span>Even out</span>
        </button>
      </div>

      <div className="toolbar__spacer" />
      <button
        type="button"
        className="tool tool--icon"
        onClick={props.onSettings}
        title="Settings (⌘,)"
        aria-label="Settings"
      >
        <GearIcon />
      </button>
    </div>
  )
}
