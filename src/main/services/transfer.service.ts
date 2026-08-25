import { app } from 'electron'
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join } from 'path'

/**
 * Which files have been copied onto the physical device.
 *
 * The files stay in the folder after a transfer, so this is bookkeeping, not
 * deduplication — duplicate protection already works off what is on disk. This
 * answers a different question: "which of these have I actually dragged across
 * yet?"
 *
 * Keyed by the path relative to the device folder, so moving or renaming the
 * whole folder keeps the marks. Renaming an individual file loses its mark,
 * which is the right trade for not needing a database.
 */
type Store = Record<string, Record<string, string>>

let store: Store | null = null
let flushTimer: NodeJS.Timeout | null = null

function file(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'transfers.json')
}

function load(): Store {
  if (store) return store
  try {
    store = JSON.parse(readFileSync(file(), 'utf-8')) as Store
  } catch {
    store = {}
  }
  return store
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, 500)
  flushTimer.unref?.()
}

export function flush(): void {
  if (!store) return
  const path = file()
  const tmp = path + '.tmp'
  try {
    writeFileSync(tmp, JSON.stringify(store), 'utf-8')
    renameSync(tmp, path)
  } catch {
    /* bookkeeping; never fail an action over it */
  }
}

export const TransferService = {
  /** Relative paths marked as copied onto the device. */
  list(deviceId: string): string[] {
    return Object.keys(load()[deviceId] ?? {})
  },

  set(deviceId: string, relativePaths: string[], transferred: boolean): void {
    const all = load()
    const forDevice = (all[deviceId] ??= {})
    const now = new Date().toISOString()
    for (const path of relativePaths) {
      if (transferred) forDevice[path] = now
      else delete forDevice[path]
    }
    scheduleFlush()
  },

  /** Drop marks for files that are no longer there, so the store cannot grow forever. */
  prune(deviceId: string, existingRelativePaths: string[]): void {
    const all = load()
    const forDevice = all[deviceId]
    if (!forDevice) return
    const alive = new Set(existingRelativePaths)
    let changed = false
    for (const path of Object.keys(forDevice)) {
      if (!alive.has(path)) {
        delete forDevice[path]
        changed = true
      }
    }
    if (changed) scheduleFlush()
  },

  forget(deviceId: string): void {
    delete load()[deviceId]
    scheduleFlush()
  }
}
