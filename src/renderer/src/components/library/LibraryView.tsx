import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { SearchBar } from './SearchBar'
import { TrackList } from './TrackList'

export function LibraryView(): JSX.Element {
  const { loaded, load, getFilteredTracks, library, selectedTrackIds, selectAllTracks, clearSelection, deleteTracks, deleteAll } = useLibraryStore()
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded])

  const tracks = getFilteredTracks()
  const hasSelection = selectedTrackIds.size > 0
  const allSelected = tracks.length > 0 && selectedTrackIds.size === tracks.length

  const handleDeleteSelected = async (): Promise<void> => {
    await deleteTracks(Array.from(selectedTrackIds))
    setShowDeleteSelectedConfirm(false)
  }

  const handleDeleteAll = async (): Promise<void> => {
    await deleteAll()
    setShowDeleteAllConfirm(false)
  }

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

        <div className="flex items-center gap-2">
          {tracks.length > 0 && (
            <>
              <button
                onClick={allSelected ? clearSelection : selectAllTracks}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>

              {hasSelection && (
                <button
                  onClick={() => setShowDeleteSelectedConfirm(true)}
                  className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition"
                >
                  Delete {selectedTrackIds.size} Selected
                </button>
              )}

              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition"
              >
                Delete All
              </button>
            </>
          )}
          <SearchBar />
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Your library is empty</p>
          <p className="text-sm mt-1">Download some playlists to get started</p>
        </div>
      ) : (
        <TrackList tracks={tracks} />
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border-default rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Delete Entire Library?</h3>
            <p className="text-sm text-text-secondary mb-6">
              This will permanently delete all {tracks.length} tracks and their audio files from disk. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Confirmation Modal */}
      {showDeleteSelectedConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border-default rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Delete {selectedTrackIds.size} tracks?</h3>
            <p className="text-sm text-text-secondary mb-6">
              This will permanently delete the selected tracks and their audio files from disk. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteSelectedConfirm(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
