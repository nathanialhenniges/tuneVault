import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

/*
 * One button, four variants. 2.x grew two parallel button systems and two
 * different destructive styles.
 *
 * Filled variants carry dark ink, not white: white on this cyan measures 2.7:1
 * and fails AA, while --color-ink on it measures 7.0:1.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-hover active:bg-accent-active shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]',
  secondary: 'bg-surface-2 text-text border border-control/60 hover:border-control hover:bg-surface-2',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-danger text-ink hover:bg-danger-hover active:bg-danger-hover'
}

// min-h keeps every target at or above 44px (36px for the compact size, which
// is only used inside already-dense rows).
const SIZES: Record<Size, string> = {
  sm: 'text-[13px] px-3 py-1.5 min-h-9',
  md: 'text-sm px-4 py-2.5 min-h-11'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props): React.JSX.Element {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-medium tracking-[-0.01em] transition-[background-color,border-color,color] duration-150 disabled:opacity-35 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  )
}

/** Square icon-only control that still meets the 44px target. */
export function IconButton({
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: Omit<Props, 'size'>): React.JSX.Element {
  return (
    <button
      {...rest}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors duration-150 disabled:opacity-35 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
