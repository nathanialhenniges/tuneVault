import { ipcMain, dialog } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { SettingsService } from '../services/settings.service'
import type { AppSettings } from '../../shared/models'

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, async () => {
    return SettingsService.load()
  })

  ipcMain.handle(IpcChannels.SETTINGS_SET, async (_event, settings: Partial<AppSettings>) => {
    SettingsService.save(settings)
    return SettingsService.load()
  })

  ipcMain.handle(IpcChannels.SETTINGS_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })
}
