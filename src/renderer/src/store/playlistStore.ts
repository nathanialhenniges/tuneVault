import { create } from 'zustand'
import type { Playlist } from '../../../shared/models'

const RECENT_KEY = 'tunevault:recent-playlists'
const CACHE_KEY = 'tunevault:playlist-cache'
const MAX_RECENT = 5
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface RecentPlaylist {
  url: string
  title: string
}

interface CachedPlaylist {
  playlist: Playlist
  cachedAt: number
}

interface PlaylistState {
  currentPlaylist: Playlist | null
  loading: boolean
  error: string | null
  lastUrl: string | null
  loadedFromCache: boolean
  recentPlaylists: RecentPlaylist[]
  pendingUrl: string | null
  fetchPlaylist: (url: string) => Promise<void>
  refreshPlaylist: () => Promise<void>
  clearPlaylist: () => void
  clearError: () => void
  loadRecent: () => void
  setPendingUrl: (url: string | null) => void
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

function getCachedPlaylist(url: string): Playlist | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache: Record<string, CachedPlaylist> = JSON.parse(raw)
    const entry = cache[url]
    if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
      return entry.playlist
    }
    return null
  } catch {
    return null
  }
}

function setCachedPlaylist(url: string, playlist: Playlist): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cache: Record<string, CachedPlaylist> = raw ? JSON.parse(raw) : {}
    // Evict stale entries
    for (const key of Object.keys(cache)) {
      if (Date.now() - cache[key].cachedAt > CACHE_TTL_MS) {
        delete cache[key]
      }
    }
    cache[url] = { playlist, cachedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage might be full
  }
}

function evictCachedPlaylist(url: string): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const cache: Record<string, CachedPlaylist> = JSON.parse(raw)
    delete cache[url]
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

async function fetchFromApi(
  url: string,
  set: (partial: Partial<PlaylistState>) => void,
  get: () => PlaylistState
): Promise<void> {
  set({ loading: true, error: null, currentPlaylist: null, loadedFromCache: false })
  try {
    const playlist = await window.api.fetchPlaylist(url)
    set({ currentPlaylist: playlist, loading: false, lastUrl: url, loadedFromCache: false })

    // Cache the result
    setCachedPlaylist(url, playlist)

    // Add to recent playlists
    const recent = get().recentPlaylists.filter((r) => r.url !== url)
    recent.unshift({ url, title: playlist.title })
    const trimmed = recent.slice(0, MAX_RECENT)
    set({ recentPlaylists: trimmed })
    saveRecent(trimmed)
  } catch (err) {
    set({ error: (err as Error).message, loading: false })
  }
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  currentPlaylist: null,
  loading: false,
  error: null,
  lastUrl: null,
  loadedFromCache: false,
  recentPlaylists: loadRecentFromStorage(),
  pendingUrl: null,

  fetchPlaylist: async (url: string) => {
    // Check renderer-side cache first for instant load
    const cached = getCachedPlaylist(url)
    if (cached) {
      set({ currentPlaylist: cached, loading: false, error: null, lastUrl: url, loadedFromCache: true })
      // Update recent list
      const recent = get().recentPlaylists.filter((r) => r.url !== url)
      recent.unshift({ url, title: cached.title })
      const trimmed = recent.slice(0, MAX_RECENT)
      set({ recentPlaylists: trimmed })
      saveRecent(trimmed)
      return
    }

    await fetchFromApi(url, set, get)
  },

  refreshPlaylist: async () => {
    const url = get().lastUrl
    if (!url) return
    evictCachedPlaylist(url)
    await fetchFromApi(url, set, get)
  },

  clearPlaylist: () => set({ currentPlaylist: null, error: null, lastUrl: null, loadedFromCache: false }),
  clearError: () => set({ error: null }),

  loadRecent: () => {
    set({ recentPlaylists: loadRecentFromStorage() })
  },

  setPendingUrl: (url) => set({ pendingUrl: url })
}))
