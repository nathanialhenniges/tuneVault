import { create } from 'zustand'
import type { Playlist } from '../../../shared/models'

const RECENT_KEY = 'tunevault:recent-playlists'
const MAX_RECENT = 5

interface RecentPlaylist {
  url: string
  title: string
}

interface PlaylistState {
  currentPlaylist: Playlist | null
  loading: boolean
  error: string | null
  recentPlaylists: RecentPlaylist[]
  fetchPlaylist: (url: string) => Promise<void>
  clearPlaylist: () => void
  clearError: () => void
  loadRecent: () => void
}

function saveRecent(recent: RecentPlaylist[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  } catch {
    // localStorage might be full
  }
}

function loadRecentFromStorage(): RecentPlaylist[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  currentPlaylist: null,
  loading: false,
  error: null,
  recentPlaylists: loadRecentFromStorage(),

  fetchPlaylist: async (url: string) => {
    set({ loading: true, error: null, currentPlaylist: null })
    try {
      const playlist = await window.api.fetchPlaylist(url)
      set({ currentPlaylist: playlist, loading: false })

      // Add to recent playlists
      const recent = get().recentPlaylists.filter((r) => r.url !== url)
      recent.unshift({ url, title: playlist.title })
      const trimmed = recent.slice(0, MAX_RECENT)
      set({ recentPlaylists: trimmed })
      saveRecent(trimmed)
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  clearPlaylist: () => set({ currentPlaylist: null, error: null }),
  clearError: () => set({ error: null }),

  loadRecent: () => {
    set({ recentPlaylists: loadRecentFromStorage() })
  }
}))
