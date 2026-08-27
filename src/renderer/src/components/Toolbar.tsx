import { PRESET_SIZES } from '@/layout/presets'

interface Props {
  paneCount: number
  zoomed: boolean
  onPreset: (size: number) => void
  onSplit: (dir: 'h' | 'v') => void
  onTidy: () => void
  onZoom: () => void
  onSettings: () => void
}

export function Toolbar(props: Props): React.JSX.Element {
  return (
    <div className="toolbar">
      <div className="toolbar__group" role="group" aria-label="Layout presets">
        {PRESET_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={`chip${props.paneCount === size ? ' chip--on' : ''}`}
            onClick={() => props.onPreset(size)}
            title={`${size}-pane layout (replaces the current one)`}
          >
            {size}
          </button>
        ))}
      </div>

      <div className="toolbar__group">
        <button type="button" className="chip" onClick={() => props.onSplit('h')} title="Split right (⌘D)">
          ⬌ Split
        </button>
        <button type="button" className="chip" onClick={() => props.onSplit('v')} title="Split down (⇧⌘D)">
          ⬍ Split
        </button>
        <button type="button" className="chip" onClick={props.onTidy} title="Even out every split (⇧⌘T)">
          Tidy
        </button>
        <button
          type="button"
          className={`chip${props.zoomed ? ' chip--on' : ''}`}
          onClick={props.onZoom}
          title="Zoom the focused pane (⇧⌘↩)"
        >
          Zoom
        </button>
      </div>

      <div className="toolbar__spacer" />
      <button type="button" className="chip" onClick={props.onSettings} title="Settings (⌘,)">
        Settings
      </button>
    </div>
  )
}
