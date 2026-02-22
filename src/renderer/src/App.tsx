import { useCallback, useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { AnimatedRoutes } from './components/layout/AnimatedRoutes'
import { PlayerBar } from './components/player/PlayerBar'
import { useSettingsStore } from './store/settingsStore'
import { useLibraryStore } from './store/libraryStore'
import { useDownloadStore } from './store/downloadStore'
import { usePlayer } from './hooks/usePlayer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePlayerStore } from './store/playerStore'
import { useKonamiCode } from './hooks/useKonamiCode'
import { useWolfModeStore } from './hooks/useWolfMode'
import { DisclaimerModal } from './components/ui/DisclaimerModal'

export default function App(): JSX.Element {
  const loadSettings = useSettingsStore((s) => s.load)
  const loadLibrary = useLibraryStore((s) => s.load)
  const setProgress = useDownloadStore((s) => s.setProgress)
  const setComplete = useDownloadStore((s) => s.setComplete)
  const setError = useDownloadStore((s) => s.setError)

  usePlayer()
  useKeyboardShortcuts()

  const unlockWolf = useWolfModeStore((s) => s.unlock)
  useKonamiCode(useCallback(() => unlockWolf(), [unlockWolf]))

  useEffect(() => {
    loadSettings()
    loadLibrary()

    const unsubProgress = window.api.onDownloadProgress(setProgress)
    const unsubComplete = window.api.onDownloadComplete((data) => {
      setComplete(data.trackId)
      loadLibrary()
    })
    const unsubError = window.api.onDownloadError((data) => {
      setError(data.trackId, data.error)
    })

    const unsubToggle = window.api.onTrayTogglePlay(() => {
      usePlayerStore.getState().togglePlay()
    })
    const unsubNext = window.api.onTrayNext(() => {
      usePlayerStore.getState().next()
    })
    const unsubPrev = window.api.onTrayPrev(() => {
      usePlayerStore.getState().prev()
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
      unsubToggle()
      unsubNext()
      unsubPrev()
    }
  }, [])

  return (
    <MemoryRouter>
      <div className="flex flex-col h-screen bg-transparent text-text-primary transition-colors duration-200">
        <MainLayout>
          <AnimatedRoutes />
        </MainLayout>
        <PlayerBar />
        <DisclaimerModal />
      </div>
    </MemoryRouter>
  )
}
