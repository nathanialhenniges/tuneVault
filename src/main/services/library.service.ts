import { app } from 'electron'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import type { LibraryData, Playlist, Track } from '../../shared/models'

const LIBRARY_VERSION = 1

export class LibraryService {
  private filePath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    this.filePath = join(userDataPath, 'library.json')
  }

  private loadRaw(): LibraryData {
    if (!existsSync(this.filePath)) {
      return { playlists: [], version: LIBRARY_VERSION }
    }
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      return JSON.parse(raw) as LibraryData
    } catch {
      return { playlists: [], version: LIBRARY_VERSION }
    }
  }

  load(): LibraryData {
    const data = this.loadRaw()
    for (const playlist of data.playlists) {
      playlist.tracks.sort((a, b) => a.position - b.position)
    }
    return data
  }

  save(data: LibraryData): void {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  upsertTrack(playlist: Playlist, track: Track): void {
    const data = this.loadRaw()
    let existingPlaylist = data.playlists.find((p) => p.id === playlist.id)

    if (!existingPlaylist) {
      existingPlaylist = { ...playlist, tracks: [] }
      data.playlists.push(existingPlaylist)
    }

    const trackIdx = existingPlaylist.tracks.findIndex((t) => t.id === track.id)
    if (trackIdx >= 0) {
      existingPlaylist.tracks[trackIdx] = track
    } else {
      existingPlaylist.tracks.push(track)
    }

    this.save(data)
  }

  deleteTracks(trackIds: string[]): void {
    const data = this.loadRaw()
    const idsSet = new Set(trackIds)

    for (const playlist of data.playlists) {
      // Find tracks to delete and remove their files
      for (const track of playlist.tracks) {
        if (idsSet.has(track.id) && track.filePath) {
          try {
            if (existsSync(track.filePath)) {
              unlinkSync(track.filePath)
            }
          } catch {
            // File may already be deleted
          }
        }
      }

      // Remove tracks from playlist
      playlist.tracks = playlist.tracks.filter((t) => !idsSet.has(t.id))
    }

    // Remove empty playlists
    data.playlists = data.playlists.filter((p) => p.tracks.length > 0)

    this.save(data)
  }

  /**
   * Verify all tracks still exist on disk. Remove any whose files are missing.
   * Returns the cleaned library data.
   */
  verify(): LibraryData {
    const data = this.loadRaw()
    let changed = false

    for (const playlist of data.playlists) {
      const before = playlist.tracks.length
      playlist.tracks = playlist.tracks.filter((t) => {
        if (!t.filePath) return false
        return existsSync(t.filePath)
      })
      if (playlist.tracks.length !== before) changed = true
    }

    // Remove empty playlists
    const beforePlaylists = data.playlists.length
    data.playlists = data.playlists.filter((p) => p.tracks.length > 0)
    if (data.playlists.length !== beforePlaylists) changed = true

    if (changed) this.save(data)
    for (const playlist of data.playlists) {
      playlist.tracks.sort((a, b) => a.position - b.position)
    }
    return data
  }

  writeTrackOrder(playlistDir: string, playlistId: string): void {
    const data = this.loadRaw()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) return
    const downloaded = pl.tracks
      .filter((t) => t.filePath)
      .sort((a, b) => a.position - b.position)
    const lines = downloaded.map((t, i) => {
      let line = `${i + 1}) ${t.artist} - ${t.title}`
      if (t.releaseDate) line += ` | Date: ${t.releaseDate}`
      if (t.bitrate) line += ` | Bitrate: ${t.bitrate}kbps`
      if (t.url) line += ` | URL: ${t.url}`
      return line
    })
    writeFileSync(join(playlistDir, 'track-order.txt'), lines.join('\n'), 'utf-8')
  }

  deleteAll(): void {
    const data = this.loadRaw()

    // Delete all audio files
    for (const playlist of data.playlists) {
      for (const track of playlist.tracks) {
        if (track.filePath) {
          try {
            if (existsSync(track.filePath)) {
              unlinkSync(track.filePath)
            }
          } catch {
            // File may already be deleted
          }
        }
      }
    }

    // Clear library
    this.save({ playlists: [], version: LIBRARY_VERSION })
  }
}
