import type { Track } from '../../../../shared/models'
import { usePlayerStore } from '../../store/playerStore'
import { Checkbox } from '../ui/Checkbox'
import { PlayIcon } from '@heroicons/react/24/solid'

interface TrackRowProps {
  track: Track
  index: number
  tracks: Track[]
  selected?: boolean
  onToggleSelect?: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function TrackRow({ track, index, tracks, selected, onToggleSelect }: TrackRowProps): JSX.Element {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const play = usePlayerStore((s) => s.play)
  const isCurrent = currentTrack?.id === track.id

  const handlePlay = (): void => {
    if (!track.filePath) return
    const playableTracks = tracks.filter((t) => t.filePath)
    const startIdx = playableTracks.findIndex((t) => t.id === track.id)
    setQueue(playableTracks, startIdx >= 0 ? startIdx : 0)
    play()
  }

  return (
    <div
      className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition group ${
        isCurrent
          ? 'bg-accent-glow text-accent'
          : track.filePath
            ? 'hover:bg-bg-surface-hover cursor-pointer'
            : 'hover:bg-bg-surface-hover'
      }`}
    >
      {onToggleSelect !== undefined && (
        <Checkbox checked={selected ?? false} onChange={onToggleSelect} />
      )}

      <span
        className="w-6 text-right text-xs text-text-muted cursor-pointer"
        onClick={handlePlay}
      >
        {track.position}
      </span>

      <img
        src={track.thumbnailUrl}
        alt=""
        className="w-10 h-10 rounded object-cover bg-bg-surface cursor-pointer"
        onClick={handlePlay}
      />

      <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlay}>
        <p className="text-sm truncate">{track.title}</p>
        <p className="text-xs text-text-muted truncate">{track.artist}</p>
      </div>

      <span className="text-xs text-text-muted">{formatDuration(track.duration)}</span>

      {track.bitrate && (
        <span className="text-xs text-text-muted">{track.bitrate}kbs</span>
      )}

      {track.filePath && (
        <span className="text-accent opacity-0 group-hover:opacity-100 transition">
          <PlayIcon className="w-4 h-4" />
        </span>
      )}
    </div>
  )
}
