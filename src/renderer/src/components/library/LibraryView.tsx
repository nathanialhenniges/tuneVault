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
import { useLocation } from 'react-router-dom'

export function LibraryView(): JSX.Element {
  const { loaded, load, getFilteredTracks, library, selectedTrackIds, selectAllTracks, clearSelection, deleteTracks, deleteAll, openFolder } = useLibraryStore()
  const settings = useSettingsStore((s) => s.settings)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false)
  const [playlistFilter, setPlaylistFilter] = useState<string>('all')
  const [playlistInfoContent, setPlaylistInfoContent] = useState<string | null>(null)
  const [playlistInfoPath, setPlaylistInfoPath] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    if (!loaded) load()
  }, [loaded])

  // Auto-apply playlist filter from navigation state
  useEffect(() => {
    const state = location.state as { playlistFilter?: string } | null
    if (state?.playlistFilter) {
      setPlaylistFilter(state.playlistFilter)
    }
  }, [location.state])

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

  const handleViewPlaylistInfo = async (): Promise<void> => {
    if (playlistFilter === 'all') return
    const [content, path] = await Promise.all([
      window.api.readPlaylistInfo(playlistFilter),
      window.api.getPlaylistInfoPath(playlistFilter)
    ])
    if (content) {
      setPlaylistInfoContent(content)
      setPlaylistInfoPath(path)
    }
  }

  const handleOpenPlaylistInfoFolder = async (): Promise<void> => {
    if (playlistInfoPath) await window.api.openFolder(playlistInfoPath)
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

          {/* View Playlist Info — only when a specific playlist is selected */}
          {playlistFilter !== 'all' && (
            <button
              onClick={handleViewPlaylistInfo}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              title="View playlist-info.md"
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
              Playlist Info
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="glass-modal glass-border-float p-6 max-w-md mx-4 glass-reveal" style={{ borderRadius: 'var(--radius-panel)' }}>
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

      {/* Playlist Info Viewer Modal */}
      {playlistInfoContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="glass-modal glass-border-float p-6 max-w-lg w-full mx-4 glass-reveal" style={{ borderRadius: 'var(--radius-panel)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold">Playlist Info</h3>
              </div>
              <button
                onClick={() => { setPlaylistInfoContent(null); setPlaylistInfoPath(null) }}
                className="p-1 text-text-muted hover:text-text-primary transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <pre className="bg-white/5 border border-[var(--glass-border-edge)] rounded-lg p-4 text-sm text-text-secondary font-mono overflow-y-auto max-h-72 whitespace-pre-wrap leading-relaxed">
              {playlistInfoContent}
            </pre>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleOpenPlaylistInfoFolder}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              >
                <FolderOpenIcon className="w-3.5 h-3.5" />
                Open Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Confirmation Modal */}
      {showDeleteSelectedConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="glass-modal glass-border-float p-6 max-w-md mx-4 glass-reveal" style={{ borderRadius: 'var(--radius-panel)' }}>
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
