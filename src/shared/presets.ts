/** Preset grid sizes, shared because both the native menu and the renderer need them. */
export const PRESET_SIZES = [1, 2, 4, 6, 8, 9, 12, 16] as const
export type PresetSize = (typeof PRESET_SIZES)[number]

const SHAPES: Record<PresetSize, { cols: number; rows: number }> = {
  1: { cols: 1, rows: 1 },
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
  8: { cols: 4, rows: 2 },
  9: { cols: 3, rows: 3 },
  12: { cols: 4, rows: 3 },
  16: { cols: 4, rows: 4 }
}

export function gridShape(size: number): { cols: number; rows: number } {
  const shape = SHAPES[size as PresetSize]
  if (!shape) throw new Error(`unsupported preset size: ${size}`)
  return shape
}
