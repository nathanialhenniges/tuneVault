import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { BinaryService } from './binary.service'
import type { MetadataEntry } from '../../shared/models'
import https from 'https'
import http from 'http'
import { createWriteStream } from 'fs'

export class FfmpegService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  /**
   * Tag audio file with rich metadata compatible with iTunes/Apple Music.
   * Downloads album art from thumbnail URL and embeds it.
   */
  async tagFile(
    filePath: string,
    metadata: {
      title: string
      artist: string
      album: string
      albumArtist: string
      track: number
      totalTracks: number
      date?: string
      genre?: string
      comment?: string
      thumbnailUrl?: string
    }
  ): Promise<void> {
    const ffmpegPath = this.binary.getFfmpegPath()
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const tmpOutput = filePath + '.tagged' + ext
    let thumbnailPath: string | null = null

    // Download thumbnail for album art embedding
    if (metadata.thumbnailUrl) {
      thumbnailPath = filePath + '.thumb.jpg'
      try {
        await this.downloadFile(metadata.thumbnailUrl, thumbnailPath)
      } catch {
        thumbnailPath = null
      }
    }

    const args: string[] = ['-i', filePath]

    // Add thumbnail as second input if available
    if (thumbnailPath && existsSync(thumbnailPath)) {
      args.push('-i', thumbnailPath)
    }

    // Metadata tags (iTunes-compatible)
    args.push(
      '-metadata', `title=${metadata.title}`,
      '-metadata', `artist=${metadata.artist}`,
      '-metadata', `album=${metadata.album}`,
      '-metadata', `album_artist=${metadata.albumArtist}`,
      '-metadata', `track=${metadata.track}/${metadata.totalTracks}`,
      '-metadata', `disc=1/1`
    )

    if (metadata.date) {
      args.push('-metadata', `date=${metadata.date}`)
      // Also write release_date for players that read TDRL (full date, not just year)
      args.push('-metadata', `release_date=${metadata.date}`)
    }
    if (metadata.genre) {
      args.push('-metadata', `genre=${metadata.genre}`)
    }
    if (metadata.comment) {
      args.push('-metadata', `comment=${metadata.comment}`)
    }

    // Encoder tag
    args.push('-metadata', 'encoded_by=TuneVault')

    // Handle format-specific options
    if (ext === '.mp3') {
      // For MP3: use ID3v2.4 tags (supports full date in TDRC frame)
      args.push('-id3v2_version', '4')
      args.push('-codec:a', 'copy')

      if (thumbnailPath && existsSync(thumbnailPath)) {
        // Embed album art for MP3
        args.push(
          '-map', '0:a',
          '-map', '1:v',
          '-metadata:s:v', 'title=Album cover',
          '-metadata:s:v', 'comment=Cover (front)'
        )
      } else {
        args.push('-map', '0:a')
      }
    } else if (ext === '.flac') {
      // For FLAC: Vorbis comments + embedded picture
      args.push('-codec:a', 'copy')

      if (thumbnailPath && existsSync(thumbnailPath)) {
        args.push(
          '-map', '0:a',
          '-map', '1:v',
          '-metadata:s:v', 'title=Album cover',
          '-metadata:s:v', 'comment=Cover (front)',
          '-disposition:v', 'attached_pic'
        )
      } else {
        args.push('-map', '0:a')
      }
    } else if (ext === '.opus' || ext === '.ogg') {
      // For Opus: Vorbis comments
      args.push('-codec:a', 'copy')
      args.push('-map', '0:a')
      // Opus in ogg doesn't support embedded images via ffmpeg easily,
      // so skip album art for opus
    } else {
      args.push('-codec', 'copy')
      args.push('-map', '0:a')
    }

    args.push('-y', tmpOutput)

    try {
      await this.runFfmpeg(ffmpegPath, args)

      // Replace original with tagged version
      const fs = await import('fs/promises')
      await fs.rename(tmpOutput, filePath)
    } catch (err) {
      // Clean up temp file on error
      if (existsSync(tmpOutput)) unlinkSync(tmpOutput)
      throw err
    } finally {
      // Clean up thumbnail
      if (thumbnailPath && existsSync(thumbnailPath)) {
        unlinkSync(thumbnailPath)
      }
    }
  }

  async writeMetadataFiles(
    entries: MetadataEntry[],
    outputDir: string,
    playlistTitle: string
  ): Promise<void> {
    const dir = join(outputDir, playlistTitle.replace(/[<>:"/\\|?*]/g, '').trim())
    mkdirSync(dir, { recursive: true })

    // Human-readable text file
    const textLines = [
      `Playlist: ${playlistTitle}`,
      `Downloaded: ${new Date().toISOString()}`,
      `Tracks: ${entries.length}`,
      '',
      '─'.repeat(60),
      ''
    ]

    for (const entry of entries) {
      const duration = this.formatDuration(entry.duration)
      textLines.push(
        `${String(entry.position).padStart(2, '0')}. ${entry.title}`,
        `    Artist: ${entry.artist}`,
        `    Duration: ${duration}`,
        `    URL: ${entry.videoUrl}`,
        ''
      )
    }

    writeFileSync(join(dir, '_metadata.txt'), textLines.join('\n'), 'utf-8')

    // JSON file
    const jsonData = {
      playlist: playlistTitle,
      downloadedAt: new Date().toISOString(),
      trackCount: entries.length,
      tracks: entries
    }
    writeFileSync(join(dir, '_metadata.json'), JSON.stringify(jsonData, null, 2), 'utf-8')
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http
      const file = createWriteStream(destPath)

      client.get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject)
            return
          }
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      }).on('error', (err) => {
        file.close()
        if (existsSync(destPath)) unlinkSync(destPath)
        reject(err)
      })
    })
  }

  private runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args)
      let stderr = ''

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      })

      proc.on('error', reject)
    })
  }

  private formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
}
