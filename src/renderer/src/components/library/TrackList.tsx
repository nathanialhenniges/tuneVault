import { useState } from 'react'
import type { Track } from '../../../../shared/models'
import { usePlayerStore } from '../../store/playerStore'
import { useLibraryStore } from '../../store/libraryStore'
import { Checkbox } from '../ui/Checkbox'
import {
  FolderOpenIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon
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

  const handlePlay = (index: number): void => {
    setQueue(tracks, index)
    play()
  }

  const handleDeleteOne = async (trackId: string): Promise<void> => {
    await deleteTracks([trackId])
    setConfirmDeleteId(null)
  }

  return (
    <div className="space-y-0.5">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-muted uppercase tracking-wider border-b border-border-default">
        <span className="w-6"></span>
        <span className="w-8 text-right">#</span>
        <span className="flex-1">Title</span>
        <span className="w-32">Playlist</span>
        <span className="w-16 text-right">Duration</span>
        <span className="w-20"></span>
      </div>

      {tracks.map((track, i) => {
        const isCurrent = currentTrack?.id === track.id
        const isSelected = selectedTrackIds.has(track.id)
        return (
          <div
            key={track.id}
            className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition group ${
              isCurrent
                ? 'bg-accent-glow text-accent'
                : 'hover:bg-bg-surface-hover'
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

            <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
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
    </div>
  )
}
