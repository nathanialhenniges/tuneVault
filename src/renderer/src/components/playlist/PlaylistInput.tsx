import { useState } from 'react'
import { usePlaylistStore } from '../../store/playlistStore'

export function PlaylistInput(): JSX.Element {
  const [url, setUrl] = useState('')
  const { fetchPlaylist, loading, error, clearError } = usePlaylistStore()

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!url.trim()) return
    fetchPlaylist(url.trim())
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (error) clearError()
          }}
          placeholder="Paste YouTube playlist URL..."
          className="flex-1 bg-bg-surface border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-text-inverted disabled:bg-bg-inset disabled:text-text-muted rounded-lg text-sm font-medium transition"
        >
          {loading ? 'Fetching...' : 'Fetch Playlist'}
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
