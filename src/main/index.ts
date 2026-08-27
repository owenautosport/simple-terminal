import path from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { SessionRegistry } from './sessions.js'
import { Store, homeDir } from './store.js'
import { buildMenu } from './menu.js'
import type { CreateSessionOptions, PersistedState, SessionId } from '@shared/types'

const dirname = path.dirname(fileURLToPath(import.meta.url))

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
    backgroundColor: '#11131a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Links open in the user's browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
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

void app.whenReady().then(() => {
  store = new Store(app.getPath('userData'))
  registry = new SessionRegistry(
    (event) => send('pty:data', event),
    (event) => send('pty:exit', event)
  )

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
