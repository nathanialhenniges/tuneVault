import { useState, useMemo } from 'react'
import { PlaylistInput } from './PlaylistInput'
import { TrackRow } from './TrackRow'
import { usePlaylistStore } from '../../store/playlistStore'
import { useDownload } from '../../hooks/useDownload'
import { Checkbox } from '../ui/Checkbox'

export function PlaylistView(): JSX.Element {
  const { currentPlaylist, loading } = usePlaylistStore()
  const { startDownload, isDownloading } = useDownload()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allIds = useMemo(
    () => new Set(currentPlaylist?.tracks.map((t) => t.id) ?? []),
    [currentPlaylist]
  )

  const allSelected = currentPlaylist ? selected.size === currentPlaylist.tracks.length : false

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
        <div className="flex items-center gap-3 text-text-secondary">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Fetching playlist...</span>
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
              <h3 className="text-lg font-semibold">{currentPlaylist.title}</h3>
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
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
              <Checkbox checked={allSelected} onChange={toggleAll} />
              Select all
            </label>
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
