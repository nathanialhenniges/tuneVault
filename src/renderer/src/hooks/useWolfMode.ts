import { create } from 'zustand'

interface WolfModeState {
  unlocked: boolean
  enabled: boolean
  toggle: () => void
  unlock: () => void
}

export const useWolfModeStore = create<WolfModeState>((set) => ({
  unlocked: localStorage.getItem('wolfUnlocked') === 'true',
  enabled: localStorage.getItem('wolfMode') === 'true',
  toggle: () =>
    set((state) => {
      const next = !state.enabled
      localStorage.setItem('wolfMode', String(next))
      return { enabled: next }
    }),
  unlock: () =>
    set((state) => {
      localStorage.setItem('wolfUnlocked', 'true')
      if (!state.unlocked) {
        // First unlock also enables it
        localStorage.setItem('wolfMode', 'true')
        return { unlocked: true, enabled: true }
      }
      // Already unlocked — just toggle
      const next = !state.enabled
      localStorage.setItem('wolfMode', String(next))
      return { unlocked: true, enabled: next }
    })
}))

export function useWolfMode(): boolean {
  return useWolfModeStore((s) => s.enabled)
}
