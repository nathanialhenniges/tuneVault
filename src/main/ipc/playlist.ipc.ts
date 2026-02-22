import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { YouTubeService } from '../services/youtube.service'
import type { Playlist } from '../../shared/models'

interface CacheEntry {
  playlist: Playlist
  cachedAt: number
}

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const playlistCache = new Map<string, CacheEntry>()

export function registerPlaylistIpc(): void {
  const yt = new YouTubeService()

  ipcMain.handle(IpcChannels.PLAYLIST_FETCH, async (_event, playlistUrl: string) => {
    const playlistId = yt.extractPlaylistId(playlistUrl)
    const cacheKey = playlistId || playlistUrl

    const cached = playlistCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.playlist
    }

    const playlist = await yt.fetchPlaylist(playlistUrl)
    playlistCache.set(playlist.id, { playlist, cachedAt: Date.now() })
    return playlist
  })
}
