import { create } from 'zustand'
import type { SyncResult } from '../../../shared/models'

interface SyncState {
  syncing: boolean
  pendingResults: SyncResult[]
  lastSyncTime: string | null
  setSyncing: (syncing: boolean) => void
  addResult: (result: SyncResult) => void
  dismissResult: (playlistId: string) => void
  clearResults: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  pendingResults: [],
  lastSyncTime: null,

  setSyncing: (syncing) => set({ syncing }),

  addResult: (result) =>
    set((s) => ({
      pendingResults: [
        ...s.pendingResults.filter((r) => r.playlistId !== result.playlistId),
        result
      ],
      lastSyncTime: result.checkedAt
    })),

  dismissResult: (playlistId) =>
    set((s) => ({
      pendingResults: s.pendingResults.filter((r) => r.playlistId !== playlistId)
    })),

  clearResults: () => set({ pendingResults: [] })
}))
