import { Menu, app, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { PRESET_SIZES } from '@shared/presets'

/**
 * Native menu accelerators, rather than a renderer keydown handler: menu
 * accelerators fire before the focused xterm swallows the keystroke, so no
 * shortcut has to be wrestled away from the terminal.
 */
export function buildMenu(getWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'
  const send = (command: string, arg?: unknown): void => {
    getWindow()?.webContents.send('menu:command', { command, arg })
  }
  const item = (
    label: string,
    accelerator: string | undefined,
    command: string,
    arg?: unknown
  ): MenuItemConstructorOptions => ({ label, accelerator, click: () => send(command, arg) })

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              item('Settings…', 'CmdOrCtrl+,', 'settings'),
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'Shell',
      submenu: [
        item('New Tab', 'CmdOrCtrl+T', 'new-tab'),
        item('Close Tab', 'CmdOrCtrl+Shift+W', 'close-tab'),
        { type: 'separator' },
        item('Split Right', 'CmdOrCtrl+D', 'split', 'h'),
        item('Split Down', 'CmdOrCtrl+Shift+D', 'split', 'v'),
        item('Close Pane', 'CmdOrCtrl+W', 'close-pane'),
        item('Restart Pane', 'CmdOrCtrl+R', 'restart-pane'),
        ...(isMac ? [] : [{ type: 'separator' as const }, item('Settings…', 'Ctrl+,', 'settings')]),
        { type: 'separator' },
        ...(isMac ? [{ role: 'quit' as const }] : [{ role: 'close' as const }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        item('Find…', 'CmdOrCtrl+F', 'find'),
        item('Clear Terminal', 'CmdOrCtrl+K', 'clear'),
        item('Quick Switcher', 'CmdOrCtrl+P', 'quick-switcher')
      ]
    },
    {
      label: 'Layout',
      submenu: [
        {
          label: 'Preset',
          submenu: PRESET_SIZES.map((size, index) =>
            item(
              `${size} pane${size === 1 ? '' : 's'}`,
              index < 8 ? `CmdOrCtrl+Alt+${index + 1}` : undefined,
              'preset',
              size
            )
          )
        },
        item('Tidy', 'CmdOrCtrl+Shift+T', 'tidy'),
        item('Zoom Pane', 'CmdOrCtrl+Shift+Return', 'zoom'),
        { type: 'separator' },
        item('Focus Left', 'CmdOrCtrl+Alt+Left', 'focus', 'left'),
        item('Focus Right', 'CmdOrCtrl+Alt+Right', 'focus', 'right'),
        item('Focus Up', 'CmdOrCtrl+Alt+Up', 'focus', 'up'),
        item('Focus Down', 'CmdOrCtrl+Alt+Down', 'focus', 'down'),
        { type: 'separator' },
        item('Next Tab', 'Control+Tab', 'next-tab'),
        item('Previous Tab', 'Control+Shift+Tab', 'prev-tab'),
        ...Array.from({ length: 9 }, (_, i) =>
          item(`Tab ${i + 1}`, `CmdOrCtrl+${i + 1}`, 'select-tab', i)
        )
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Bigger Text', 'CmdOrCtrl+Plus', 'font-size', 1),
        item('Smaller Text', 'CmdOrCtrl+-', 'font-size', -1),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Project on GitHub',
          click: () => void shell.openExternal('https://github.com/owenautosport/simple-terminal')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
