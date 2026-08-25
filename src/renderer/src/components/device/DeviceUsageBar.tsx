import type { DeviceUsage } from '../../../../shared/models'
import { CapacityGauge } from '../ui/CapacityGauge'

interface Props {
  usage?: DeviceUsage
  /** Bytes a pending download would add, previewed on the gauge. */
  incomingBytes?: number
}

export function DeviceUsageBar({ usage, incomingBytes }: Props): React.JSX.Element {
  if (!usage) {
    return (
      <div>
        <div className="h-2.5 w-full rounded-full bg-tick" aria-hidden="true" />
        <p className="mt-2.5 text-[13px] text-text-muted">Reading folder…</p>
      </div>
    )
  }

  return (
    <CapacityGauge
      usedBytes={usage.usedBytes}
      capacityBytes={usage.capacityBytes}
      incomingBytes={incomingBytes}
      trackCount={usage.trackCount}
    />
  )
}
