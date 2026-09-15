/**
 * The app's icon set: 16px line icons drawn on one grid so they sit level with
 * each other and with text. Stroke follows currentColor.
 */

type IconProps = { size?: number }

function Icon({ size = 16, children }: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const SplitRightIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2" />
    <path d="M8 2.5v11" />
    <path d="M10.2 8h2.3M11.35 6.85v2.3" />
  </Icon>
)

export const SplitDownIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2" />
    <path d="M2 8h12" />
    <path d="M6.85 10.75h2.3M8 9.6v2.3" />
  </Icon>
)

export const GlobeIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M2.25 8h11.5" />
    <path d="M8 2.25c1.6 1.6 2.4 3.5 2.4 5.75S9.6 12.15 8 13.75C6.4 12.15 5.6 10.25 5.6 8S6.4 3.85 8 2.25Z" />
  </Icon>
)

export const TerminalIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2" />
    <path d="m4.75 6.25 2 1.75-2 1.75" />
    <path d="M8.5 10.25h2.75" />
  </Icon>
)

export const ExpandIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M9.5 2.75h3.75V6.5M6.5 13.25H2.75V9.5M13.25 2.75 9 7M2.75 13.25 7 9" />
  </Icon>
)

export const CollapseIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M13.25 6.5H9.5V2.75M2.75 9.5H6.5v3.75M9.5 6.5l3.75-3.75M6.5 9.5l-3.75 3.75" />
  </Icon>
)

export const CloseIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m4.25 4.25 7.5 7.5M11.75 4.25l-7.5 7.5" />
  </Icon>
)

export const EvenOutIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2" />
    <path d="M6 2.5v11M10 2.5v11" />
  </Icon>
)

export const GearIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.42 3.58l-1.06 1.06M4.64 11.36l-1.06 1.06M12.42 12.42l-1.06-1.06M4.64 4.64 3.58 3.58" />
    <circle cx="8" cy="8" r="4.25" />
  </Icon>
)

export const BackIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M9.75 3.75 5.5 8l4.25 4.25" />
  </Icon>
)

export const ForwardIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M6.25 3.75 10.5 8l-4.25 4.25" />
  </Icon>
)

export const ReloadIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M12.75 8a4.75 4.75 0 1 1-1.4-3.36" />
    <path d="M12.75 2.75v2.5h-2.5" />
  </Icon>
)

export const StopIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m5 5 6 6M11 5l-6 6" />
  </Icon>
)

export const PlusIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M8 3.25v9.5M3.25 8h9.5" />
  </Icon>
)

/** A miniature of a preset grid: the picture is the label. */
export function GridGlyph({ cols, rows }: { cols: number; rows: number }): React.JSX.Element {
  const width = 20
  const height = 14
  const gap = 1.5
  const cellW = (width - gap * (cols - 1)) / cols
  const cellH = (height - gap * (rows - 1)) / rows
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {Array.from({ length: rows * cols }, (_, i) => (
        <rect
          key={i}
          x={(i % cols) * (cellW + gap)}
          y={Math.floor(i / cols) * (cellH + gap)}
          width={cellW}
          height={cellH}
          rx={Math.min(1.5, cellW / 3)}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}
