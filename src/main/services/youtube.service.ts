import { spawn } from 'child_process'
import { BinaryService } from './binary.service'
import type { Playlist, Track } from '../../shared/models'

interface YtdlpFlatEntry {
  id: string
  title: string
  url: string
  duration: number | null
  uploader: string
  channel: string
  thumbnails?: Array<{ url: string; width?: number; height?: number }>
  playlist_title: string
  playlist_id: string
  playlist_index: number
  [key: string]: unknown
}

export class YouTubeService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  extractPlaylistId(url: string): string | null {
    const patterns = [
      /[?&]list=([a-zA-Z0-9_-]+)/,
      /^(PL[a-zA-Z0-9_-]+)$/,
      /^(UU[a-zA-Z0-9_-]+)$/,
      /^(OLAK[a-zA-Z0-9_-]+)$/
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  async fetchPlaylist(playlistUrl: string): Promise<Playlist> {
    const ytdlpPath = this.binary.getYtdlpPath()
    const entries = await this.runYtdlpFlat(ytdlpPath, playlistUrl)

    if (entries.length === 0) {
      throw new Error('No tracks found in playlist. It may be empty, private, or the URL is invalid.')
    }

    const first = entries[0]
    const playlistId = first.playlist_id || this.extractPlaylistId(playlistUrl) || playlistUrl
    const playlistTitle = first.playlist_title || 'Unknown Playlist'

    // Pick the best thumbnail from the first entry
    const thumbnailUrl = this.pickThumbnail(first)

    const tracks: Track[] = entries.map((entry, idx) => ({
      id: `${playlistId}_${entry.id}`,
      videoId: entry.id,
      title: entry.title || 'Unknown Title',
      artist: entry.channel || entry.uploader || 'Unknown Artist',
      duration: entry.duration ?? 0,
      thumbnailUrl: this.pickThumbnail(entry),
      playlistId,
      playlistTitle,
      position: entry.playlist_index ?? idx + 1
    }))

    return {
      id: playlistId,
      title: playlistTitle,
      channelTitle: first.channel || first.uploader || '',
      thumbnailUrl,
      tracks,
      fetchedAt: new Date().toISOString()
    }
  }

  private pickThumbnail(entry: YtdlpFlatEntry): string {
    // yt-dlp provides thumbnails array sorted by quality; pick a mid-high one
    if (entry.thumbnails?.length) {
      // Prefer a thumbnail around 480px wide, or the last (highest quality)
      const preferred = entry.thumbnails.find((t) => (t.width ?? 0) >= 480)
      return preferred?.url ?? entry.thumbnails[entry.thumbnails.length - 1].url
    }
    // Fallback to standard YouTube thumbnail URL
    return `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`
  }

  private runYtdlpFlat(ytdlpPath: string, playlistUrl: string): Promise<YtdlpFlatEntry[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--flat-playlist',
        '--dump-json',
        '--no-warnings',
        '--ignore-errors',
        playlistUrl
      ]

      const proc = spawn(ytdlpPath, args)
      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(`Failed to fetch playlist: ${stderr.trim() || `exit code ${code}`}`))
          return
        }

        // Each line is a separate JSON object (one per track)
        const entries: YtdlpFlatEntry[] = []
        const lines = stdout.trim().split('\n')

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            entries.push(JSON.parse(line) as YtdlpFlatEntry)
          } catch {
            // Skip malformed lines
          }
        }

        resolve(entries)
      })

      proc.on('error', (err) => {
        reject(new Error(`Failed to run yt-dlp: ${err.message}`))
      })
    })
  }
}
