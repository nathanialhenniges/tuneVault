import { BrowserWindow } from 'electron'
import { registerPlaylistIpc } from './playlist.ipc'
import { registerDownloadIpc } from './download.ipc'
import { registerMetadataIpc } from './metadata.ipc'
import { registerLibraryIpc } from './library.ipc'
import { registerPlayerIpc } from './player.ipc'
import { registerUpdaterIpc } from './updater.ipc'
import { registerSettingsIpc } from './settings.ipc'

export function registerAllIpc(mainWindow: BrowserWindow): void {
  registerPlaylistIpc()
  registerDownloadIpc(mainWindow)
  registerMetadataIpc()
  registerLibraryIpc()
  registerPlayerIpc()
  registerUpdaterIpc()
  registerSettingsIpc()
}
