import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { LibraryService } from '../services/library.service'

export function registerLibraryIpc(): void {
  const library = new LibraryService()

  ipcMain.handle(IpcChannels.LIBRARY_GET, async () => {
    return library.load()
  })

  ipcMain.handle(IpcChannels.LIBRARY_GET_TRACK_PATH, async (_event, trackId: string) => {
    const data = library.load()
    for (const pl of data.playlists) {
      const track = pl.tracks.find((t) => t.id === trackId)
      if (track?.filePath) return track.filePath
    }
    return null
  })
}
