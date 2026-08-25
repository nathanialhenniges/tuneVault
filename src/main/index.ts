import { app, shell, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerArtworkScheme, handleArtworkProtocol } from './artwork-protocol'
import { registerIpc, shutdownIpc } from './ipc/register'
import { buildAppMenu, registerAboutPanel } from './menu'
import { clearBadgeOnFocus } from './services/notify.service'
import { WindowStateService } from './services/window-state.service'

// Set the app name BEFORE `ready`. macOS reads the menu name and the userData
// directory at launch — doing this inside whenReady() is too late and leaves the
// menu as "Electron" with settings saved under the wrong folder.
app.setName('TuneVault')

// Downloads write to disk; two instances sharing one settings.json would clobber
// each other's device list.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  // Must happen before `ready`.
  registerArtworkScheme()

  process.on('uncaughtException', (err) => console.error('Uncaught exception:', err))
  process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason))

  /** Painted before the first frame so launch never flashes white. */
  const chassis = (): string => (nativeTheme.shouldUseDarkColors ? '#080b12' : '#f6f7f9')

  function createWindow(): BrowserWindow {
    const bounds = WindowStateService.load()
    const window = new BrowserWindow({
      ...bounds,
      minWidth: 900,
      minHeight: 560,
      show: false,
      title: 'TuneVault',
      icon: is.dev ? join(app.getAppPath(), 'build', 'icon.png') : undefined,
      // Full-height content with the traffic lights inset, the way Music, Mail
      // and Notes are drawn. The renderer provides its own drag strip.
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      backgroundColor: chassis(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    window.on('ready-to-show', () => window.show())
    WindowStateService.track(window)
    clearBadgeOnFocus(window)

    // Any link the app can't handle itself opens in the real browser, never in a
    // second Electron window.
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void window.loadFile(join(__dirname, '../renderer/index.html'))
    }
    return window
  }

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.nathanialhenniges.tunevault')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    registerAboutPanel()
    handleArtworkProtocol()
    registerIpc(() => mainWindow)
    buildAppMenu((channel) => mainWindow?.webContents.send(channel))
    mainWindow = createWindow()

    // The OS light/dark switch repaints the window backing; the renderer picks
    // the change up on its own through `prefers-color-scheme`.
    nativeTheme.on('updated', () => mainWindow?.setBackgroundColor(chassis()))

    // Clicking the Dock icon with no windows open must reopen one.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  // On macOS closing the last window must not quit the app.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Kill any running yt-dlp child so it can't outlive the app.
  app.on('before-quit', shutdownIpc)
}
