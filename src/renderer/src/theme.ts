import type { ITheme } from '@xterm/xterm'

/** Terminal palettes. The app chrome reads its colours from CSS variables. */
export const THEMES: Record<'dark' | 'light', ITheme> = {
  dark: {
    background: '#14161d',
    foreground: '#d7dae2',
    cursor: '#7aa2f7',
    selectionBackground: '#2e3b58',
    black: '#1b1e26',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#c0caf5',
    brightBlack: '#4a5065',
    brightRed: '#ff9aae',
    brightGreen: '#b9f27c',
    brightYellow: '#f2cd84',
    brightBlue: '#9db9ff',
    brightMagenta: '#d3b7ff',
    brightCyan: '#a4e0ff',
    brightWhite: '#eceff7'
  },
  light: {
    background: '#fbfbfd',
    foreground: '#2b2f3a',
    cursor: '#2f6df6',
    selectionBackground: '#cfdcf7',
    black: '#2b2f3a',
    red: '#c7254e',
    green: '#2f7d32',
    yellow: '#9a6700',
    blue: '#2f6df6',
    magenta: '#8250df',
    cyan: '#0e7490',
    white: '#e8eaf0',
    brightBlack: '#6b7280',
    brightRed: '#e0456f',
    brightGreen: '#3f9e43',
    brightYellow: '#b98300',
    brightBlue: '#5b8bff',
    brightMagenta: '#9f6bf0',
    brightCyan: '#1f95b8',
    brightWhite: '#ffffff'
  }
}
