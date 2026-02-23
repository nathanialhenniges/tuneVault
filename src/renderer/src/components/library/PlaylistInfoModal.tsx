import { useMemo } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { formatDuration } from '../../../../shared/utils'
import { Modal } from '../ui/Modal'
import {
  XMarkIcon,
  FolderOpenIcon,
  ClockIcon,
  MusicalNoteIcon
} from '@heroicons/react/24/outline'

interface PlaylistInfoModalProps {
  playlistId: string
  onClose: () => void
}

export function PlaylistInfoModal({ playlistId, onClose }: PlaylistInfoModalProps): JSX.Element {
  const library = useLibraryStore((s) => s.library)

  const playlist = useMemo(
    () => library.playlists.find((p) => p.id === playlistId),
    [library, playlistId]
  )

  const downloadedTracks = useMemo(() => {
    if (!playlist) return []
    return [...playlist.tracks]
      .filter((t) => t.filePath)
      .sort((a, b) => a.position - b.position)
  }, [playlist])

  const totalDuration = useMemo(
    () => downloadedTracks.reduce((sum, t) => sum + t.duration, 0),
    [downloadedTracks]
  )

  const handleOpenFolder = async (): Promise<void> => {
    const path = await window.api.getPlaylistInfoPath(playlistId)
    if (path) await window.api.openFolder(path)
  }

  if (!playlist) return <Modal open={true} onClose={onClose} className="p-6 max-w-md mx-4"><p className="text-text-secondary">Playlist not found.</p></Modal>

  const totalDurationMinutes = Math.floor(totalDuration / 60)
  const totalDurationFormatted = totalDurationMinutes >= 60
    ? `${Math.floor(totalDurationMinutes / 60)}h ${totalDurationMinutes % 60}m`
    : `${totalDurationMinutes}m`

  return (
    <Modal open={true} onClose={onClose} className="max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 pb-4">
        <img
          src={playlist.thumbnailUrl}
          alt=""
          className="w-20 h-20 rounded-lg object-cover bg-bg-inset shrink-0"
          loading="lazy"
          decoding="async"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold font-display truncate">{playlist.title}</h2>
          <p className="text-sm text-text-secondary truncate">{playlist.channelTitle}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <MusicalNoteIcon className="w-3.5 h-3.5" />
              {downloadedTracks.length} track{downloadedTracks.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {totalDurationFormatted}
            </span>
            {playlist.fetchedAt && (
              <span>
                Fetched {new Date(playlist.fetchedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-text-primary transition rounded-lg hover:bg-glass-hover shrink-0"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-2">
        {downloadedTracks.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">No downloaded tracks in this playlist.</p>
        ) : (
          <div className="space-y-0.5">
            {downloadedTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-glass-hover transition"
              >
                <span className="w-6 text-right text-xs text-text-muted tabular-nums shrink-0">
                  {track.position}
                </span>
                <img
                  src={track.thumbnailUrl}
                  alt=""
                  className="w-8 h-8 rounded object-cover bg-bg-inset shrink-0"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{track.title}</p>
                  <p className="text-xs text-text-muted truncate">{track.artist}</p>
                </div>
                <span className="text-xs text-text-muted tabular-nums shrink-0">
                  {formatDuration(track.duration)}
                </span>
                {track.bitrate && (
                  <span className="text-xs text-text-muted tabular-nums shrink-0 w-14 text-right">
                    {track.bitrate}kbps
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-6 pt-4 shrink-0">
        <button
          onClick={handleOpenFolder}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
        >
          <FolderOpenIcon className="w-3.5 h-3.5" />
          Open Folder
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
