import type { LayoutNode, PaneId, SessionId } from '@shared/types'
import { gridShape } from '@shared/presets'
import { leaf } from './tree'

export { PRESET_SIZES, gridShape } from '@shared/presets'
export type { PresetSize } from '@shared/presets'

/**
 * Builds an even cols x rows grid as nested splits: a column of rows, each row a
 * line of panes. `makePane` supplies fresh pane and session ids.
 */
export function buildPreset(
  size: number,
  makePane: () => { id: PaneId; sessionId: SessionId }
): LayoutNode {
  const { cols, rows } = gridShape(size)

  // Halving keeps every pane the same size for powers of two and proportional otherwise.
  const line = (count: number, dir: 'h' | 'v', make: () => LayoutNode): LayoutNode => {
    if (count === 1) return make()
    const first = Math.floor(count / 2)
    const second = count - first
    return {
      kind: 'split',
      dir,
      ratio: first / count,
      a: line(first, dir, make),
      b: line(second, dir, make)
    }
  }

  const makeRow = (): LayoutNode =>
    line(cols, 'h', () => {
      const pane = makePane()
      return leaf(pane.id, pane.sessionId)
    })

  return line(rows, 'v', makeRow)
}
