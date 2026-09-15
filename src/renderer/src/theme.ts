import type { ITheme } from '@xterm/xterm'

/**
 * Terminal palettes. The app chrome reads its colours from CSS variables; these
 * match them, with the amber accent as the cursor so the focused prompt reads first.
 */
export const THEMES: Record<'dark' | 'light', ITheme> = {
  dark: {
    background: '#111419',
    foreground: '#d9dce3',
    cursor: '#f0b35a',
    cursorAccent: '#111419',
    selectionBackground: '#2e3a4b',
    scrollbarSliderBackground: 'rgba(228, 230, 235, 0.16)',
    scrollbarSliderHoverBackground: 'rgba(228, 230, 235, 0.28)',
    scrollbarSliderActiveBackground: 'rgba(228, 230, 235, 0.36)',
    black: '#1c2027',
    red: '#ef6b73',
    green: '#8fcf7a',
    yellow: '#e8c06a',
    blue: '#6fa8f5',
    magenta: '#c792ea',
    cyan: '#57c7bd',
    white: '#c9ced8',
    brightBlack: '#5d6473',
    brightRed: '#ff8f95',
    brightGreen: '#aee59a',
    brightYellow: '#f5d58c',
    brightBlue: '#97c0ff',
    brightMagenta: '#dcb0ff',
    brightCyan: '#86e0d8',
    brightWhite: '#f2f4f8'
  },
  light: {
    background: '#fafbfc',
    foreground: '#262a33',
    cursor: '#b86e00',
    cursorAccent: '#fafbfc',
    selectionBackground: '#d4e0f0',
    black: '#262a33',
    red: '#c7343d',
    green: '#2f7d32',
    yellow: '#936200',
    blue: '#2563c9',
    magenta: '#8246c9',
    cyan: '#0d8178',
    white: '#e3e7ed',
    brightBlack: '#6b7280',
    brightRed: '#dd4a52',
    brightGreen: '#3c9a40',
    brightYellow: '#b07a00',
    brightBlue: '#3f7fe6',
    brightMagenta: '#9a5fe0',
    brightCyan: '#149c91',
    brightWhite: '#ffffff'
  }
}
