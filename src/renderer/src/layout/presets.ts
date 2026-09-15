import type { LayoutNode, PaneId, SessionId } from '@shared/types'
import { gridShape } from '@shared/presets'
import { leaf } from './tree'

export { PRESET_SIZES, gridShape } from '@shared/presets'
export type { PresetSize } from '@shared/presets'

/**
 * Builds an even cols x rows grid. `makePane` is called once per slot in reading
 * order (left to right, then down), so a caller can hand existing panes the first
 * slots and fresh ones the rest.
 *
 * The tree is a row of columns rather than a column of rows: each pane's sibling
 * is the pane above or below it, so closing one lets its column-mate grow to fill
 * the gap vertically instead of stretching a neighbour sideways.
 */
export function buildPreset(
  size: number,
  makePane: () => { id: PaneId; sessionId: SessionId }
): LayoutNode {
  const { cols, rows } = gridShape(size)
  const cells = Array.from({ length: cols * rows }, () => {
    const pane = makePane()
    return leaf(pane.id, pane.sessionId)
  })

  // Halving keeps every pane the same size for powers of two and proportional otherwise.
  const line = (nodes: LayoutNode[], dir: 'h' | 'v'): LayoutNode => {
    if (nodes.length === 1) return nodes[0]!
    const first = Math.floor(nodes.length / 2)
    return {
      kind: 'split',
      dir,
      ratio: first / nodes.length,
      a: line(nodes.slice(0, first), dir),
      b: line(nodes.slice(first), dir)
    }
  }

  const columns = Array.from({ length: cols }, (_, c) =>
    line(
      Array.from({ length: rows }, (_, r) => cells[r * cols + c]!),
      'v'
    )
  )
  return line(columns, 'h')
}
