import { useLibraryStore } from '../../store/libraryStore'

export function SearchBar(): JSX.Element {
  const searchQuery = useLibraryStore((s) => s.searchQuery)
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery)

  return (
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search tracks..."
      aria-label="Search tracks"
      className="w-full max-w-sm border border-[var(--glass-border-edge)] rounded-lg px-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
      style={{ background: 'var(--glass-input-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    />
  )
}
