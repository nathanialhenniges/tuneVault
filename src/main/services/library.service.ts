import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
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

  load(): LibraryData {
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

  save(data: LibraryData): void {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  upsertTrack(playlist: Playlist, track: Track): void {
    const data = this.load()
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
    const data = this.load()
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

  deleteAll(): void {
    const data = this.load()

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
