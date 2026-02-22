import { create } from 'zustand'
import type { Track } from '../../../shared/models'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  originalQueue: Track[]
  queueIndex: number
  isPlaying: boolean
  volume: number
  seek: number
  duration: number
  shuffle: boolean
  repeat: RepeatMode

  setTrack: (track: Track) => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  setVolume: (volume: number) => void
  setSeek: (seek: number) => void
  setDuration: (duration: number) => void
  toggleShuffle: () => void
  setRepeat: (mode: RepeatMode) => void
  setIsPlaying: (playing: boolean) => void
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.8,
  seek: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off',

  setTrack: (track) => set({ currentTrack: track }),

  setQueue: (tracks, startIndex = 0) => {
    const state = get()
    let queue = [...tracks]
    let idx = startIndex

    if (state.shuffle) {
      const current = queue[startIndex]
      queue = shuffleArray(queue)
      idx = queue.indexOf(current)
    }

    set({
      queue,
      originalQueue: [...tracks],
      queueIndex: idx,
      currentTrack: queue[idx] ?? null
    })
  },

  addToQueue: (track) =>
    set((state) => ({
      queue: [...state.queue, track],
      originalQueue: [...state.originalQueue, track]
    })),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  next: () => {
    const { queue, queueIndex, repeat } = get()
    if (queue.length === 0) return

    let nextIdx = queueIndex + 1
    if (repeat === 'one') {
      nextIdx = queueIndex
    } else if (nextIdx >= queue.length) {
      if (repeat === 'all') {
        nextIdx = 0
      } else {
        set({ isPlaying: false })
        return
      }
    }

    set({
      queueIndex: nextIdx,
      currentTrack: queue[nextIdx],
      seek: 0
    })
  },

  prev: () => {
    const { queue, queueIndex, seek } = get()
    if (queue.length === 0) return

    // If more than 3s into song, restart it
    if (seek > 3) {
      set({ seek: 0 })
      return
    }

    let prevIdx = queueIndex - 1
    if (prevIdx < 0) prevIdx = queue.length - 1

    set({
      queueIndex: prevIdx,
      currentTrack: queue[prevIdx],
      seek: 0
    })
  },

  setVolume: (volume) => set({ volume }),
  setSeek: (seek) => set({ seek }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  toggleShuffle: () => {
    const { shuffle, originalQueue, queue, queueIndex, currentTrack } = get()
    if (shuffle) {
      // Unshuffle — restore original order
      const idx = originalQueue.findIndex((t) => t.id === currentTrack?.id)
      set({ shuffle: false, queue: [...originalQueue], queueIndex: idx >= 0 ? idx : 0 })
    } else {
      // Shuffle
      const current = queue[queueIndex]
      const shuffled = shuffleArray(queue)
      const idx = shuffled.indexOf(current)
      set({ shuffle: true, queue: shuffled, queueIndex: idx })
    }
  },

  setRepeat: (mode) => set({ repeat: mode })
}))
