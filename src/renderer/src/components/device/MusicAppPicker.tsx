import { useEffect, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { musicAppPlaylistUrl } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (url: string, name: string) => void
}

interface Entry {
  id: string
  name: string
  trackCount: number
}

/**
 * Browse the playlists in the Mac's own Music app.
 *
 * This is the only source that sees a personal playlist in full: Apple's public
 * web page for one exposes a handful of tracks, while the Music app reports
 * every track, with real album and genre attached.
 */
export function MusicAppPicker({ open, onClose, onPick }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setEntries(null)
    setError(null)
    setQuery('')
    api.musicAppPlaylists()
      .then(setEntries)
      .catch((err: Error) => setError(err.message))
  }, [open])

  const filtered = (entries ?? []).filter((e) =>
    e.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <Modal
      open={open}
      title="Import from the Music app"
      onClose={onClose}
      footer={<Button onClick={onClose}>Cancel</Button>}
    >
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : entries === null ? (
        <p className="text-sm text-text-muted">Reading your Music library…</p>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a playlist"
              aria-label="Find a playlist"
              className="min-h-10 w-full rounded-[10px] border border-control/50 bg-surface-2 pr-3 pl-9 text-sm"
            />
          </div>

          <ul className="max-h-80 divide-y divide-hairline/60 overflow-y-auto rounded-[10px] border border-hairline">
            {filtered.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => {
                    onPick(musicAppPlaylistUrl(entry.id), entry.name)
                    onClose()
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                  <span className="tabular shrink-0 text-xs text-text-muted">
                    {entry.trackCount} tracks
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-text-muted">No playlists match “{query}”.</li>
            )}
          </ul>

          <p className="text-xs text-text-muted">
            Tracks you own as files are copied straight across. Apple Music streaming tracks have no
            file to copy, so they are matched and downloaded from YouTube.
          </p>
        </div>
      )}
    </Modal>
  )
}
