import { formatBytes } from '../../../../shared/utils'

interface Props {
  usedBytes: number
  capacityBytes: number
  /** Bytes a pending download would add, previewed ahead of the current fill. */
  incomingBytes?: number
  /** Shown alongside the byte figures. */
  trackCount?: number
  className?: string
}

/** Faint marks every eighth, so the rail still reads as a calibrated scale. */
const DIVISIONS = 8

/**
 * Capacity meter for a device.
 *
 * The fill is continuous rather than segmented: a 32 GB device holding 127 MB
 * lights 0.4% of the rail, and with discrete ticks that was a single lit box
 * stranded in a field of stripes — unreadable, and the stripes themselves were
 * louder than the data. A solid fill over faint eighth-marks reads correctly at
 * both 0.4% and 96%.
 *
 * Any non-zero usage keeps a visible sliver, so "nearly empty" never renders as
 * "empty".
 *
 * A pending download is previewed as a lighter extension beyond the current
 * fill. It differs from the fill by outline as well as tone, and the exact
 * figures are written underneath, so colour is never the only channel carrying
 * the information.
 */
export function CapacityGauge({
  usedBytes,
  capacityBytes,
  incomingBytes = 0,
  trackCount,
  className = ''
}: Props): React.JSX.Element {
  const capacity = Math.max(1, capacityBytes)
  const pct = (bytes: number): number => Math.max(0, Math.min(100, (bytes / capacity) * 100))

  const usedPct = pct(usedBytes)
  const projectedPct = pct(usedBytes + incomingBytes)
  const overflows = usedBytes + incomingBytes > capacity
  const free = Math.max(0, capacity - usedBytes)

  // Below this a fill rounds away to nothing; clamp so a nearly-empty device
  // still shows that it holds something.
  const visible = (value: number): string => (value > 0 ? `max(3px, ${value}%)` : '0px')

  return (
    <div className={className}>
      <div
        role="meter"
        aria-valuenow={Math.round(usedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${formatBytes(usedBytes)} of ${formatBytes(capacityBytes)} used`}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-tick"
      >
        {incomingBytes > 0 && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              overflows ? 'bg-danger/30 ring-1 ring-inset ring-danger' : 'bg-accent/30 ring-1 ring-inset ring-accent'
            }`}
            style={{ width: visible(projectedPct) }}
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${
            usedBytes > capacity ? 'bg-danger' : 'bg-accent'
          }`}
          style={{ width: visible(usedPct) }}
        />
        {/* Scale marks sit on top of the fill so the rail stays legible either way. */}
        <div aria-hidden="true" className="absolute inset-0 flex">
          {Array.from({ length: DIVISIONS - 1 }, (_, i) => (
            <span
              key={i}
              className="flex-1 border-r border-bg/50 last:border-r-0"
              style={{ flexBasis: `${100 / DIVISIONS}%` }}
            />
          ))}
        </div>
      </div>

      <p className="tabular mt-2.5 text-[13px] text-text-muted">
        <span className="text-text">{formatBytes(usedBytes)}</span> of{' '}
        {formatBytes(capacityBytes)}
        {incomingBytes > 0 && (
          <>
            {' · '}
            <span className={overflows ? 'text-danger' : 'text-accent'}>
              +{formatBytes(incomingBytes)} pending
            </span>
          </>
        )}
        {' · '}
        {formatBytes(free)} free
        {trackCount !== undefined && (
          <>
            {' · '}
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          </>
        )}
      </p>
    </div>
  )
}
