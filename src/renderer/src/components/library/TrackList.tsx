import type { Track } from '../../../../shared/models'
import { usePlayerStore } from '../../store/playerStore'

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

  const handlePlay = (index: number): void => {
    setQueue(tracks, index)
    play()
  }

  return (
    <div className="space-y-0.5">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-muted uppercase tracking-wider border-b border-border-default">
        <span className="w-8 text-right">#</span>
        <span className="flex-1">Title</span>
        <span className="w-32">Playlist</span>
        <span className="w-16 text-right">Duration</span>
      </div>

      {tracks.map((track, i) => {
        const isCurrent = currentTrack?.id === track.id
        return (
          <button
            key={track.id}
            onClick={() => handlePlay(i)}
            className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg transition text-left ${
              isCurrent
                ? 'bg-accent-glow text-accent'
                : 'hover:bg-bg-surface-hover'
            }`}
          >
            <span className="w-8 text-right text-xs text-text-muted">{i + 1}</span>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img
                src={track.thumbnailUrl}
                alt=""
                className="w-9 h-9 rounded object-cover bg-bg-surface"
              />
              <div className="min-w-0">
                <p className="text-sm truncate">{track.title}</p>
                <p className="text-xs text-text-muted truncate">{track.artist}</p>
              </div>
            </div>

            <span className="w-32 text-xs text-text-muted truncate">{track.playlistTitle}</span>
            <span className="w-16 text-right text-xs text-text-muted">
              {formatDuration(track.duration)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
