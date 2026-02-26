import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps): JSX.Element {
  const mainRef = useRef<HTMLElement>(null)
  const location = useLocation()

  // Reset scroll position on route navigation
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TitleBar />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
