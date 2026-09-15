import path from 'node:path'
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { SessionRegistry } from './sessions.js'
import { Store, homeDir } from './store.js'
import { buildMenu } from './menu.js'
import type { CreateSessionOptions, PersistedState, SessionId } from '@shared/types'
import { WEB_PANE_PARTITION, isWebUrl } from '@shared/url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
/** build/icon.png, from out/main at runtime. Packaged builds use the bundled .icns. */
const iconPath = path.join(dirname, '../../build/icon.png')

let mainWindow: BrowserWindow | null = null
let registry: SessionRegistry
let store: Store

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 400,
    show: false,
    backgroundColor: '#15181e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    ...(process.platform === 'darwin' ? {} : { icon: iconPath }),
    webPreferences: {
      preload: path.join(dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Web panes are <webview> guests; will-attach-webview below locks each one down.
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Links open in the user's browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // A web pane gets an ordinary sandboxed page and nothing of ours: no preload,
  // no Node, and only http(s) addresses.
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    if (!isWebUrl(params.src ?? '')) event.preventDefault()
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('pty:create', (_event, options: CreateSessionOptions) => registry.create(options))
  ipcMain.on('pty:write', (_event, sessionId: SessionId, data: string) =>
    registry.write(sessionId, data)
  )
  ipcMain.on('pty:resize', (_event, sessionId: SessionId, cols: number, rows: number) =>
    registry.resize(sessionId, cols, rows)
  )
  ipcMain.on('pty:kill', (_event, sessionId: SessionId) => registry.kill(sessionId))

  ipcMain.handle('store:read', () => store.read())
  ipcMain.handle('store:write', (_event, state: PersistedState) => {
    store.write(state)
    return true
  })

  ipcMain.handle('app:info', () => ({
    home: homeDir(),
    defaultShell: SessionRegistry.defaultShell(),
    platform: process.platform
  }))
}

/**
 * Electron grants every permission request by default. A web pane is an arbitrary
 * website, so it gets only the harmless ones; camera, microphone, location,
 * notifications and the rest are refused without a prompt.
 */
const WEB_PANE_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen'])

function guardWebPanePermissions(): void {
  const web = session.fromPartition(WEB_PANE_PARTITION)
  web.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(WEB_PANE_PERMISSIONS.has(permission))
  )
  web.setPermissionCheckHandler((_contents, permission) => WEB_PANE_PERMISSIONS.has(permission))
}

// A second instance would share workspaces.json with the first and silently
// overwrite its layout, so hand focus to the running window instead.
const hasInstanceLock = app.requestSingleInstanceLock()

if (!hasInstanceLock) {
  app.quit()
}

// Inside a web pane, links that want a new window open in the same pane, and
// navigation never leaves http(s).
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) void contents.loadURL(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!isWebUrl(url)) event.preventDefault()
  })
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

void app.whenReady().then(() => {
  if (!hasInstanceLock) return

  store = new Store(app.getPath('userData'))
  registry = new SessionRegistry(
    (event) => send('pty:data', event),
    (event) => send('pty:exit', event)
  )

  // Packaged macOS builds take their icon from the bundle; in development the
  // dock would otherwise show the generic Electron icon.
  if (process.platform === 'darwin' && !app.isPackaged) {
    try {
      app.dock?.setIcon(iconPath)
    } catch {
      // A missing icon during development is not worth failing the launch over.
    }
  }

  guardWebPanePermissions()
  registerIpc()
  buildMenu(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => registry?.killAll())
