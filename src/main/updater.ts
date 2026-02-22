import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IpcChannels } from '../shared/ipc-channels'

export function initUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send(IpcChannels.UPDATER_AVAILABLE, info)
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send(IpcChannels.UPDATER_PROGRESS, progress)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send(IpcChannels.UPDATER_DOWNLOADED)
  })

  // Check on launch and every 4 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {})
    },
    4 * 60 * 60 * 1000
  )
}

export { autoUpdater }
