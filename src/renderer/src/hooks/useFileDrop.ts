import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Whole-window drag target for files dragged in from Finder.
 *
 * Electron removed `File.path` in v32, so the absolute path comes from
 * `webUtils.getPathForFile`, exposed by the preload bridge as `api.pathForFile`.
 * The counter guards against dragleave firing as the pointer crosses child
 * elements — without it the highlight flickers.
 */
export function useFileDrop(onDrop: (paths: string[]) => void): { dragging: boolean } {
  const [depth, setDepth] = useState(0)

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      setDepth(0)
      const files = Array.from(event.dataTransfer?.files ?? [])
      const paths = files.map((file) => api.pathForFile(file)).filter(Boolean)
      if (paths.length) onDrop(paths)
    },
    [onDrop]
  )

  useEffect(() => {
    const over = (e: DragEvent): void => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const enter = (e: DragEvent): void => {
      e.preventDefault()
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) setDepth((d) => d + 1)
    }
    const leave = (e: DragEvent): void => {
      e.preventDefault()
      setDepth((d) => Math.max(0, d - 1))
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDrop])

  return { dragging: depth > 0 }
}
