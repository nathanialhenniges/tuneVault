import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
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
}
