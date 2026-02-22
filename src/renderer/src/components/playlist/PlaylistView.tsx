import { useState, useMemo } from 'react'
import { PlaylistInput } from './PlaylistInput'
import { TrackRow } from './TrackRow'
import { usePlaylistStore } from '../../store/playlistStore'
import { useDownloadStore } from '../../store/downloadStore'
import { useDownload } from '../../hooks/useDownload'
import { useWolfMode } from '../../hooks/useWolfMode'
import { Checkbox } from '../ui/Checkbox'
import { PlaylistLoader } from '../ui/PlaylistLoader'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export function PlaylistView(): JSX.Element {
  const { currentPlaylist, loading, loadedFromCache, refreshPlaylist } = usePlaylistStore()
  const { startDownload, isDownloading } = useDownload()
  const downloads = useDownloadStore((s) => s.downloads)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const wolfMode = useWolfMode()

  const allIds = useMemo(
    () => new Set(currentPlaylist?.tracks.map((t) => t.id) ?? []),
    [currentPlaylist]
  )

  const allSelected = currentPlaylist ? selected.size === currentPlaylist.tracks.length : false

  // Download completion summary
  const downloadSummary = useMemo(() => {
    if (downloads.size === 0) return null
    const all = Array.from(downloads.values())
    const stillActive = all.some(
      (d) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
    )
    if (stillActive) return null

    const done = all.filter((d) => d.status === 'done').length
    const skipped = all.filter((d) => d.status === 'skipped').length
    const errors = all.filter((d) => d.status === 'error').length
    return { done, skipped, errors, total: all.length }
  }, [downloads])

  const toggleOne = (trackId: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }

  const toggleAll = (): void => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  const handleDownload = (): void => {
    if (selected.size > 0) {
      startDownload(selected)
    } else {
      startDownload()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Fetch Playlist</h2>
        <PlaylistInput />
      </div>

      {loading && (
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 300px)' }}>
          <PlaylistLoader wolfMode={wolfMode} />
        </div>
      )}

      {downloadSummary && !loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-surface border border-border-default text-sm">
          <span className="text-accent font-medium">Download complete</span>
          <span className="text-text-secondary">
            {downloadSummary.done}/{downloadSummary.total} downloaded
            {downloadSummary.skipped > 0 && ` · ${downloadSummary.skipped} skipped`}
            {downloadSummary.errors > 0 && ` · ${downloadSummary.errors} failed`}
          </span>
        </div>
      )}

      {currentPlaylist && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={currentPlaylist.thumbnailUrl}
              alt=""
              className="w-20 h-20 rounded-lg object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{currentPlaylist.title}</h3>
                {loadedFromCache && (
                  <span className="text-xs text-text-muted px-1.5 py-0.5 bg-bg-surface rounded">cached</span>
                )}
              </div>
              <p className="text-sm text-text-secondary">
                {currentPlaylist.channelTitle} · {currentPlaylist.tracks.length} tracks
              </p>
              {selected.size > 0 && (
                <p className="text-xs text-accent mt-1">
                  {selected.size} selected
                </p>
              )}
            </div>
            <button
              onClick={refreshPlaylist}
              disabled={loading}
              className="px-3 py-2.5 text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5 text-sm disabled:opacity-50"
              title="Refresh playlist from YouTube"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-inverted disabled:bg-bg-inset disabled:text-text-muted rounded-lg text-sm font-medium transition"
            >
              {isDownloading
                ? 'Downloading...'
                : selected.size > 0
                  ? `Download ${selected.size} Selected`
                  : 'Download All'}
            </button>
          </div>

          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-1">
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none"
            >
              <Checkbox checked={allSelected} onChange={toggleAll} />
              Select all
            </button>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-text-muted hover:text-text-secondary transition"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="space-y-1">
            {currentPlaylist.tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                tracks={currentPlaylist.tracks}
                selected={selected.has(track.id)}
                onToggleSelect={() => toggleOne(track.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
