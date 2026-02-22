import { useEffect } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { SearchBar } from './SearchBar'
import { TrackList } from './TrackList'

export function LibraryView(): JSX.Element {
  const { loaded, load, getFilteredTracks, library } = useLibraryStore()

  useEffect(() => {
    if (!loaded) load()
  }, [loaded])

  const tracks = getFilteredTracks()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Library</h2>
            <p className="text-sm text-text-secondary mt-1">
              {tracks.length} tracks · {library.playlists.length} playlists
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
            title="Reload library"
          >
            ↻ Reload
          </button>
        </div>
        <SearchBar />
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Your library is empty</p>
          <p className="text-sm mt-1">Download some playlists to get started</p>
        </div>
      ) : (
        <TrackList tracks={tracks} />
      )}
    </div>
  )
}
