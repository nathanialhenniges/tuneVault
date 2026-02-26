import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '../../shared/ipc-channels'
import type { UpdateStatus } from '../../shared/models'

export function registerUpdateIpc(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  function sendStatus(status: UpdateStatus): void {
    mainWindow.webContents.send(IpcChannels.UPDATE_STATUS, status)
  }

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({ status: 'downloading', progress: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    sendStatus({ status: 'error', error: err.message })
  })

  ipcMain.handle(IpcChannels.UPDATE_CHECK, async () => {
    if (is.dev) {
      sendStatus({ status: 'not-available' })
      return
    }
    await autoUpdater.checkForUpdates()
  })

  ipcMain.handle(IpcChannels.UPDATE_DOWNLOAD, async () => {
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle(IpcChannels.UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })
}
