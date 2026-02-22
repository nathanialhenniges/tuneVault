import { create } from 'zustand'
import type { DownloadProgress } from '../../../shared/models'

const PROGRESS_THROTTLE_MS = 200

interface DownloadState {
  downloads: Map<string, DownloadProgress>
  isDownloading: boolean
  setProgress: (progress: DownloadProgress) => void
  setComplete: (trackId: string) => void
  setError: (trackId: string, error: string) => void
  cancelOne: (trackId: string) => Promise<void>
  cancelAll: () => Promise<void>
  clear: () => void
}

// Throttle progress updates per track to reduce re-renders
const lastProgressUpdate = new Map<string, number>()

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: new Map(),
  isDownloading: false,

  setProgress: (progress) => {
    // Always apply status transitions and 100% completion immediately
    const isStatusChange = progress.status !== 'downloading' || progress.percent >= 100
    if (!isStatusChange) {
      const now = Date.now()
      const lastUpdate = lastProgressUpdate.get(progress.trackId) ?? 0
      if (now - lastUpdate < PROGRESS_THROTTLE_MS) return
      lastProgressUpdate.set(progress.trackId, now)
    }
    set((state) => {
      const downloads = new Map(state.downloads)
      downloads.set(progress.trackId, progress)
      return { downloads, isDownloading: true }
    })
  },

  setComplete: (trackId) =>
    set((state) => {
      const downloads = new Map(state.downloads)
      const existing = downloads.get(trackId)
      if (existing) {
        downloads.set(trackId, { ...existing, status: 'done', percent: 100 })
      }
      const stillActive = Array.from(downloads.values()).some(
        (d) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
      )
      return { downloads, isDownloading: stillActive }
    }),

  setError: (trackId, error) =>
    set((state) => {
      const downloads = new Map(state.downloads)
      const existing = downloads.get(trackId)
      if (existing) {
        downloads.set(trackId, { ...existing, status: 'error', error })
      }
      const stillActive = Array.from(downloads.values()).some(
        (d) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
      )
      return { downloads, isDownloading: stillActive }
    }),

  cancelOne: async (trackId) => {
    await window.api.cancelDownload(trackId)
    set((state) => {
      const downloads = new Map(state.downloads)
      const existing = downloads.get(trackId)
      if (existing && existing.status !== 'done' && existing.status !== 'skipped') {
        downloads.set(trackId, { ...existing, status: 'error', error: 'Cancelled' })
      }
      const stillActive = Array.from(downloads.values()).some(
        (d) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
      )
      return { downloads, isDownloading: stillActive }
    })
  },

  cancelAll: async () => {
    await window.api.cancelAllDownloads()
    set((state) => {
      const downloads = new Map(state.downloads)
      for (const [id, d] of downloads) {
        if (d.status !== 'done' && d.status !== 'skipped') {
          downloads.set(id, { ...d, status: 'error', error: 'Cancelled' })
        }
      }
      return { downloads, isDownloading: false }
    })
  },

  clear: () => {
    lastProgressUpdate.clear()
    set({ downloads: new Map(), isDownloading: false })
  }
}))
