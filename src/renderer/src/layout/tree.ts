import type { LayoutNode, PaneId, SessionId, SplitDir } from '@shared/types'

/**
 * Pure layout maths. No React, no Electron, no DOM — everything here is a plain
 * function over an immutable binary split tree, which is what makes it testable.
 *
 * Axis convention: dir 'h' places `a` left of `b`; dir 'v' places `a` above `b`.
 * `ratio` is the fraction of the parent taken by `a`.
 */

export type Leaf = Extract<LayoutNode, { kind: 'leaf' }>
export type Split = Extract<LayoutNode, { kind: 'split' }>
export type Direction = 'left' | 'right' | 'up' | 'down'
export type Path = ReadonlyArray<'a' | 'b'>

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MIN_RATIO = 0.05
const MAX_RATIO = 0.95
const EPSILON = 1e-6

export function leaf(id: PaneId, sessionId: SessionId): Leaf {
  return { kind: 'leaf', id, sessionId }
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
}

export function listPanes(node: LayoutNode): Leaf[] {
  if (node.kind === 'leaf') return [node]
  return [...listPanes(node.a), ...listPanes(node.b)]
}

export function findPane(node: LayoutNode, paneId: PaneId): Leaf | null {
  if (node.kind === 'leaf') return node.id === paneId ? node : null
  return findPane(node.a, paneId) ?? findPane(node.b, paneId)
}

/** Replaces `target` with a split holding the old pane and `incoming`. */
export function splitPane(
  node: LayoutNode,
  target: PaneId,
  dir: SplitDir,
  incoming: Leaf | { id: PaneId; sessionId: SessionId }
): LayoutNode {
  const newLeaf: Leaf = 'kind' in incoming ? incoming : leaf(incoming.id, incoming.sessionId)

  if (node.kind === 'leaf') {
    if (node.id !== target) return node
    return { kind: 'split', dir, ratio: 0.5, a: node, b: newLeaf }
  }

  const a = splitPane(node.a, target, dir, newLeaf)
  const b = a === node.a ? splitPane(node.b, target, dir, newLeaf) : node.b
  if (a === node.a && b === node.b) return node
  return { ...node, a, b }
}

/** Removes a pane, promoting its sibling into the split's place. Null once empty. */
export function closePane(node: LayoutNode, paneId: PaneId): LayoutNode | null {
  if (node.kind === 'leaf') return node.id === paneId ? null : node

  const a = closePane(node.a, paneId)
  if (a === null) return node.b
  if (a !== node.a) return { ...node, a }

  const b = closePane(node.b, paneId)
  if (b === null) return node.a
  if (b !== node.b) return { ...node, b }

  return node
}

export function setSessionId(node: LayoutNode, paneId: PaneId, sessionId: SessionId): LayoutNode {
  if (node.kind === 'leaf') return node.id === paneId ? { ...node, sessionId } : node
  const a = setSessionId(node.a, paneId, sessionId)
  const b = a === node.a ? setSessionId(node.b, paneId, sessionId) : node.b
  if (a === node.a && b === node.b) return node
  return { ...node, a, b }
}

/** Sets the ratio of the split reached by following `path` from the root. */
export function setRatioAt(node: LayoutNode, path: Path, ratio: number): LayoutNode {
  if (node.kind === 'leaf') return node
  const [head, ...rest] = path
  if (head === undefined) return { ...node, ratio: clampRatio(ratio) }
  if (head === 'a') return { ...node, a: setRatioAt(node.a, rest, ratio) }
  return { ...node, b: setRatioAt(node.b, rest, ratio) }
}

/** Re-squares the layout: every split back to an even share. */
export function tidy(node: LayoutNode): LayoutNode {
  if (node.kind === 'leaf') return node
  return { ...node, ratio: 0.5, a: tidy(node.a), b: tidy(node.b) }
}

/** Geometry for every pane, used for hit-testing and directional focus. */
export function layoutRects(node: LayoutNode, viewport: Rect): Map<PaneId, Rect> {
  const rects = new Map<PaneId, Rect>()

  const walk = (current: LayoutNode, rect: Rect): void => {
    if (current.kind === 'leaf') {
      rects.set(current.id, rect)
      return
    }
    const ratio = clampRatio(current.ratio)
    if (current.dir === 'h') {
      const wa = rect.w * ratio
      walk(current.a, { ...rect, w: wa })
      walk(current.b, { x: rect.x + wa, y: rect.y, w: rect.w - wa, h: rect.h })
    } else {
      const ha = rect.h * ratio
      walk(current.a, { ...rect, h: ha })
      walk(current.b, { x: rect.x, y: rect.y + ha, w: rect.w, h: rect.h - ha })
    }
  }

  walk(node, viewport)
  return rects
}

/**
 * The pane a directional focus move should land on: the nearest pane on that side
 * that still overlaps the current one on the perpendicular axis.
 */
export function neighbour(node: LayoutNode, paneId: PaneId, dir: Direction): PaneId | null {
  const rects = layoutRects(node, { x: 0, y: 0, w: 1000, h: 1000 })
  const from = rects.get(paneId)
  if (!from) return null

  let best: { id: PaneId; distance: number; overlap: number } | null = null

  for (const [id, rect] of rects) {
    if (id === paneId) continue

    let distance: number
    let overlap: number

    if (dir === 'left' || dir === 'right') {
      distance = dir === 'left' ? from.x - (rect.x + rect.w) : rect.x - (from.x + from.w)
      overlap = Math.min(from.y + from.h, rect.y + rect.h) - Math.max(from.y, rect.y)
    } else {
      distance = dir === 'up' ? from.y - (rect.y + rect.h) : rect.y - (from.y + from.h)
      overlap = Math.min(from.x + from.w, rect.x + rect.w) - Math.max(from.x, rect.x)
    }

    if (distance < -EPSILON || overlap <= EPSILON) continue
    if (!best || distance < best.distance - EPSILON || (Math.abs(distance - best.distance) <= EPSILON && overlap > best.overlap)) {
      best = { id, distance, overlap }
    }
  }

  return best?.id ?? null
}

/** Depth-first path to a pane, for addressing the splits above it. */
export function pathToPane(node: LayoutNode, paneId: PaneId, path: Array<'a' | 'b'> = []): Path | null {
  if (node.kind === 'leaf') return node.id === paneId ? path : null
  return pathToPane(node.a, paneId, [...path, 'a']) ?? pathToPane(node.b, paneId, [...path, 'b'])
}

export function nodeAt(node: LayoutNode, path: Path): LayoutNode | null {
  let current: LayoutNode = node
  for (const step of path) {
    if (current.kind !== 'split') return null
    current = step === 'a' ? current.a : current.b
  }
  return current
}

export interface Divider {
  /** Path to the split this divider resizes. */
  path: Path
  dir: SplitDir
  /** The draggable strip itself. */
  rect: Rect
  /** The area the split occupies, needed to turn a drag position into a ratio. */
  parentRect: Rect
}

/** One draggable strip per split, centred on the boundary between its children. */
export function layoutDividers(node: LayoutNode, viewport: Rect, thickness = 6): Divider[] {
  const dividers: Divider[] = []

  const walk = (current: LayoutNode, rect: Rect, path: Array<'a' | 'b'>): void => {
    if (current.kind === 'leaf') return
    const ratio = clampRatio(current.ratio)

    if (current.dir === 'h') {
      const boundary = rect.x + rect.w * ratio
      dividers.push({
        path: [...path],
        dir: 'h',
        rect: { x: boundary - thickness / 2, y: rect.y, w: thickness, h: rect.h },
        parentRect: rect
      })
      walk(current.a, { ...rect, w: rect.w * ratio }, [...path, 'a'])
      walk(
        current.b,
        { x: boundary, y: rect.y, w: rect.w - rect.w * ratio, h: rect.h },
        [...path, 'b']
      )
    } else {
      const boundary = rect.y + rect.h * ratio
      dividers.push({
        path: [...path],
        dir: 'v',
        rect: { x: rect.x, y: boundary - thickness / 2, w: rect.w, h: thickness },
        parentRect: rect
      })
      walk(current.a, { ...rect, h: rect.h * ratio }, [...path, 'a'])
      walk(
        current.b,
        { x: rect.x, y: boundary, w: rect.w, h: rect.h - rect.h * ratio },
        [...path, 'b']
      )
    }
  }

  walk(node, viewport, [])
  return dividers
}
