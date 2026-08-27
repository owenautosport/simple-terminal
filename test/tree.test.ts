import { describe, expect, it } from 'vitest'
import type { LayoutNode } from '@shared/types'
import {
  closePane,
  findPane,
  layoutDividers,
  layoutRects,
  leaf,
  listPanes,
  neighbour,
  setRatioAt,
  setSessionId,
  splitPane,
  tidy
} from '@/layout/tree'

const single = (): LayoutNode => leaf('p1', 's1')

describe('leaf / listPanes / findPane', () => {
  it('a single leaf is one pane', () => {
    expect(listPanes(single()).map((p) => p.id)).toEqual(['p1'])
  })

  it('finds a pane by id and returns null for a stranger', () => {
    expect(findPane(single(), 'p1')?.sessionId).toBe('s1')
    expect(findPane(single(), 'nope')).toBeNull()
  })
})

describe('splitPane', () => {
  it('splits a leaf horizontally, new pane on the b side', () => {
    const tree = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    expect(tree).toEqual({
      kind: 'split',
      dir: 'h',
      ratio: 0.5,
      a: { kind: 'leaf', id: 'p1', sessionId: 's1' },
      b: { kind: 'leaf', id: 'p2', sessionId: 's2' }
    })
  })

  it('splits a nested leaf without disturbing its siblings', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const three = splitPane(two, 'p2', 'v', leaf('p3', 's3'))
    expect(listPanes(three).map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect((three as Extract<LayoutNode, { kind: 'split' }>).a).toEqual(leaf('p1', 's1'))
  })

  it('is a no-op when the target pane does not exist', () => {
    const tree = single()
    expect(splitPane(tree, 'ghost', 'h', leaf('p2', 's2'))).toEqual(tree)
  })

  it('does not mutate the input tree', () => {
    const tree = single()
    const snapshot = structuredClone(tree)
    splitPane(tree, 'p1', 'h', leaf('p2', 's2'))
    expect(tree).toEqual(snapshot)
  })
})

describe('closePane', () => {
  it('promotes the surviving sibling in place of the split', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    expect(closePane(two, 'p1')).toEqual(leaf('p2', 's2'))
  })

  it('promotes a whole subtree, not just a leaf', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const three = splitPane(two, 'p2', 'v', leaf('p3', 's3'))
    const closed = closePane(three, 'p1')
    expect(listPanes(closed!).map((p) => p.id)).toEqual(['p2', 'p3'])
    expect(closed!.kind).toBe('split')
  })

  it('returns null when the last pane is closed', () => {
    expect(closePane(single(), 'p1')).toBeNull()
  })

  it('is a no-op for an unknown pane', () => {
    const tree = single()
    expect(closePane(tree, 'ghost')).toEqual(tree)
  })
})

describe('setRatioAt / tidy', () => {
  it('sets the ratio of the split at a path', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const resized = setRatioAt(two, [], 0.8)
    expect((resized as Extract<LayoutNode, { kind: 'split' }>).ratio).toBe(0.8)
  })

  it('clamps ratios into a usable range', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    expect((setRatioAt(two, [], 0) as Extract<LayoutNode, { kind: 'split' }>).ratio).toBeGreaterThan(0)
    expect((setRatioAt(two, [], 1) as Extract<LayoutNode, { kind: 'split' }>).ratio).toBeLessThan(1)
  })

  it('tidy resets every ratio to even', () => {
    const two = setRatioAt(splitPane(single(), 'p1', 'h', leaf('p2', 's2')), [], 0.9)
    const three = setRatioAt(splitPane(two, 'p2', 'v', leaf('p3', 's3')), ['b'], 0.2)
    const tidied = tidy(three) as Extract<LayoutNode, { kind: 'split' }>
    expect(tidied.ratio).toBe(0.5)
    expect((tidied.b as Extract<LayoutNode, { kind: 'split' }>).ratio).toBe(0.5)
  })
})

describe('setSessionId', () => {
  it('swaps the session behind a pane, keeping the pane in place', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const restarted = setSessionId(two, 'p2', 's2-restarted')
    expect(findPane(restarted, 'p2')?.sessionId).toBe('s2-restarted')
    expect(findPane(restarted, 'p1')?.sessionId).toBe('s1')
  })
})

describe('layoutRects', () => {
  it('splits the viewport by ratio along the right axis', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const rects = layoutRects(two, { x: 0, y: 0, w: 100, h: 50 })
    expect(rects.get('p1')).toEqual({ x: 0, y: 0, w: 50, h: 50 })
    expect(rects.get('p2')).toEqual({ x: 50, y: 0, w: 50, h: 50 })

    const stacked = splitPane(single(), 'p1', 'v', leaf('p2', 's2'))
    const stackedRects = layoutRects(stacked, { x: 0, y: 0, w: 100, h: 50 })
    expect(stackedRects.get('p1')).toEqual({ x: 0, y: 0, w: 100, h: 25 })
    expect(stackedRects.get('p2')).toEqual({ x: 0, y: 25, w: 100, h: 25 })
  })
})

describe('neighbour', () => {
  const grid = (): LayoutNode => {
    // p1 p2
    // p3 p4
    const top = splitPane(leaf('p1', 's1'), 'p1', 'h', leaf('p2', 's2'))
    const withBottom = splitPane(top, 'p1', 'v', leaf('p3', 's3'))
    return splitPane(withBottom, 'p2', 'v', leaf('p4', 's4'))
  }

  it('moves between columns and rows', () => {
    const tree = grid()
    expect(neighbour(tree, 'p1', 'right')).toBe('p2')
    expect(neighbour(tree, 'p2', 'left')).toBe('p1')
    expect(neighbour(tree, 'p1', 'down')).toBe('p3')
    expect(neighbour(tree, 'p3', 'up')).toBe('p1')
  })

  it('returns null at the edge of the layout', () => {
    const tree = grid()
    expect(neighbour(tree, 'p1', 'left')).toBeNull()
    expect(neighbour(tree, 'p1', 'up')).toBeNull()
  })

  it('returns null for a single pane in every direction', () => {
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      expect(neighbour(single(), 'p1', dir)).toBeNull()
    }
  })
})

describe('layoutDividers', () => {
  it('places one divider per split, on the boundary', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const [divider] = layoutDividers(two, { x: 0, y: 0, w: 100, h: 40 }, 6)
    expect(divider).toEqual({
      path: [],
      dir: 'h',
      rect: { x: 47, y: 0, w: 6, h: 40 },
      parentRect: { x: 0, y: 0, w: 100, h: 40 }
    })
  })

  it('emits a divider for every split and none for a lone pane', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const three = splitPane(two, 'p2', 'v', leaf('p3', 's3'))
    expect(layoutDividers(three, { x: 0, y: 0, w: 100, h: 100 })).toHaveLength(2)
    expect(layoutDividers(single(), { x: 0, y: 0, w: 100, h: 100 })).toHaveLength(0)
  })

  it('gives nested dividers the parent rect they were drawn in', () => {
    const two = splitPane(single(), 'p1', 'h', leaf('p2', 's2'))
    const three = splitPane(two, 'p2', 'v', leaf('p3', 's3'))
    const nested = layoutDividers(three, { x: 0, y: 0, w: 100, h: 100 }).find(
      (d) => d.path.length === 1
    )
    expect(nested?.parentRect).toEqual({ x: 50, y: 0, w: 50, h: 100 })
  })
})
