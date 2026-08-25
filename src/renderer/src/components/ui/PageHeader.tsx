import type { ReactNode } from 'react'

interface Props {
  /** Small all-caps label above the title. */
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, actions }: Props): React.JSX.Element {
  return (
    <header className="mb-9 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[27px] leading-none">{title}</h1>
        {subtitle && <p className="mt-2.5 max-w-lg text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  )
}
