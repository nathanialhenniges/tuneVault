import { app } from 'electron'
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { TrackSource } from '../../shared/models'

export interface CachedHit {
  id: string
  sourceUrl: string
  source: TrackSource
  duration: number
  thumbnail: string
  at: number
}

/**
 * Remembers which YouTube video a given song resolved to, permanently.
 *
 * Searching is the rate-limited part of this app, so the cheapest way to avoid
 * a limit is to never ask the same question twice. A song matched once stays
 * matched across runs, across devices and across restarts — re-importing a
 * library you have imported before costs almost no searches at all.
 *
 * Entries expire after 30 days so a dead video eventually gets re-matched.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

let cache: Record<string, CachedHit> | null = null
let dirty = false
let flushTimer: NodeJS.Timeout | null = null

function file(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'search-cache.json')
}

function load(): Record<string, CachedHit> {
  if (cache) return cache
  try {
    cache = JSON.parse(readFileSync(file(), 'utf-8')) as Record<string, CachedHit>
  } catch {
    cache = {}
  }
  return cache
}

/** Batched: a bulk import would otherwise rewrite the file once per track. */
function scheduleFlush(): void {
  dirty = true
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, 2000)
  flushTimer.unref?.()
}

export function flush(): void {
  if (!dirty || !cache) return
  dirty = false
  const path = file()
  const tmp = path + '.tmp'
  try {
    writeFileSync(tmp, JSON.stringify(cache), 'utf-8')
    renameSync(tmp, path)
  } catch {
    /* a cache is an optimisation; never fail a download over it */
  }
}

export const SearchCache = {
  get(key: string): CachedHit | null {
    const hit = load()[key]
    if (!hit) return null
    if (Date.now() - hit.at > TTL_MS) return null
    return hit
  },

  set(key: string, hit: Omit<CachedHit, 'at'>): void {
    load()[key] = { ...hit, at: Date.now() }
    scheduleFlush()
  },

  /** Negative results are worth remembering too, but only briefly. */
  size(): number {
    return Object.keys(load()).length
  }
}
