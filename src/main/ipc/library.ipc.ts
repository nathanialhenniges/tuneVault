import { ipcMain, shell } from 'electron'
import { dirname, join } from 'path'
import { statSync, existsSync, readFileSync } from 'fs'
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

  ipcMain.handle(IpcChannels.LIBRARY_DELETE_TRACKS, async (_event, trackIds: string[]) => {
    library.deleteTracks(trackIds)
  })

  ipcMain.handle(IpcChannels.LIBRARY_DELETE_ALL, async () => {
    library.deleteAll()
  })

  ipcMain.handle(IpcChannels.LIBRARY_VERIFY, async () => {
    return library.verify()
  })

  ipcMain.handle(IpcChannels.LIBRARY_GET_TRACK_ORDER_PATH, async (_event, playlistId: string) => {
    const data = library.load()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) return null
    const firstTrack = pl.tracks.find((t) => t.filePath)
    if (!firstTrack) return null
    const orderFile = join(dirname(firstTrack.filePath!), 'track-order.txt')
    return existsSync(orderFile) ? orderFile : null
  })

  ipcMain.handle(IpcChannels.LIBRARY_READ_TRACK_ORDER, async (_event, playlistId: string) => {
    const data = library.load()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) return null
    const firstTrack = pl.tracks.find((t) => t.filePath)
    if (!firstTrack) return null
    const orderFile = join(dirname(firstTrack.filePath!), 'track-order.txt')
    if (!existsSync(orderFile)) return null
    return readFileSync(orderFile, 'utf-8')
  })

  ipcMain.handle(IpcChannels.LIBRARY_OPEN_FILE, async (_event, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle(IpcChannels.LIBRARY_OPEN_FOLDER, async (_event, filePath: string) => {
    try {
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        shell.openPath(filePath)
      } else {
        shell.showItemInFolder(filePath)
      }
    } catch {
      // Path doesn't exist, try opening parent directory
      shell.openPath(dirname(filePath))
    }
  })
}
