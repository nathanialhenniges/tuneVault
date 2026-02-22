import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { FfmpegService } from '../services/ffmpeg.service'
import type { Playlist, MetadataEntry } from '../../shared/models'

export function registerMetadataIpc(): void {
  ipcMain.handle(
    IpcChannels.METADATA_WRITE,
    async (_event, playlist: Playlist, outputDir: string) => {
      const ffmpeg = new FfmpegService()
      const entries: MetadataEntry[] = playlist.tracks.map((t) => ({
        position: t.position,
        title: t.title,
        artist: t.artist,
        videoId: t.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${t.videoId}`,
        duration: t.duration,
        thumbnailUrl: t.thumbnailUrl
      }))
      await ffmpeg.writeMetadataFiles(entries, outputDir, playlist.title)
      return { success: true }
    }
  )
}
