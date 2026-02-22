import { useEffect, useRef } from 'react'

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
]

export function useKonamiCode(onActivate: () => void): void {
  const index = useRef(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === KONAMI_SEQUENCE[index.current]) {
        index.current++
        if (index.current === KONAMI_SEQUENCE.length) {
          index.current = 0
          onActivate()
        }
      } else {
        index.current = 0
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onActivate])
}
