import { create } from 'zustand'
import type { AppSettings } from '../../../shared/models'
import { DEFAULT_SETTINGS } from '../../../shared/models'
import { toast } from './toastStore'

function applyTheme(theme: 'dark' | 'light' | 'system'): void {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

let mqlListener: ((e: MediaQueryListEvent) => void) | null = null
const mql = window.matchMedia('(prefers-color-scheme: dark)')

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<void>
  selectMusicDir: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await window.api.getSettings()
    applyTheme(settings.theme)
    set({ settings, loaded: true })

    // Remove previous listener before adding new one
    if (mqlListener) {
      mql.removeEventListener('change', mqlListener)
    }
    mqlListener = () => {
      const current = useSettingsStore.getState().settings
      if (current.theme === 'system') {
        applyTheme('system')
      }
    }
    mql.addEventListener('change', mqlListener)
  },

  update: async (partial) => {
    const settings = await window.api.setSettings(partial)
    if (partial.theme) {
      applyTheme(settings.theme)
    }
    set({ settings })
    toast.success('Settings saved')
  },

  selectMusicDir: async () => {
    const dir = await window.api.selectDirectory()
    if (dir) {
      const settings = await window.api.setSettings({ musicDir: dir })
      set({ settings })
    }
  }
}))
