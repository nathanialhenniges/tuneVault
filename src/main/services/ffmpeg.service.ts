import { spawn } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { BinaryService } from './binary.service'
import type { MetadataEntry } from '../../shared/models'

export class FfmpegService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  async tagFile(
    filePath: string,
    metadata: {
      title: string
      artist: string
      album: string
      track: number
      thumbnailUrl?: string
    }
  ): Promise<void> {
    const ffmpegPath = this.binary.getFfmpegPath()
    const tmpOutput = filePath + '.tmp' + filePath.substring(filePath.lastIndexOf('.'))

    const args = [
      '-i', filePath,
      '-metadata', `title=${metadata.title}`,
      '-metadata', `artist=${metadata.artist}`,
      '-metadata', `album=${metadata.album}`,
      '-metadata', `track=${metadata.track}`,
      '-codec', 'copy',
      '-y',
      tmpOutput
    ]

    await this.runFfmpeg(ffmpegPath, args)

    // Replace original with tagged version
    const fs = await import('fs/promises')
    await fs.rename(tmpOutput, filePath)
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
