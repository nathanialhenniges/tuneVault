import { useDownloadStore } from '../../store/downloadStore'
import { usePlaylistStore } from '../../store/playlistStore'
import { DownloadItem } from './DownloadItem'

export function DownloadQueue(): JSX.Element {
  const downloads = useDownloadStore((s) => s.downloads)
  const isDownloading = useDownloadStore((s) => s.isDownloading)
  const clear = useDownloadStore((s) => s.clear)
  const cancelAll = useDownloadStore((s) => s.cancelAll)
  const playlist = usePlaylistStore((s) => s.currentPlaylist)

  const entries = Array.from(downloads.entries())
  const doneCount = entries.filter(([, d]) => d.status === 'done').length
  const errorCount = entries.filter(([, d]) => d.status === 'error').length
  const activeCount = entries.filter(
    ([, d]) => d.status !== 'done' && d.status !== 'error'
  ).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Downloads</h2>
          {entries.length > 0 && (
            <p className="text-sm text-text-secondary mt-1">
              {doneCount} of {entries.length} complete
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
    </div>
  )
}
