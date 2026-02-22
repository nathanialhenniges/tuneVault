import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'

export function registerPlayerIpc(): void {
  ipcMain.handle(IpcChannels.PLAYER_GET_FILE_URL, async (_event, filePath: string) => {
    // Use custom tunevault:// protocol to avoid CSP/cross-origin issues
    // Strip leading slash on macOS/Linux for consistent encoding
    const cleanPath = process.platform === 'win32' ? filePath : filePath.replace(/^\/+/, '')
    return `tunevault://audio/${encodeURIComponent(cleanPath)}`
  })
}
