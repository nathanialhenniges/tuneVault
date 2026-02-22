import { useState } from 'react'
import { useDownloadStore } from '../../store/downloadStore'
import { usePlaylistStore } from '../../store/playlistStore'
import { useDownload } from '../../hooks/useDownload'
import { DownloadItem } from './DownloadItem'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export function DownloadQueue(): JSX.Element {
  const downloads = useDownloadStore((s) => s.downloads)
  const isDownloading = useDownloadStore((s) => s.isDownloading)
  const clear = useDownloadStore((s) => s.clear)
  const cancelAll = useDownloadStore((s) => s.cancelAll)
  const playlist = usePlaylistStore((s) => s.currentPlaylist)
  const { startDownload } = useDownload()
  const [showRedownloadConfirm, setShowRedownloadConfirm] = useState(false)

  const entries = Array.from(downloads.entries())
  const doneCount = entries.filter(([, d]) => d.status === 'done').length
  const skippedCount = entries.filter(([, d]) => d.status === 'skipped').length
  const errorCount = entries.filter(([, d]) => d.status === 'error').length
  const activeCount = entries.filter(
    ([, d]) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
  ).length

  const handleRedownload = async (): Promise<void> => {
    setShowRedownloadConfirm(false)
    clear()
    await startDownload(undefined, true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Downloads</h2>
          {entries.length > 0 && (
            <p className="text-sm text-text-secondary mt-1">
              {doneCount} of {entries.length} complete
              {skippedCount > 0 && ` · ${skippedCount} skipped`}
              {errorCount > 0 && ` · ${errorCount} failed`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDownloading && activeCount > 0 && (
            <button
              onClick={cancelAll}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition"
            >
              Cancel All
            </button>
          )}

          {!isDownloading && entries.length > 0 && playlist && (
            <button
              onClick={() => setShowRedownloadConfirm(true)}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Redownload All
            </button>
          )}

          {!isDownloading && entries.length > 0 && (
            <button
              onClick={clear}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">No downloads in progress</p>
          <p className="text-sm mt-1">Fetch a playlist and click "Download All" to start</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(([trackId, progress]) => {
            const track = playlist?.tracks.find((t) => t.id === trackId)
            if (!track) return null
            return <DownloadItem key={trackId} track={track} progress={progress} />
          })}
        </div>
      )}

      {showRedownloadConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border-default rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Redownload All Tracks?</h3>
            <p className="text-sm text-text-secondary mb-6">
              This will re-download all {playlist?.tracks.length ?? 0} tracks and overwrite the existing files on disk.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRedownloadConfirm(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRedownload}
                className="px-4 py-2 text-sm text-text-inverted bg-accent hover:bg-accent-hover rounded-lg transition"
              >
                Redownload All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
