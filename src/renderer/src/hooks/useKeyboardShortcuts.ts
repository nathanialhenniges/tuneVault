import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { audioEngine } from '../lib/audioEngine'
import { useShortcutOverlayStore } from '../components/ui/KeyboardShortcutsModal'

export function useKeyboardShortcuts(): void {
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const volume = usePlayerStore((s) => s.volume)

  useEffect(() => {
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

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          if (e.metaKey || e.ctrlKey) {
            next()
          } else {
            // Seek forward 5s
            const currentSeek = audioEngine.getSeek()
            audioEngine.seek(currentSeek + 5)
          }
          break
        case 'ArrowLeft':
          if (e.metaKey || e.ctrlKey) {
            prev()
          } else {
            // Seek backward 5s
            const currentSeek2 = audioEngine.getSeek()
            audioEngine.seek(Math.max(0, currentSeek2 - 5))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(1, volume + 0.05))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(0, volume - 0.05))
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, next, prev, setVolume, volume])
}
