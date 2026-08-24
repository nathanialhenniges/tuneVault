import type { DownloadProgress, Track } from '../../../../shared/models'
import { formatDuration } from '../../../../shared/utils'
import { Thumbnail } from '../ui/Thumbnail'

interface Props {
  track: Track
  index: number
  selected: boolean
  disabled: boolean
  state?: DownloadProgress
  onToggle: (index: number, shiftKey: boolean) => void
}

const STATUS: Record<string, { label: string; tone: string }> = {
  queued: { label: 'Queued', tone: 'text-text-muted' },
  downloading: { label: 'Downloading', tone: 'text-accent' },
  tagging: { label: 'Tagging', tone: 'text-accent' },
  complete: { label: 'Done', tone: 'text-ok' },
  error: { label: 'Failed', tone: 'text-danger' },
  cancelled: { label: 'Stopped', tone: 'text-text-muted' },
  skipped: { label: 'Already there', tone: 'text-text-muted' },
  'rate-limited': { label: 'Rate limited', tone: 'text-warn' }
}

export function TrackRow({
  track,
  index,
  selected,
  disabled,
  state,
  onToggle
}: Props): React.JSX.Element {
  const status = state ? STATUS[state.status] : undefined
  const downloading = state?.status === 'downloading'

  return (
    <li
      // Skip layout and paint for rows scrolled out of view. A 500-track
      // playlist renders as fast as a 20-track one, with no virtualisation
      // library and no fixed row heights to maintain.
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 56px' }}
      className={`relative flex items-center gap-3 px-4 transition-colors ${
        selected ? '' : 'opacity-55'
      } ${disabled ? '' : 'hover:bg-surface-2/50'}`}
    >
      <label className="flex min-h-14 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          // onClick carries shiftKey; onChange does not. The no-op onChange is
          // only there to keep React from warning about a controlled input.
          onChange={() => undefined}
          onClick={(e) => onToggle(index, e.shiftKey)}
          aria-label={`Include ${track.title}`}
          className="h-4 w-4 shrink-0"
        />
        <span className="tabular w-6 shrink-0 text-right text-xs text-text-muted">
          {track.position}
        </span>
        <Thumbnail src={track.thumbnail} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight">{track.title}</span>
          <span className="block truncate text-xs leading-tight text-text-muted">
            {track.artist}
          </span>
        </span>
      </label>

      <span className="tabular w-36 shrink-0 text-right text-xs">
        {status ? (
          <span className={status.tone} title={state?.detail}>
            {downloading ? `${Math.round(state.percent)}%` : status.label}
            {state?.detail && downloading && (
              <span className="block truncate text-[11px] text-text-muted">{state.detail}</span>
            )}
          </span>
        ) : (
          <span className="text-text-muted">
            {track.duration ? formatDuration(track.duration) : '—'}
          </span>
        )}
      </span>

      {/* Progress reads along the bottom edge of the row it belongs to, rather
          than as a separate bar somewhere else on the page. */}
      {downloading && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[2px] bg-accent transition-[width] duration-200"
          style={{ width: `${Math.max(2, state.percent)}%` }}
        />
      )}
      {state?.status === 'error' && state.detail && (
        <span className="absolute inset-x-4 bottom-0.5 truncate text-[11px] text-danger">
          {state.detail}
        </span>
      )}
    </li>
  )
}
