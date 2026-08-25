import { useEffect, useState } from 'react'
import type { DownloadProgress, RunStatus } from '../../../../shared/models'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'

interface Props {
  /** Ids of the tracks in this run. */
  trackIds: string[]
  progress: Record<string, DownloadProgress>
  status: RunStatus | null
  startedAt: number | null
  onStop: () => void
}

const FINISHED = new Set(['complete', 'error', 'skipped', 'cancelled'])

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/**
 * One place that answers "how far along is this, and what is it doing right
 * now" for the whole run. Per-row state says what happened to each track; it
 * cannot say how much is left, how fast it is going, or why nothing appears to
 * be happening during a rate-limit cooldown.
 *
 * Counts are derived from the per-track progress the renderer already holds, so
 * the main process only has to report what cannot be derived: the batch
 * position and when a cooldown ends.
 */
export function RunStatusBar({
  trackIds,
  progress,
  status,
  startedAt,
  onStop
}: Props): React.JSX.Element {
  // Only re-renders during a cooldown, and only once a second.
  const [now, setNow] = useState(() => Date.now())
  const cooling = !!status?.cooldownUntil && status.cooldownUntil > now

  useEffect(() => {
    if (!status?.cooldownUntil) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status?.cooldownUntil])

  const states = trackIds.map((id) => progress[id]?.status)
  const total = trackIds.length
  const done = states.filter((s) => s && FINISHED.has(s)).length
  const completed = states.filter((s) => s === 'complete').length
  const failed = states.filter((s) => s === 'error').length
  const skipped = states.filter((s) => s === 'skipped').length
  const active = states.filter((s) => s === 'downloading' || s === 'tagging').length

  // Throughput measured over this run, not guessed in advance.
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0
  const eta =
    done >= 3 && elapsed > 5 && done < total ? ((total - done) / done) * elapsed : null

  const cooldownLeft = cooling ? Math.ceil((status!.cooldownUntil! - now) / 1000) : 0

  return (
    <div className="space-y-2.5 border-b border-hairline bg-surface-2/40 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-sm">
          <span className="font-medium">
            {done} of {total}
          </span>
          <span className="text-text-muted">
            {completed > 0 && ` · ${plural(completed, 'downloaded')}`}
            {skipped > 0 && ` · ${skipped} already there`}
            {failed > 0 && ' · '}
          </span>
          {failed > 0 && <span className="text-danger">{plural(failed, 'failed')}</span>}
        </p>
        <Button size="sm" variant="danger" onClick={onStop}>
          Stop
        </Button>
      </div>

      <ProgressBar
        percent={total > 0 ? (done / total) * 100 : 0}
        label={`Downloaded ${done} of ${total}`}
      />

      <p className="tabular text-xs text-text-muted">
        {cooling ? (
          <span className="text-warn">
            Pausing {cooldownLeft}s to stay under YouTube's rate limits
          </span>
        ) : active > 0 ? (
          `Working on ${plural(active, 'track')}`
        ) : (
          'Starting…'
        )}
        {status && status.batchCount > 1 && ` · batch ${status.batch} of ${status.batchCount}`}
        {eta !== null && ` · about ${humanDuration(eta)} left`}
      </p>
    </div>
  )
}
