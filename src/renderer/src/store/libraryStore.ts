import { create } from 'zustand'
import type { LibraryData, Track } from '../../../shared/models'

interface LibraryState {
  library: LibraryData
  loaded: boolean
  searchQuery: string
  selectedTrackIds: Set<string>
  load: () => Promise<void>
  setSearchQuery: (query: string) => void
  getAllTracks: () => Track[]
  getFilteredTracks: () => Track[]
  getPlaylistTracks: (playlistId: string) => Track[]
  toggleTrackSelection: (trackId: string) => void
  selectAllTracks: () => void
  clearSelection: () => void
  deleteTracks: (trackIds: string[]) => Promise<void>
  deleteAll: () => Promise<void>
  openFolder: (filePath: string) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: { playlists: [], version: 1 },
  loaded: false,
  searchQuery: '',
  selectedTrackIds: new Set(),

  load: async () => {
    // Verify checks files on disk and removes missing tracks
    const library = await window.api.verifyLibrary()
    set({ library, loaded: true, selectedTrackIds: new Set() })
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
  },

  toggleTrackSelection: (trackId: string) => {
    const { selectedTrackIds } = get()
    const newSet = new Set(selectedTrackIds)
    if (newSet.has(trackId)) {
      newSet.delete(trackId)
    } else {
      newSet.add(trackId)
    }
    set({ selectedTrackIds: newSet })
  },

  selectAllTracks: () => {
    const tracks = get().getFilteredTracks()
    set({ selectedTrackIds: new Set(tracks.map((t) => t.id)) })
  },

  clearSelection: () => {
    set({ selectedTrackIds: new Set() })
  },

  deleteTracks: async (trackIds: string[]) => {
    await window.api.deleteTracks(trackIds)
    await get().load()
  },

  deleteAll: async () => {
    await window.api.deleteAllLibrary()
    await get().load()
  },

  openFolder: async (filePath: string) => {
    await window.api.openFolder(filePath)
  }
}))
