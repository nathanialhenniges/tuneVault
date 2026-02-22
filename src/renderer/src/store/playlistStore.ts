import { create } from 'zustand'
import type { Playlist } from '../../../shared/models'

interface PlaylistState {
  currentPlaylist: Playlist | null
  loading: boolean
  error: string | null
  fetchPlaylist: (url: string) => Promise<void>
  clearPlaylist: () => void
  clearError: () => void
}

export const usePlaylistStore = create<PlaylistState>((set) => ({
  currentPlaylist: null,
  loading: false,
  error: null,

  fetchPlaylist: async (url: string) => {
    set({ loading: true, error: null })
    try {
      const playlist = await window.api.fetchPlaylist(url)
      set({ currentPlaylist: playlist, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  clearPlaylist: () => set({ currentPlaylist: null, error: null }),
  clearError: () => set({ error: null })
}))
