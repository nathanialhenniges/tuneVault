import { useNavigate, useLocation } from 'react-router-dom'
import { useLibraryStore } from '../../store/libraryStore'
import { useDownloadStore } from '../../store/downloadStore'
import {
  QueueListIcon,
  ArrowDownTrayIcon,
  MusicalNoteIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

const navItems = [
  { path: '/', label: 'Playlists', Icon: QueueListIcon },
  { path: '/downloads', label: 'Downloads', Icon: ArrowDownTrayIcon },
  { path: '/library', label: 'Library', Icon: MusicalNoteIcon },
  { path: '/settings', label: 'Settings', Icon: Cog6ToothIcon }
]

export function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const library = useLibraryStore((s) => s.library)
  const downloads = useDownloadStore((s) => s.downloads)

  const activeDownloads = Array.from(downloads.values()).filter(
    (d) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
  ).length

  return (
    <aside className="w-56 bg-bg-surface border-r border-border-default flex flex-col transition-colors duration-200">
      <div className="drag-region h-12 flex items-center pl-20 pr-4 border-b border-border-default">
        <h1 className="text-sm font-bold tracking-wide text-accent no-drag">TuneVault</h1>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-bg-surface-hover text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
              }`}
            >
              <item.Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.path === '/downloads' && activeDownloads > 0 && (
                <span className="ml-auto text-xs bg-accent-glow text-accent px-1.5 py-0.5 rounded-full">
                  {activeDownloads}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {library.playlists.length > 0 && (
        <div className="border-t border-border-default py-2">
          <p className="px-4 py-1 text-xs text-text-muted uppercase tracking-wider">
            Downloaded
          </p>
          {library.playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => navigate('/library')}
              className="w-full text-left px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover truncate"
            >
              {pl.title}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
