import { useRef, useEffect, useState } from 'react'
import { useLocation, Routes, Route } from 'react-router-dom'
import { PlaylistView } from '../playlist/PlaylistView'
import { DownloadQueue } from '../download/DownloadQueue'
import { LibraryView } from '../library/LibraryView'
import { SettingsView } from '../settings/SettingsView'

export function AnimatedRoutes(): JSX.Element {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter')
  const prevKey = useRef(location.key)

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key
      setTransitionStage('exit')
    }
  }, [location])

  const handleAnimationEnd = (): void => {
    if (transitionStage === 'exit') {
      setDisplayLocation(location)
      setTransitionStage('enter')
    }
  }

  return (
    <div
      className={transitionStage === 'enter' ? 'route-enter' : 'route-exit'}
      onAnimationEnd={handleAnimationEnd}
    >
      <Routes location={displayLocation}>
        <Route path="/" element={<PlaylistView />} />
        <Route path="/downloads" element={<DownloadQueue />} />
        <Route path="/library" element={<LibraryView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </div>
  )
}
