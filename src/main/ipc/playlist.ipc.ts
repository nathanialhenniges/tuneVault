import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { YouTubeService } from '../services/youtube.service'

export function registerPlaylistIpc(): void {
  ipcMain.handle(IpcChannels.PLAYLIST_FETCH, async (_event, playlistUrl: string) => {
    const yt = new YouTubeService()
    return yt.fetchPlaylist(playlistUrl)
  })
}
