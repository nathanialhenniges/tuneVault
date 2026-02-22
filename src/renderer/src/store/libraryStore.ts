import { create } from 'zustand'
import type { LibraryData, Track, Playlist } from '../../../shared/models'

interface LibraryState {
  library: LibraryData
  loaded: boolean
  searchQuery: string
  load: () => Promise<void>
  setSearchQuery: (query: string) => void
  getAllTracks: () => Track[]
  getFilteredTracks: () => Track[]
  getPlaylistTracks: (playlistId: string) => Track[]
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: { playlists: [], version: 1 },
  loaded: false,
  searchQuery: '',

  load: async () => {
    const library = await window.api.getLibrary()
    set({ library, loaded: true })
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  getAllTracks: () => {
    const { library } = get()
    return library.playlists.flatMap((p) =>
      p.tracks.filter((t) => t.filePath)
    )
  },

  getFilteredTracks: () => {
    const { searchQuery } = get()
    const tracks = get().getAllTracks()
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase()
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.playlistTitle.toLowerCase().includes(q)
    )
  },

  getPlaylistTracks: (playlistId: string) => {
    const { library } = get()
    const playlist = library.playlists.find((p) => p.id === playlistId)
    return playlist?.tracks.filter((t) => t.filePath) ?? []
  }
}))
