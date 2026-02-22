import { useState, useCallback } from 'react'
import type { Track } from '../../../../shared/models'
import { usePlayerStore } from '../../store/playerStore'
import { useLibraryStore } from '../../store/libraryStore'
import { Checkbox } from '../ui/Checkbox'
import { ContextMenu } from '../ui/ContextMenu'
import { TrackDetailModal } from '../ui/TrackDetailModal'
import {
  FolderOpenIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

interface TrackListProps {
  tracks: Track[]
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function TrackList({ tracks }: TrackListProps): JSX.Element {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const play = usePlayerStore((s) => s.play)
  const selectedTrackIds = useLibraryStore((s) => s.selectedTrackIds)
  const toggleTrackSelection = useLibraryStore((s) => s.toggleTrackSelection)
  const deleteTracks = useLibraryStore((s) => s.deleteTracks)
  const openFolder = useLibraryStore((s) => s.openFolder)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null)
  const [detailTrack, setDetailTrack] = useState<Track | null>(null)

  const handlePlay = (index: number): void => {
    setQueue(tracks, index)
    play()
  }

  const handleDeleteOne = async (trackId: string): Promise<void> => {
    await deleteTracks([trackId])
    setConfirmDeleteId(null)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, track })
  }, [])

  return (
    <div className="space-y-0.5">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-muted uppercase tracking-wider border-b border-border-default">
        <span className="w-6"></span>
        <span className="w-8 text-right">#</span>
        <span className="flex-1">Title</span>
        <span className="w-32">Playlist</span>
        <span className="w-16 text-right">Duration</span>
        <span className="w-14 text-right">Bitrate</span>
        <span className="w-20"></span>
      </div>

      {tracks.map((track, i) => {
        const isCurrent = currentTrack?.id === track.id
        const isSelected = selectedTrackIds.has(track.id)
        return (
          <div
            key={track.id}
            onContextMenu={(e) => handleContextMenu(e, track)}
            className={`flex items-center gap-4 px-4 py-2.5 rounded-[var(--radius-item)] transition group ${
              isCurrent
                ? 'bg-accent/10 text-accent border-l-2 border-accent'
                : 'hover:bg-glass-hover'
            }`}
          >
            <Checkbox checked={isSelected} onChange={() => toggleTrackSelection(track.id)} />

            <button
              onClick={() => handlePlay(i)}
              className="w-8 text-right text-xs text-text-muted hover:text-accent transition"
            >
              {i + 1}
            </button>

            <button
              onClick={() => handlePlay(i)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <img
                src={track.thumbnailUrl}
                alt=""
                className="w-9 h-9 rounded object-cover bg-bg-surface"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="min-w-0">
                <p className="text-sm truncate">{track.title}</p>
                <p className="text-xs text-text-muted truncate">{track.artist}</p>
              </div>
            </button>

            <span className="w-32 text-xs text-text-muted truncate">{track.playlistTitle}</span>
            <span className="w-16 text-right text-xs text-text-muted">
              {formatDuration(track.duration)}
            </span>
            <span className="w-14 text-right text-xs text-text-muted">
              {track.bitrate ? `${track.bitrate}kbps` : ''}
            </span>

            <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
              {track.filePath && (
                <button
                  onClick={() => openFolder(track.filePath!)}
                  className="text-text-muted hover:text-accent transition p-1 rounded"
                  title="Show in folder"
                >
                  <FolderOpenIcon className="w-4 h-4" />
                </button>
              )}
              {confirmDeleteId === track.id ? (
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleDeleteOne(track.id)}
                    className="text-red-500 hover:text-red-400 transition p-1"
                    title="Confirm delete"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-text-muted hover:text-text-primary transition p-1"
                    title="Cancel"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(track.id)}
                  className="text-text-muted hover:text-red-500 transition p-1 rounded"
                  title="Delete track"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'View Details',
              icon: <InformationCircleIcon className="w-4 h-4" />,
              onClick: () => setDetailTrack(contextMenu.track)
            },
            ...(contextMenu.track.filePath ? [{
              label: 'Show in Folder',
              icon: <FolderOpenIcon className="w-4 h-4" />,
              onClick: () => openFolder(contextMenu.track.filePath!)
            }] : []),
            {
              label: 'Delete Track',
              icon: <TrashIcon className="w-4 h-4" />,
              onClick: () => setConfirmDeleteId(contextMenu.track.id),
              danger: true
            }
          ]}
        />
      )}

      {detailTrack && (
        <TrackDetailModal track={detailTrack} onClose={() => setDetailTrack(null)} />
      )}
    </div>
  )
}
