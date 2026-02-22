import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { YtdlpService } from '../services/ytdlp.service'
import { FfmpegService } from '../services/ffmpeg.service'
import { LibraryService } from '../services/library.service'
import type { DownloadRequest, Track } from '../../shared/models'

const activeDownloads = new Map<string, AbortController>()

export function registerDownloadIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IpcChannels.DOWNLOAD_START, async (_event, request: DownloadRequest) => {
    const { playlist, format, outputDir, concurrency } = request
    const ytdlp = new YtdlpService()
    const ffmpeg = new FfmpegService()
    const library = new LibraryService()

    const queue = [...playlist.tracks]
    const totalTracks = queue.length
    let active = 0
    let idx = 0

    const processNext = (): void => {
      while (active < concurrency && idx < queue.length) {
        const track = queue[idx++]
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

            try {
              await ffmpeg.tagFile(filePath, {
                title: track.title,
                artist: track.artist,
                album: playlist.title,
                albumArtist: playlist.channelTitle || track.artist,
                track: track.position,
                totalTracks,
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
              downloadedAt: new Date().toISOString()
            }
            library.upsertTrack(playlist, updatedTrack)
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_COMPLETE, {
              trackId: track.id,
              filePath
            })
          })
          .catch((err) => {
            if (controller.signal.aborted) return
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
    }
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL_ALL, async () => {
    for (const [trackId, controller] of activeDownloads) {
      controller.abort()
      activeDownloads.delete(trackId)
    }
  })
}
