import type { Track, DownloadProgress } from '../../../../shared/models'
import { usePlayerStore } from '../../store/playerStore'
import { Checkbox } from '../ui/Checkbox'
import { PlayIcon } from '@heroicons/react/24/solid'
import {
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ExclamationCircleIcon,
  ForwardIcon
} from '@heroicons/react/24/outline'

interface TrackRowProps {
  track: Track
  index: number
  tracks: Track[]
  selected?: boolean
  onToggleSelect?: () => void
  downloadProgress?: DownloadProgress
  onContextMenu?: (e: React.MouseEvent, track: Track) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function DownloadStatus({ progress }: { progress: DownloadProgress }): JSX.Element {
  switch (progress.status) {
    case 'done':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    case 'skipped':
      return <ForwardIcon className="w-4 h-4 text-yellow-500" />
    case 'error':
      return (
        <span title={progress.error}>
          <ExclamationCircleIcon className="w-4 h-4 text-red-500" />
        </span>
      )
    case 'downloading':
    case 'converting':
    case 'tagging':
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 bg-bg-inset rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress.percent, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted w-7 text-right">
            {Math.round(progress.percent)}%
          </span>
        </div>
      )
    case 'rate-limited':
      return (
        <span title={progress.error} className="text-[10px] text-yellow-500 animate-pulse">
          Rate limited
        </span>
      )
    case 'queued':
      return <ArrowDownTrayIcon className="w-3.5 h-3.5 text-text-muted animate-pulse" />
    default:
      return <></>
  }
}

export function TrackRow({ track, index, tracks, selected, onToggleSelect, downloadProgress, onContextMenu }: TrackRowProps): JSX.Element {
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

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    onContextMenu?.(e, track)
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-4 px-4 py-2.5 rounded-[var(--radius-item)] transition group ${
        isCurrent
          ? 'bg-accent/10 text-accent border-l-2 border-accent'
          : track.filePath
            ? 'hover:bg-white/5 cursor-pointer'
            : 'hover:bg-white/5'
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

      {downloadProgress ? (
        <div className="w-20 flex justify-end">
          <DownloadStatus progress={downloadProgress} />
        </div>
      ) : track.filePath ? (
        <span className="w-20 flex justify-end text-accent opacity-0 group-hover:opacity-100 transition">
          <PlayIcon className="w-4 h-4" />
        </span>
      ) : (
        <span className="w-20" />
      )}
    </div>
  )
}
