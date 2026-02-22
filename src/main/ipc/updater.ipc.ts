import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { autoUpdater } from '../updater'

export function registerUpdaterIpc(): void {
  ipcMain.handle(IpcChannels.UPDATER_CHECK, async () => {
    return autoUpdater.checkForUpdates()
  })

  ipcMain.handle(IpcChannels.UPDATER_DOWNLOAD, async () => {
    return autoUpdater.downloadUpdate()
  })

  ipcMain.handle(IpcChannels.UPDATER_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })
}
