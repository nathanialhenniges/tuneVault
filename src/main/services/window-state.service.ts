import { app, screen, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

interface Bounds {
  x?: number
  y?: number
  width: number
  height: number
}

const DEFAULTS: Bounds = { width: 1100, height: 740 }

/**
 * Remember window size and position across launches. A desktop app that reopens
 * at the same default size in the middle of the screen every time reads as a
 * web page in a frame.
 */
export class WindowStateService {
  private static file(): string {
    return join(app.getPath('userData'), 'window-state.json')
  }

  static load(): Bounds {
    let stored: Partial<Bounds>
    try {
      stored = JSON.parse(readFileSync(this.file(), 'utf-8')) as Partial<Bounds>
    } catch {
      return DEFAULTS
    }

    const width = Math.max(900, Math.round(stored.width ?? DEFAULTS.width))
    const height = Math.max(560, Math.round(stored.height ?? DEFAULTS.height))
    if (stored.x === undefined || stored.y === undefined) return { width, height }

    // A display that existed last launch may be gone now; an off-screen window
    // is unreachable, so fall back to letting the OS place it.
    const onScreen = screen.getAllDisplays().some((display) => {
      const a = display.workArea
      return (
        stored.x! >= a.x - 40 &&
        stored.y! >= a.y - 40 &&
        stored.x! < a.x + a.width &&
        stored.y! < a.y + a.height
      )
    })
    return onScreen ? { x: stored.x, y: stored.y, width, height } : { width, height }
  }

  /** Save on resize/move end and on close. Fullscreen bounds are not persisted. */
  static track(window: BrowserWindow): void {
    const save = (): void => {
      if (window.isDestroyed() || window.isFullScreen() || window.isMinimized()) return
      const { x, y, width, height } = window.getNormalBounds()
      const file = this.file()
      const tmp = file + '.tmp'
      try {
        writeFileSync(tmp, JSON.stringify({ x, y, width, height }), 'utf-8')
        renameSync(tmp, file)
      } catch {
        /* window state is a nicety; never let it break a close */
      }
    }
    window.on('resized', save)
    window.on('moved', save)
    window.on('close', save)
  }
}
