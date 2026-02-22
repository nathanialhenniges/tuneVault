import { usePlaylistStore } from '../store/playlistStore'
import { useSettingsStore } from '../store/settingsStore'
import { useDownloadStore } from '../store/downloadStore'
import type { DownloadRequest, Track } from '../../../shared/models'

export function useDownload() {
  const playlist = usePlaylistStore((s) => s.currentPlaylist)
  const settings = useSettingsStore((s) => s.settings)
  const isDownloading = useDownloadStore((s) => s.isDownloading)

  const startDownload = async (selectedTrackIds?: Set<string>, forceRedownload?: boolean): Promise<void> => {
    if (!playlist) return

    // If specific tracks selected, filter; otherwise download all
    const tracks: Track[] = selectedTrackIds
      ? playlist.tracks.filter((t) => selectedTrackIds.has(t.id))
      : playlist.tracks

    if (tracks.length === 0) return

    const downloadPlaylist = { ...playlist, tracks }

    const request: DownloadRequest = {
      playlist: downloadPlaylist,
      format: settings.audioFormat,
      outputDir: settings.musicDir,
      concurrency: settings.concurrency,
      forceRedownload,
      dateFormat: settings.dateFormat,
      releaseDateSource: settings.releaseDateSource
    }

    for (const track of tracks) {
      useDownloadStore.getState().setProgress({
        trackId: track.id,
        videoId: track.videoId,
        percent: 0,
        speed: '',
        eta: '',
        status: 'queued'
      })
    }

    try {
      await window.api.startDownload(request)
    } catch (err) {
      console.error('Failed to start download:', err)
      // Mark all tracks as errored so UI reflects the failure
      for (const track of tracks) {
        useDownloadStore.getState().setError(track.id, err instanceof Error ? err.message : 'Download failed')
      }
    }
  }

  return { startDownload, isDownloading }
}
