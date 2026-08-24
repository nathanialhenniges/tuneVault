import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

const isMac = process.platform === 'darwin'
const REPO_URL = 'https://github.com/nathanialhenniges/tunevault'

/**
 * Explicit application menu. Electron's default menu is close but carries
 * developer items into shipped builds, and without `editMenu` the standard
 * Cmd+C / Cmd+V shortcuts do not work in text fields at all.
 *
 * Roles are used wherever one exists — they carry the native label, accelerator
 * and enabled state for free.
 */
export function buildAppMenu(send: (channel: string) => void): void {
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      // Ventura renamed Preferences to Settings; Cmd+, is expected either way.
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('menu:settings') },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Device…', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new-device') },
        {
          label: 'Add Audio Files…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('menu:import')
        },
        { type: 'separator' },
        {
          label: 'Open Device Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('menu:open-folder')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        // A shipped app with "Toggle Developer Tools" in its menu bar announces
        // itself as an Electron app.
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'TuneVault on GitHub', click: () => void shell.openExternal(REPO_URL) }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export function registerAboutPanel(): void {
  app.setAboutPanelOptions({
    applicationName: 'TuneVault',
    applicationVersion: app.getVersion(),
    copyright: 'Personal case-study project. Not affiliated with Spotify, Apple or YouTube.'
  })
}

/** Convenience for menu handlers that need the focused window. */
export function sendToWindow(window: BrowserWindow | null, channel: string): void {
  window?.webContents.send(channel)
}
