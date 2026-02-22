import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { SearchBar } from './SearchBar'
import { TrackList } from './TrackList'
import {
  ArrowPathIcon,
  TrashIcon,
  FunnelIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useSettingsStore } from '../../store/settingsStore'

export function LibraryView(): JSX.Element {
  const { loaded, load, getFilteredTracks, library, selectedTrackIds, selectAllTracks, clearSelection, deleteTracks, deleteAll, openFolder } = useLibraryStore()
  const settings = useSettingsStore((s) => s.settings)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false)
  const [playlistFilter, setPlaylistFilter] = useState<string>('all')
  const [trackOrderContent, setTrackOrderContent] = useState<string | null>(null)
  const [trackOrderPath, setTrackOrderPath] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded])

  const allTracks = getFilteredTracks()
  const tracks = playlistFilter === 'all'
    ? allTracks
    : allTracks.filter((t) => t.playlistId === playlistFilter)
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

  const handleViewTrackOrder = async (): Promise<void> => {
    if (playlistFilter === 'all') return
    const [content, path] = await Promise.all([
      window.api.readTrackOrder(playlistFilter),
      window.api.getTrackOrderPath(playlistFilter)
    ])
    if (content) {
      setTrackOrderContent(content)
      setTrackOrderPath(path)
    }
  }

  const handleOpenTrackOrderFile = async (): Promise<void> => {
    if (trackOrderPath) await window.api.openFile(trackOrderPath)
  }

  const handleOpenTrackOrderFolder = async (): Promise<void> => {
    if (trackOrderPath) await window.api.openFolder(trackOrderPath)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Library</h2>
            <p className="text-sm text-text-secondary mt-1">
              {tracks.length} tracks · {library.playlists.length} playlists
            </p>
          </div>
          <SearchBar />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
            title="Reload library"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Reload
          </button>
          {settings.musicDir && (
            <button
              onClick={() => openFolder(settings.musicDir)}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              title="Open music folder"
            >
              <FolderOpenIcon className="w-3.5 h-3.5" />
              Open Folder
            </button>
          )}

          {/* Playlist filter */}
          {library.playlists.length > 0 && (
            <div className="relative flex items-center gap-1.5 ml-1">
              <FunnelIcon className="w-3.5 h-3.5 text-text-muted" />
              <select
                value={playlistFilter}
                onChange={(e) => setPlaylistFilter(e.target.value)}
                className="appearance-none bg-bg-surface border border-border-default rounded-lg px-3 py-1.5 pr-7 text-xs text-text-secondary hover:text-text-primary focus:outline-none focus:border-accent cursor-pointer transition"
              >
                <option value="all">All Playlists</option>
                {library.playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.title} ({pl.tracks.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Track Order — only when a specific playlist is selected */}
          {playlistFilter !== 'all' && (
            <button
              onClick={handleViewTrackOrder}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              title="Open track-order.txt in your default editor"
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
              Track Order
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Selection / delete actions */}
          {tracks.length > 0 && (
            <>
              <button
                onClick={allSelected ? clearSelection : selectAllTracks}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              >
                {allSelected ? (
                  <><XMarkIcon className="w-3.5 h-3.5" /> Deselect All</>
                ) : (
                  <><CheckIcon className="w-3.5 h-3.5" /> Select All</>
                )}
              </button>

              {hasSelection && (
                <button
                  onClick={() => setShowDeleteSelectedConfirm(true)}
                  className="px-3 py-1.5 text-xs text-red-400 border border-red-500/25 rounded-lg hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center gap-1.5"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Delete {selectedTrackIds.size}
                </button>
              )}

              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="px-3 py-1.5 text-xs text-red-400 border border-red-500/25 rounded-lg hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center gap-1.5"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Delete All
              </button>
            </>
          )}
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

      {/* Track Order Viewer Modal */}
      {trackOrderContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border-default rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold">Track Order</h3>
              </div>
              <button
                onClick={() => { setTrackOrderContent(null); setTrackOrderPath(null) }}
                className="p-1 text-text-muted hover:text-text-primary transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted mb-3">
              Edit this file to customize track order. Reorder or remove lines, then reload the library.
            </p>

            <pre className="bg-bg-base border border-border-default rounded-lg p-4 text-sm text-text-secondary font-mono overflow-y-auto max-h-72 whitespace-pre-wrap leading-relaxed">
              {trackOrderContent}
            </pre>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleOpenTrackOrderFolder}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              >
                <FolderOpenIcon className="w-3.5 h-3.5" />
                Open Folder
              </button>
              <button
                onClick={handleOpenTrackOrderFile}
                className="px-3 py-1.5 text-xs text-text-inverted bg-accent hover:bg-accent-hover rounded-lg transition-all flex items-center gap-1.5"
              >
                <DocumentTextIcon className="w-3.5 h-3.5" />
                Open in Editor
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
