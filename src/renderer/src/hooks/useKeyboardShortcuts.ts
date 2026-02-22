import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { audioEngine } from '../lib/audioEngine'
import { useShortcutOverlayStore } from '../components/ui/KeyboardShortcutsModal'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    let volumeThrottleTimer: ReturnType<typeof setTimeout> | null = null

    const handler = (e: KeyboardEvent): void => {
      // Don't handle shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // ? key (Shift+/) toggles shortcut overlay
      if (e.key === '?') {
        e.preventDefault()
        useShortcutOverlayStore.getState().toggle()
        return
      }

      const store = usePlayerStore.getState()

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          store.togglePlay()
          break
        case 'ArrowRight':
          if (e.metaKey || e.ctrlKey) {
            store.next()
          } else {
            // Seek forward 5s
            const currentSeek = audioEngine.getSeek()
            audioEngine.seek(currentSeek + 5)
          }
          break
        case 'ArrowLeft':
          if (e.metaKey || e.ctrlKey) {
            store.prev()
          } else {
            // Seek backward 5s
            const currentSeek2 = audioEngine.getSeek()
            audioEngine.seek(Math.max(0, currentSeek2 - 5))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!volumeThrottleTimer) {
            store.setVolume(Math.min(1, store.volume + 0.05))
            volumeThrottleTimer = setTimeout(() => { volumeThrottleTimer = null }, 50)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!volumeThrottleTimer) {
            store.setVolume(Math.max(0, store.volume - 0.05))
            volumeThrottleTimer = setTimeout(() => { volumeThrottleTimer = null }, 50)
          }
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (volumeThrottleTimer) clearTimeout(volumeThrottleTimer)
    }
  }, [])
}
