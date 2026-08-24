import { create } from 'zustand'
import type { DownloadProgress, DownloadRequest, RunStatus } from '../../../shared/models'
import type { DownloadSummary } from '../../../preload'
import { api } from '../lib/api'
import { useDeviceStore } from './deviceStore'
import { useToastStore } from './toastStore'

interface DownloadState {
  /** Set while a run is in flight. */
  running: boolean
  deviceId: string | null
  /** Keyed by track id. */
  progress: Record<string, DownloadProgress>
  lastSummary: DownloadSummary | null
  /** Coarse run state from main: batch position and any active cooldown. */
  runStatus: RunStatus | null
  /** Epoch ms the current run began, for the throughput estimate. */
  startedAt: number | null
  start: (request: DownloadRequest) => Promise<void>
  cancel: () => void
  applyProgress: (p: DownloadProgress) => void
  applyRunStatus: (s: RunStatus) => void
  reset: () => void
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  running: false,
  deviceId: null,
  progress: {},
  lastSummary: null,
  runStatus: null,
  startedAt: null,

  start: async (request) => {
    if (get().running) return
    set({
      running: true,
      deviceId: request.deviceId,
      progress: {},
      lastSummary: null,
      runStatus: null,
      startedAt: Date.now()
    })
    try {
      const summary = await api.downloads.start(request)
      // The per-track outcome is already on screen, row by row, and an
      // unfocused finish gets a native notification from the main process.
      // Nothing else needs announcing.
      set({ lastSummary: summary })
    } catch (err) {
      // A run that could not start at all has no row to report itself in.
      useToastStore.getState().push('error', err instanceof Error ? err.message : String(err))
    } finally {
      set({ running: false, runStatus: null })
      await useDeviceStore.getState().refreshUsage(request.deviceId)
    }
  },

  cancel: () => {
    void api.downloads.cancel()
  },

  applyProgress: (p) => set((s) => ({ progress: { ...s.progress, [p.trackId]: p } })),

  applyRunStatus: (runStatus) => set({ runStatus }),

  reset: () => set({ progress: {}, lastSummary: null, runStatus: null, startedAt: null })
}))
