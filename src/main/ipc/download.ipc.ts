import { ipcMain, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { IpcChannels } from '../../shared/ipc-channels'
import { join } from 'path'
import { YtdlpService } from '../services/ytdlp.service'
import { FfmpegService } from '../services/ffmpeg.service'
import { LibraryService } from '../services/library.service'
import { MusicBrainzService } from '../services/musicbrainz.service'
import type { DownloadRequest, Track, DateFormat } from '../../shared/models'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(raw: string, format: DateFormat): string {
  // Normalize: YYYYMMDD -> YYYY-MM-DD
  const normalized = raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw
  const parts = normalized.split('-')
  if (parts.length < 3) return raw
  const [yyyy, mm, dd] = parts
  switch (format) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`
    case 'YYYY-MM-DD': return normalized
    case 'DD Mon YYYY': return `${dd} ${MONTHS[parseInt(mm, 10) - 1] || mm} ${yyyy}`
    default: return normalized
  }
}

const activeDownloads = new Map<string, AbortController>()
const activeBatches = new Map<string, () => void>()
const cancelledTracks = new Set<string>()

export function registerDownloadIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IpcChannels.DOWNLOAD_START, async (_event, request: DownloadRequest) => {
    const { playlist, format, outputDir, concurrency, forceRedownload, dateFormat, releaseDateSource } = request
    const ytdlp = new YtdlpService()
    const ffmpeg = new FfmpegService()
    const library = new LibraryService()
    const musicbrainz = new MusicBrainzService()
    const effectiveDateFormat: DateFormat = dateFormat || 'MM/DD/YYYY'

    const queue = [...playlist.tracks]
    const totalTracks = queue.length
    let active = 0
    let idx = 0
    let cancelled = false

    // Store a reference so cancelAll can stop the queue
    const batchId = playlist.id
    activeBatches.set(batchId, () => { cancelled = true })

    const processNext = (): void => {
      if (cancelled) return
      while (active < concurrency && idx < queue.length) {
        const track = queue[idx++]

        // Skip tracks that were individually cancelled while queued
        if (!activeDownloads.has(track.id) && cancelledTracks.has(track.id)) {
          cancelledTracks.delete(track.id)
          continue
        }

        // Check if track already exists on disk — skip if so
        const playlistDir = join(outputDir, ytdlp.sanitizeFilename(playlist.title))
        const paddedPos = String(track.position).padStart(2, '0')
        const baseName = `${paddedPos} - ${ytdlp.sanitizeFilename(track.artist)} - ${ytdlp.sanitizeFilename(track.title)}`
        const ext = format === 'flac' ? 'flac' : format === 'opus' ? 'opus' : 'mp3'
        const expectedPath = join(playlistDir, `${baseName}.${ext}`)

        if (!forceRedownload && existsSync(expectedPath)) {
          mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
            trackId: track.id,
            videoId: track.videoId,
            percent: 100,
            speed: '',
            eta: '',
            status: 'skipped'
          })
          mainWindow.webContents.send(IpcChannels.DOWNLOAD_COMPLETE, {
            trackId: track.id,
            filePath: expectedPath
          })
          continue
        }

        active++
        const controller = new AbortController()
        activeDownloads.set(track.id, controller)

        ytdlp
          .download({
            track,
            format,
            outputDir,
            playlistTitle: playlist.title,
            onProgress: (progress) => {
              mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, progress)
            },
            signal: controller.signal
          })
          .then(async (filePath) => {
            // Tag with rich iTunes-compatible metadata
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
              trackId: track.id,
              videoId: track.videoId,
              percent: 100,
              speed: '',
              eta: '',
              status: 'tagging'
            })

            // Fetch metadata (release date + bitrate)
            let releaseDate: string | undefined
            let bitrate: number | undefined
            const trackUrl = `https://www.youtube.com/watch?v=${track.videoId}`

            try {
              const meta = await ytdlp.fetchTrackMeta(track.videoId)
              bitrate = meta.bitrate

              if (releaseDateSource === 'musicbrainz') {
                const mbDate = await musicbrainz.lookupReleaseDate(track.artist, track.title)
                releaseDate = mbDate || meta.releaseDate
              } else {
                releaseDate = meta.releaseDate
              }
            } catch {
              // Non-blocking — continue without metadata
            }

            const formattedDate = releaseDate ? formatDate(releaseDate, effectiveDateFormat) : undefined

            try {
              await ffmpeg.tagFile(filePath, {
                title: track.title,
                artist: track.artist,
                album: playlist.title,
                albumArtist: playlist.channelTitle || track.artist,
                track: track.position,
                totalTracks,
                date: formattedDate,
                comment: `Downloaded from YouTube by TuneVault`,
                thumbnailUrl: track.thumbnailUrl,
                genre: 'Music'
              })
            } catch (err) {
              console.error(`Failed to tag ${track.title}:`, err)
              // Continue even if tagging fails — file is still downloaded
            }

            const updatedTrack: Track = {
              ...track,
              filePath,
              format,
              downloadedAt: new Date().toISOString(),
              releaseDate: formattedDate,
              bitrate,
              url: trackUrl
            }
            library.upsertTrack(playlist, updatedTrack)
            const playlistDir = join(outputDir, ytdlp.sanitizeFilename(playlist.title))
            library.writeTrackOrder(playlistDir, playlist.id)
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_COMPLETE, {
              trackId: track.id,
              filePath
            })
          })
          .catch((err) => {
            if (controller.signal.aborted) {
              mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
                trackId: track.id,
                videoId: track.videoId,
                percent: 0,
                speed: '',
                eta: '',
                status: 'error',
                error: 'Cancelled'
              })
              return
            }
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_ERROR, {
              trackId: track.id,
              error: err.message
            })
          })
          .finally(() => {
            active--
            activeDownloads.delete(track.id)
            processNext()
          })
      }
    }

    processNext()
    return { started: queue.length }
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL, async (_event, trackId: string) => {
    const controller = activeDownloads.get(trackId)
    if (controller) {
      controller.abort()
      activeDownloads.delete(trackId)
    } else {
      // Track is still queued — mark it so processNext skips it
      cancelledTracks.add(trackId)
    }
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL_ALL, async () => {
    // Stop all batch queues from pulling new tracks
    for (const [, stop] of activeBatches) {
      stop()
    }
    activeBatches.clear()

    // Abort all active downloads
    for (const [trackId, controller] of activeDownloads) {
      controller.abort()
      activeDownloads.delete(trackId)
    }
  })
}
