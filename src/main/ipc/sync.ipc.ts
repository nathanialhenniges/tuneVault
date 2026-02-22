import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { SettingsService } from '../services/settings.service'
import { syncService } from '../services/sync.service'

export function registerSyncIpc(mainWindow: BrowserWindow): void {
  syncService.setMainWindow(mainWindow)

  ipcMain.handle(IpcChannels.SYNC_CHECK_NOW, async () => {
    await syncService.checkAll()
  })

  ipcMain.handle(IpcChannels.SYNC_TOGGLE_PLAYLIST, (_event, playlistId: string) => {
    const settings = SettingsService.load()
    const ids = settings.sync.syncedPlaylistIds
    const idx = ids.indexOf(playlistId)
    const syncedPlaylistIds = idx >= 0 ? ids.filter((id) => id !== playlistId) : [...ids, playlistId]
    const sync = { ...settings.sync, syncedPlaylistIds }
    SettingsService.save({ sync })

    // Restart timer if sync is enabled
    if (sync.enabled && syncedPlaylistIds.length > 0) {
      syncService.start(sync.intervalHours)
    } else {
      syncService.stop()
    }

    return sync
  })

  ipcMain.handle(IpcChannels.SYNC_DISMISS_TRACKS, () => {
    // Acknowledgement only — state managed renderer-side
  })

  // Auto-start sync timer if configured
  const settings = SettingsService.load()
  if (settings.sync.enabled && settings.sync.syncedPlaylistIds.length > 0) {
    syncService.start(settings.sync.intervalHours)
  }
}
