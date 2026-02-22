import { create } from 'zustand'
import type { DownloadProgress } from '../../../shared/models'

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

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: new Map(),
  isDownloading: false,

  setProgress: (progress) =>
    set((state) => {
      const downloads = new Map(state.downloads)
      downloads.set(progress.trackId, progress)
      return { downloads, isDownloading: true }
    }),

  setComplete: (trackId) =>
    set((state) => {
      const downloads = new Map(state.downloads)
      const existing = downloads.get(trackId)
      if (existing) {
        downloads.set(trackId, { ...existing, status: 'done', percent: 100 })
      }
      const stillActive = Array.from(downloads.values()).some(
        (d) => d.status !== 'done' && d.status !== 'error'
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
        (d) => d.status !== 'done' && d.status !== 'error'
      )
      return { downloads, isDownloading: stillActive }
    }),

  cancelOne: async (trackId) => {
    await window.api.cancelDownload(trackId)
    set((state) => {
      const downloads = new Map(state.downloads)
      const existing = downloads.get(trackId)
      if (existing && existing.status !== 'done') {
        downloads.set(trackId, { ...existing, status: 'error', error: 'Cancelled' })
      }
      const stillActive = Array.from(downloads.values()).some(
        (d) => d.status !== 'done' && d.status !== 'error'
      )
      return { downloads, isDownloading: stillActive }
    })
  },

  cancelAll: async () => {
    await window.api.cancelAllDownloads()
    set((state) => {
      const downloads = new Map(state.downloads)
      for (const [id, d] of downloads) {
        if (d.status !== 'done') {
          downloads.set(id, { ...d, status: 'error', error: 'Cancelled' })
        }
      }
      return { downloads, isDownloading: false }
    })
  },

  clear: () => set({ downloads: new Map(), isDownloading: false })
}))
