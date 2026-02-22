import { create } from 'zustand'

export type VisualizerStyle = 'bars' | 'waveform' | 'circular'

interface VisualizerState {
  enabled: boolean
  style: VisualizerStyle
  toggle: () => void
  setStyle: (style: VisualizerStyle) => void
  cycleStyle: () => void
}

const STORAGE_KEY = 'tunevault:visualizer'
const STYLES: VisualizerStyle[] = ['bars', 'waveform', 'circular']

function loadPersisted(): { enabled: boolean; style: VisualizerStyle } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
        style: STYLES.includes(parsed.style) ? parsed.style : 'bars'
      }
    }
  } catch { /* ignore */ }
  return { enabled: false, style: 'bars' }
}

function persist(state: { enabled: boolean; style: VisualizerStyle }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const initial = loadPersisted()

export const useVisualizerStore = create<VisualizerState>((set) => ({
  enabled: initial.enabled,
  style: initial.style,

  toggle: () =>
    set((s) => {
      const next = { enabled: !s.enabled, style: s.style }
      persist(next)
      return next
    }),

  setStyle: (style) =>
    set((s) => {
      const next = { enabled: s.enabled, style }
      persist(next)
      return { style }
    }),

  cycleStyle: () =>
    set((s) => {
      const idx = STYLES.indexOf(s.style)
      const style = STYLES[(idx + 1) % STYLES.length]
      persist({ enabled: s.enabled, style })
      return { style }
    })
}))
