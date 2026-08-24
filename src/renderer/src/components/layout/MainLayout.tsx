import { useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Cog6ToothIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'
import wolfIcon from '../../assets/wolf-icon.png'
import { api } from '../../lib/api'

const LINKS = [
  { to: '/devices', label: 'Devices', Icon: DevicePhoneMobileIcon },
  { to: '/settings', label: 'Settings', Icon: Cog6ToothIcon }
]

export function MainLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const navigate = useNavigate()

  useEffect(() => api.onMenu('menu:settings', () => navigate('/settings')), [navigate])

  return (
    <div className="flex h-full">
      <nav
        aria-label="Main"
        className="flex w-[212px] shrink-0 flex-col border-r border-hairline bg-surface/70"
      >
        {/* The window has no title bar, so this strip is the drag handle. It is
            also what keeps the logo clear of the traffic lights. */}
        <div className="drag-region h-11 shrink-0" />

        <div className="flex items-center gap-2.5 px-5 pt-1 pb-7">
          <img
            src={wolfIcon}
            alt=""
            width={30}
            height={30}
            className="rounded-lg ring-1 ring-hairline"
          />
          <span className="font-display text-[17px] font-semibold tracking-[-0.03em]">
            TuneVault
          </span>
        </div>

        <div className="flex flex-col gap-0.5 px-3">
          {LINKS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-2 text-text'
                    : 'text-text-muted hover:bg-surface-2/60 hover:text-text'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active state is carried by the fill and this signal bar,
                      not by colour alone. */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 h-5 w-[3px] rounded-r-full transition-opacity ${
                      isActive ? 'bg-accent opacity-100' : 'opacity-0'
                    }`}
                  />
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <p className="mt-auto px-5 pb-5 text-[11px] leading-relaxed text-text-muted/80">
          Personal case-study build. Not affiliated with Spotify, Apple or YouTube.
        </p>
      </nav>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="drag-region h-11 shrink-0" />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
