interface Props {
  /** 0-100. Omit for an indeterminate bar. */
  percent?: number
  label: string
  className?: string
}

/**
 * Determinate when we know the total, indeterminate when we do not — a fake
 * percentage that jumps to 90% and waits is worse than admitting the work is
 * unbounded.
 */
export function ProgressBar({ percent, label, className = '' }: Props): React.JSX.Element {
  const indeterminate = percent === undefined

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(percent)}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-tick ${className}`}
    >
      {indeterminate ? (
        <div className="h-full w-2/5 rounded-full bg-accent [animation:slide_1.4s_ease-in-out_infinite]" />
      ) : (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      )}
    </div>
  )
}
