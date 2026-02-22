import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { mkdirSync, readdirSync, unlinkSync } from 'fs'
import { BinaryService } from './binary.service'
import type { Track, AudioFormat, DownloadProgress } from '../../shared/models'

interface DownloadOptions {
  track: Track
  format: AudioFormat
  outputDir: string
  playlistTitle: string
  onProgress: (progress: DownloadProgress) => void
  signal: AbortSignal
}

export class YtdlpService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  async download(options: DownloadOptions): Promise<string> {
    const { track, format, outputDir, playlistTitle, onProgress, signal } = options

    const playlistDir = join(outputDir, this.sanitizeFilename(playlistTitle))
    mkdirSync(playlistDir, { recursive: true })

    const paddedPos = String(track.position).padStart(2, '0')
    const filename = `${paddedPos} - ${this.sanitizeFilename(track.artist)} - ${this.sanitizeFilename(track.title)}`
    const outputTemplate = join(playlistDir, `${filename}.%(ext)s`)

    const ytdlpPath = this.binary.getYtdlpPath()
    const ffmpegPath = this.binary.getFfmpegPath()

    const args = [
      `https://www.youtube.com/watch?v=${track.videoId}`,
      '-f',
      'bestaudio',
      '--extract-audio',
      '--audio-format',
      format,
      '--audio-quality',
      '0',
      '--newline',
      '--progress',
      '--no-warnings',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      outputTemplate,
      '--embed-thumbnail',
      '--add-metadata'
    ]

    return new Promise<string>((resolve, reject) => {
      const proc: ChildProcess = spawn(ytdlpPath, args)
      let outputPath = ''

      signal.addEventListener('abort', () => {
        proc.kill('SIGTERM')
        reject(new Error('Download cancelled'))
      })

      onProgress({
        trackId: track.id,
        videoId: track.videoId,
        percent: 0,
        speed: '',
        eta: '',
        status: 'downloading'
      })

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString()

        // Parse progress from --newline output
        const progressMatch = line.match(/(\d+\.?\d*)%/)
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1])
          const speedMatch = line.match(/(\d+\.?\d*\s*[KMG]iB\/s)/)
          const etaMatch = line.match(/ETA\s+(\S+)/)

          onProgress({
            trackId: track.id,
            videoId: track.videoId,
            percent,
            speed: speedMatch?.[1] ?? '',
            eta: etaMatch?.[1] ?? '',
            status: percent >= 100 ? 'converting' : 'downloading'
          })
        }

        // Capture output file path
        const destMatch = line.match(/Destination:\s+(.+)/)
        if (destMatch) {
          outputPath = destMatch[1].trim()
        }
        const mergeMatch = line.match(/\[ExtractAudio\] Destination:\s+(.+)/)
        if (mergeMatch) {
          outputPath = mergeMatch[1].trim()
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString()
        // yt-dlp writes some output to stderr, check for actual errors
        if (line.includes('ERROR')) {
          onProgress({
            trackId: track.id,
            videoId: track.videoId,
            percent: 0,
            speed: '',
            eta: '',
            status: 'error',
            error: line.trim()
          })
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          onProgress({
            trackId: track.id,
            videoId: track.videoId,
            percent: 100,
            speed: '',
            eta: '',
            status: 'done'
          })

          // Determine the actual output path
          const ext = format === 'flac' ? 'flac' : format === 'opus' ? 'opus' : 'mp3'
          const finalPath = outputPath || join(playlistDir, `${filename}.${ext}`)

          // Clean up temp files left by yt-dlp (webm, m4a, part, jpg, webp, etc.)
          try {
            const files = readdirSync(playlistDir)
            const tempExts = ['.webm', '.m4a', '.part', '.jpg', '.webp', '.png', '.temp', '.tmp']
            for (const file of files) {
              if (file.startsWith(filename) && !file.endsWith(`.${ext}`)) {
                const fileExt = file.substring(file.lastIndexOf('.'))
                if (tempExts.includes(fileExt) || file.includes('.temp')) {
                  try { unlinkSync(join(playlistDir, file)) } catch { /* ignore */ }
                }
              }
            }
          } catch { /* ignore cleanup errors */ }

          resolve(finalPath)
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        reject(err)
      })
    })
  }

  async dumpJson(videoId: string): Promise<Record<string, unknown>> {
    const ytdlpPath = this.binary.getYtdlpPath()
    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '--dump-json',
      '--no-warnings'
    ]

    return new Promise((resolve, reject) => {
      const proc = spawn(ytdlpPath, args)
      let output = ''

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output))
          } catch {
            reject(new Error('Failed to parse yt-dlp JSON output'))
          }
        } else {
          reject(new Error(`yt-dlp --dump-json exited with code ${code}`))
        }
      })

      proc.on('error', reject)
    })
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()
  }
}
