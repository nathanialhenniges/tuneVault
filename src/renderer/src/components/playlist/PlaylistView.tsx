import { useState, useMemo, useEffect } from 'react'
import { PlaylistInput } from './PlaylistInput'
import { TrackRow } from './TrackRow'
import { usePlaylistStore } from '../../store/playlistStore'
import { useDownloadStore } from '../../store/downloadStore'
import { useDownload } from '../../hooks/useDownload'
import { useWolfMode } from '../../hooks/useWolfMode'
import { Checkbox } from '../ui/Checkbox'
import { PlaylistLoader } from '../ui/PlaylistLoader'
import {
  ArrowPathIcon,
  ClockIcon,
  MusicalNoteIcon
} from '@heroicons/react/24/outline'

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function PlaylistView(): JSX.Element {
  const { currentPlaylist, loading, loadedFromCache, refreshPlaylist } = usePlaylistStore()
  const { startDownload, isDownloading } = useDownload()
  const downloads = useDownloadStore((s) => s.downloads)
  const clearDownloads = useDownloadStore((s) => s.clear)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const wolfMode = useWolfMode()

  // Reset state when a new playlist is fetched
  useEffect(() => {
    setSelected(new Set())
    clearDownloads()
  }, [currentPlaylist])

  const allIds = useMemo(
    () => new Set(currentPlaylist?.tracks.map((t) => t.id) ?? []),
    [currentPlaylist]
  )

  const allSelected = currentPlaylist ? selected.size === currentPlaylist.tracks.length : false

  const totalDuration = useMemo(
    () => currentPlaylist?.tracks.reduce((sum, t) => sum + t.duration, 0) ?? 0,
    [currentPlaylist]
  )

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

  // Active download stats
  const downloadStats = useMemo(() => {
    if (downloads.size === 0) return null
    const all = Array.from(downloads.values())
    const active = all.filter(
      (d) => d.status === 'downloading' || d.status === 'converting' || d.status === 'tagging'
    ).length
    const done = all.filter((d) => d.status === 'done').length
    const total = all.length
    if (active === 0 && done === 0) return null
    return { active, done, total }
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
      // "Download All" — select all tracks in the UI to reflect the action
      if (currentPlaylist) {
        setSelected(new Set(allIds))
      }
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

      {!loading && !currentPlaylist && (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <MusicalNoteIcon className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-base">Paste a YouTube playlist URL to get started</p>
          <p className="text-sm mt-1 opacity-60">Your tracks will appear here</p>
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
          {/* Playlist header — sticky */}
          <div className="sticky top-0 z-10 bg-bg-base pb-3">
            <div className="flex items-center gap-4">
              <img
                src={currentPlaylist.thumbnailUrl}
                alt=""
                className="w-20 h-20 rounded-lg object-cover shadow-lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold truncate">{currentPlaylist.title}</h3>
                  {loadedFromCache && (
                    <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-bg-surface rounded shrink-0">cached</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">{currentPlaylist.channelTitle}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <MusicalNoteIcon className="w-3 h-3" />
                    {currentPlaylist.tracks.length} tracks
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {formatTotalDuration(totalDuration)}
                  </span>
                  {downloadStats && isDownloading && (
                    <span className="text-accent">
                      Downloading {downloadStats.done}/{downloadStats.total}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={refreshPlaylist}
                  disabled={loading}
                  className="p-2.5 text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-50"
                  title="Refresh playlist from YouTube"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-inverted disabled:bg-bg-inset disabled:text-text-muted rounded-lg text-sm font-medium transition"
                >
                  {isDownloading
                    ? 'Downloading...'
                    : selected.size > 0
                      ? `Download ${selected.size}`
                      : 'Download All'}
                </button>
              </div>
            </div>

            {/* Selection toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 mt-3 border-b border-border-subtle">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none hover:text-text-secondary transition"
              >
                <Checkbox checked={allSelected} onChange={toggleAll} />
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-accent font-medium">{selected.size} selected</span>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-text-muted hover:text-text-secondary transition"
                  >
                    Clear
                  </button>
                </>
              )}
              {/* Column labels */}
              <div className="ml-auto flex items-center gap-4 text-[10px] text-text-muted uppercase tracking-wider">
                <span className="w-12 text-right">Time</span>
                <span className="w-20 text-right">Status</span>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            {currentPlaylist.tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                tracks={currentPlaylist.tracks}
                selected={selected.has(track.id)}
                onToggleSelect={() => toggleOne(track.id)}
                downloadProgress={downloads.get(track.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
