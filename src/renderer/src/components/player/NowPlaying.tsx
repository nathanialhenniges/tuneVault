import { usePlayerStore } from '../../store/playerStore'

export function NowPlaying(): JSX.Element {
  const track = usePlayerStore((s) => s.currentTrack)

  if (!track) {
    return (
      <div className="flex items-center gap-3 w-60">
        <div className="w-12 h-12 bg-bg-surface rounded" />
        <div className="text-sm text-text-muted">Nothing playing</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 w-60 min-w-0">
      <img
        src={track.thumbnailUrl}
        alt=""
        className="w-12 h-12 rounded object-cover bg-bg-surface shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{track.title}</p>
        <p className="text-xs text-text-secondary truncate">{track.artist}</p>
      </div>
    </div>
  )
}
