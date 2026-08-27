import type { Settings } from '@shared/types'

interface Props {
  settings: Settings
  defaultShell: string
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

export function SettingsDialog(props: Props): React.JSX.Element {
  const { settings } = props
  return (
    <div className="overlay" onMouseDown={props.onClose}>
      <div className="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <h2>Settings</h2>

        <label>
          <span>Font family</span>
          <input
            value={settings.fontFamily}
            onChange={(event) => props.onChange({ fontFamily: event.target.value })}
          />
        </label>

        <label>
          <span>Font size</span>
          <input
            type="number"
            min={8}
            max={32}
            value={settings.fontSize}
            onChange={(event) => props.onChange({ fontSize: Number(event.target.value) || 13 })}
          />
        </label>

        <label>
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(event) => props.onChange({ theme: event.target.value as 'dark' | 'light' })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label>
          <span>Shell</span>
          <input
            placeholder={props.defaultShell}
            value={settings.shell}
            onChange={(event) => props.onChange({ shell: event.target.value })}
          />
        </label>

        <label>
          <span>Scrollback lines</span>
          <input
            type="number"
            min={100}
            max={100000}
            step={100}
            value={settings.scrollback}
            onChange={(event) => props.onChange({ scrollback: Number(event.target.value) || 5000 })}
          />
        </label>

        <p className="dialog__note">
          Shell and scrollback changes apply to panes started from now on; font and theme apply
          immediately.
        </p>

        <button type="button" className="chip" onClick={props.onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
