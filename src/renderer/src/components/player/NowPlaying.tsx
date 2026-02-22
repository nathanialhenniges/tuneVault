import { usePlayerStore } from '../../store/playerStore'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'

export function NowPlaying(): JSX.Element {
  const track = usePlayerStore((s) => s.currentTrack)

  if (!track) {
    return (
      <div className="flex items-center gap-3 w-60">
        <div className="w-14 h-14 bg-bg-surface rounded-lg flex items-center justify-center">
          <MusicalNoteIcon className="w-6 h-6 text-text-muted" />
        </div>
        <div className="text-sm text-text-muted">Nothing playing</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 w-60 min-w-0">
      <img
        src={track.thumbnailUrl}
        alt={track.title}
        className="w-14 h-14 rounded-lg object-cover bg-bg-surface shrink-0 shadow-lg"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{track.title}</p>
        <p className="text-xs text-text-secondary truncate">{track.artist}</p>
        <p className="text-[10px] text-text-muted truncate mt-0.5">{track.playlistTitle}</p>
      </div>
    </div>
  )
}
