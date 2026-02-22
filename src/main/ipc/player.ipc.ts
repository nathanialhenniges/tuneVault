import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { pathToFileURL } from 'url'

export function registerPlayerIpc(): void {
  ipcMain.handle(IpcChannels.PLAYER_GET_FILE_URL, async (_event, filePath: string) => {
    return pathToFileURL(filePath).href
  })
}
