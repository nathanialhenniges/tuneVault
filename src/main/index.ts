import { app, shell, BrowserWindow, globalShortcut, nativeImage, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpc } from './ipc/register'
import { createTray } from './tray'

function getIconPath(): string {
  return is.dev
    ? join(app.getAppPath(), 'build', 'icon.png')
    : join(process.resourcesPath, 'icon.png')
}

// Register custom protocol for serving local audio files
// This avoids CSP and cross-origin issues with file:// URLs
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tunevault',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'TuneVault',
    icon: getIconPath(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nathanialhenniges.tunevault')
  app.setName('TuneVault')

  // Set About panel for macOS to show TuneVault instead of Electron
  if (process.platform === 'darwin') {
    const iconPath = is.dev
      ? join(app.getAppPath(), 'build', 'icon.png')
      : join(process.resourcesPath, 'icon.png')
    app.setAboutPanelOptions({
      applicationName: 'TuneVault',
      applicationVersion: app.getVersion(),
      copyright: '© 2025 Nathanial Henniges',
      iconPath
    })
  }

  // Handle tunevault:// protocol requests — serve local audio files
  protocol.handle('tunevault', (request) => {
    // URL format: tunevault://audio/<encoded-file-path>
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    // On Windows paths don't start with /, on macOS/Linux they do
    const resolvedPath = process.platform === 'win32' ? filePath : '/' + filePath
    const fileUrl = pathToFileURL(resolvedPath).href

    // Forward Range headers so HTML5 <audio> seeking works
    return net.fetch(fileUrl, {
      headers: request.headers
    })
  })

  // Set dock icon in dev mode (production uses electron-builder config)
  if (process.platform === 'darwin') {
    const iconPath = is.dev
      ? join(app.getAppPath(), 'build', 'icon.png')
      : join(process.resourcesPath, 'icon.png')
    try {
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon)
      }
    } catch {
      // Icon may not exist yet
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()
  registerAllIpc(mainWindow)
  createTray(mainWindow)

  // Media key support
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('tray:toggle-play')
  })
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('tray:next')
  })
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('tray:prev')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      registerAllIpc(w)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
