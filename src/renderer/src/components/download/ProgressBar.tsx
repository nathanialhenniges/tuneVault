interface ProgressBarProps {
  percent: number
  status: string
}

export function ProgressBar({ percent, status }: ProgressBarProps): JSX.Element {
  const color =
    status === 'done'
      ? 'bg-green-500'
      : status === 'skipped'
        ? 'bg-yellow-500'
        : status === 'error'
          ? 'bg-red-500'
          : 'bg-accent'

  const isActive = status === 'downloading' || status === 'converting'

  return (
    <div className="w-full h-1.5 bg-bg-inset rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300 rounded-full relative overflow-hidden`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      >
        {isActive && (
          <div className="absolute inset-0 download-shimmer" />
        )}
      </div>
    </div>
  )
}
