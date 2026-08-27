# Simple Terminal — design

Date: 2026-08-27
Status: approved, v1 in build

## Purpose

An open-source desktop terminal manager: one window, tabbed workspaces, each workspace a
resizable grid of live terminals. It reimplements the *multi-terminal management* idea found
in commercial tools like BridgeSpace — many shells visible at once, split/snap/tidy layouts,
keyboard-first navigation, layouts that survive a restart — as a small MIT-licensed app.

Written from scratch. No third-party application code, assets or branding is copied.

## Non-goals (v1)

File-browser sidebar, code editor, agent/task board, voice input, remote/SSH sessions.
**Command blocks** (Warp-style per-command collapsible output with success/failure marks) are
deferred to phase 2: doing them properly requires OSC 133 semantic-prompt shell integration
(injecting marks into the user's zsh/bash rc), which is a feature in its own right.

## Architecture

Electron, three processes, strict boundaries.

**Main process** owns every PTY (`node-pty`). A `SessionRegistry` maps `sessionId -> IPty`.
It exposes exactly five operations: create, write, resize, kill, and a data callback. It knows
nothing about layout, tabs or panes.

**Renderer** owns all UI (React + TypeScript, built by `electron-vite`). One `@xterm/xterm`
instance per pane, with the fit, search, web-links and WebGL addons. Terminal instances are
held in a `Map` outside React state — React renders the container `<div>`, xterm owns its
contents.

**Preload** exposes a narrow typed bridge over `contextBridge`:
`createSession`, `write`, `resize`, `kill`, `onData`, `onExit`, plus store read/write.
`nodeIntegration: false`, `contextIsolation: true`, `sandbox: false` (node-pty needs the
preload to reach IPC only; no Node in the renderer).

Data flow:

- keystroke → `term.onData` → IPC `pty:write` → `pty.write()`
- pty output → `pty.onData` → IPC `pty:data` → `term.write()`
- layout change → `FitAddon.fit()` → cols/rows → IPC `pty:resize` → `pty.resize()`

### Layout tree (the testable core)

`src/renderer/src/layout/tree.ts` is pure TypeScript with zero Electron/React imports:

```ts
type Node =
  | { kind: 'leaf'; id: PaneId; sessionId: string }
  | { kind: 'split'; dir: 'h' | 'v'; ratio: number; a: Node; b: Node }
```

Pure functions: `splitPane`, `closePane`, `setRatio`, `tidy` (reset every ratio to 0.5),
`findPane`, `listPanes`, `neighbour(dir)` for directional focus movement, and
`buildPreset(n)` for the 1/2/4/6/8/9/12/16 layouts. All unit-tested; this is where the real
bugs live.

## Features (v1)

- Tabbed workspaces, each with its own pane tree and editable name
- Split focused pane horizontally/vertically; close pane (tree collapses correctly)
- Drag dividers to resize; preset layouts 1/2/4/6/8/9/12/16; **Tidy** re-squares the grid
- **Zoom**: temporarily maximise the focused pane, toggle back
- Per-pane working directory and optional startup command
- Pane title tracks the shell's OSC 0/2 title, falls back to the running command
- Keyboard-first: `⌘D`/`⌘⇧D` split, `⌘W` close pane, `⌘T` new tab, `⌘⌥←→↑↓` focus,
  `⌘1-9` tab, `⌘⇧Enter` zoom, `⌘F` search, `⌘K` quick switcher
- Persistence: layout, tab names and per-pane cwd written to `userData/workspaces.json`,
  restored on launch. PTYs do not survive a quit — restored panes get fresh shells.
- Settings: font family/size, theme (dark/light), default shell, scrollback length

## Error handling

- A PTY that exits leaves its pane in place showing `[process exited: <code>]` with a
  "restart" affordance; the layout is never mutated by a process death.
- `createSession` failure (bad shell, missing cwd) surfaces in the pane as an error line
  rather than throwing into React.
- A corrupt or unreadable `workspaces.json` is backed up to `workspaces.json.bak` and the app
  starts with a single default workspace instead of failing to launch.
- Renderer sends resize only for panes with non-zero dimensions, so a hidden/zoomed pane never
  drives a PTY to 0x0.

## Testing

- **Vitest** over `layout/tree.ts` and `layout/presets.ts`: split/close/ratio/tidy/neighbour
  invariants, preset pane counts and shapes, and the "closing the last pane in a split
  promotes its sibling" case.
- **Vitest** over the store: round-trip, corrupt-file recovery.
- **Integration**: spawn a real PTY through the session registry, run `echo hi`, assert the
  bytes come back and the process exits cleanly.
- **Manual smoke**: launch, open a 4-pane preset, run commands in each, quit, relaunch,
  confirm layout and cwds restore.

## Phase 2 (not now)

Command blocks via OSC 133, file-browser sidebar, session restore with scrollback replay,
Windows/Linux packaging beyond the default electron-builder targets.
