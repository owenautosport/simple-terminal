import { describe, expect, it } from 'vitest'
import { PRESET_SIZES, buildPreset, gridShape } from '@/layout/presets'
import { layoutRects, listPanes, readingOrder } from '@/layout/tree'

let counter = 0
const makePane = (): { id: string; sessionId: string } => {
  counter += 1
  return { id: `p${counter}`, sessionId: `s${counter}` }
}

describe('gridShape', () => {
  it('picks wide-ish grids for each supported size', () => {
    expect(gridShape(1)).toEqual({ cols: 1, rows: 1 })
    expect(gridShape(2)).toEqual({ cols: 2, rows: 1 })
    expect(gridShape(4)).toEqual({ cols: 2, rows: 2 })
    expect(gridShape(6)).toEqual({ cols: 3, rows: 2 })
    expect(gridShape(8)).toEqual({ cols: 4, rows: 2 })
    expect(gridShape(9)).toEqual({ cols: 3, rows: 3 })
    expect(gridShape(12)).toEqual({ cols: 4, rows: 3 })
    expect(gridShape(16)).toEqual({ cols: 4, rows: 4 })
  })
})

describe('buildPreset', () => {
  it('produces exactly n panes for every preset size', () => {
    for (const n of PRESET_SIZES) {
      counter = 0
      expect(listPanes(buildPreset(n, makePane))).toHaveLength(n)
    }
  })

  it('lays panes out in an even grid', () => {
    counter = 0
    const tree = buildPreset(4, makePane)
    const rects = layoutRects(tree, { x: 0, y: 0, w: 100, h: 100 })
    const sizes = [...rects.values()].map((r) => `${r.w}x${r.h}`)
    expect(new Set(sizes)).toEqual(new Set(['50x50']))
  })

  it('hands out panes in reading order: left to right, then top to bottom', () => {
    counter = 0
    const tree = buildPreset(6, makePane)
    expect(readingOrder(tree).map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
  })

  it('builds columns, so a pane is paired with the one above or below it', () => {
    counter = 0
    const tree = buildPreset(4, makePane)
    expect(tree.kind === 'split' && tree.dir).toBe('h')
  })

  it('rejects an unsupported size', () => {
    expect(() => buildPreset(5, makePane)).toThrow(/unsupported/i)
  })
})
