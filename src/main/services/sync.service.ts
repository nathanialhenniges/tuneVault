import { BrowserWindow } from 'electron'
import { YouTubeService } from './youtube.service'
import { LibraryService } from './library.service'
import { SettingsService } from './settings.service'
import { IpcChannels } from '../../shared/ipc-channels'
import type { SyncResult } from '../../shared/models'

export class SyncService {
  private timer: ReturnType<typeof setInterval> | null = null
  private youtube: YouTubeService
  private mainWindow: BrowserWindow | null = null
  private checking = false

  constructor() {
    this.youtube = new YouTubeService()
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  start(intervalHours: number): void {
    this.stop()
    const ms = intervalHours * 60 * 60 * 1000
    this.timer = setInterval(() => this.checkAll(), ms)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async checkAll(): Promise<void> {
    if (this.checking) return
    this.checking = true

    try {
      this.sendStatus(true)

      const settings = SettingsService.load()
      const syncedIds = settings.sync.syncedPlaylistIds
      if (syncedIds.length === 0) return

      const library = LibraryService.load()
      const libraryPlaylistIds = new Set(library.playlists.map((p) => p.id))

      for (const playlistId of syncedIds) {
        if (!libraryPlaylistIds.has(playlistId)) continue
        await this.checkOne(playlistId, library)
      }

      SettingsService.save({ sync: { ...settings.sync, lastSyncTime: new Date().toISOString() } })
    } catch (err) {
      console.error('Sync checkAll error:', err)
    } finally {
      this.checking = false
      this.sendStatus(false)
    }
  }

  async checkOne(
    playlistId: string,
    library?: ReturnType<typeof LibraryService.load>
  ): Promise<void> {
    try {
      const lib = library ?? LibraryService.load()
      const existingPlaylist = lib.playlists.find((p) => p.id === playlistId)
      if (!existingPlaylist) return

      const url = `https://www.youtube.com/playlist?list=${playlistId}`
      const fetched = await this.youtube.fetchPlaylist(url)

      const existingVideoIds = new Set(existingPlaylist.tracks.map((t) => t.videoId))
      const newTracks = fetched.tracks.filter((t) => !existingVideoIds.has(t.videoId))

      if (newTracks.length > 0) {
        const result: SyncResult = {
          playlistId,
          playlistTitle: fetched.title,
          newTracks,
          checkedAt: new Date().toISOString()
        }
        this.mainWindow?.webContents.send(IpcChannels.SYNC_RESULT, result)
      }
    } catch (err) {
      console.error(`Sync error for playlist ${playlistId}:`, err)
    }
  }

  private sendStatus(syncing: boolean): void {
    this.mainWindow?.webContents.send(IpcChannels.SYNC_STATUS, { syncing })
  }
}

export const syncService = new SyncService()
