import { create } from 'zustand'
import type { AppSettings } from '../../../shared/models'
import { api } from '../lib/api'

interface SettingsState {
  settings: AppSettings | null
  loading: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: true,
  load: async () => {
    set({ settings: await api.settings.get(), loading: false })
  },
  update: async (patch) => {
    set({ settings: await api.settings.set(patch) })
  }
}))
