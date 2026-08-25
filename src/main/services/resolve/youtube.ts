import { BinaryService } from '../binary.service'
import type { Playlist, Track, TrackSource } from '../../../shared/models'
import { trackKey } from '../../../shared/utils'
import { SearchCache } from '../search-cache.service'

interface FlatEntry {
  id: string
  title?: string
  url?: string
  duration?: number | null
  uploader?: string
  channel?: string
  album?: string
  thumbnails?: Array<{ url: string; width?: number; height?: number }>
  thumbnail?: string
  webpage_url?: string
  playlist_title?: string
  playlist_id?: string
  playlist_index?: number
}

const binary = new BinaryService()

/** One JSON object per line — yt-dlp's `--dump-json` NDJSON output. */
async function flat(target: string): Promise<FlatEntry[]> {
  const stdout = await binary.runYtdlp(
    // `--` terminates options, so a URL or search term beginning with '-' is
    // taken as the target rather than smuggled in as a yt-dlp flag.
    ['--flat-playlist', '--dump-json', '--no-warnings', '--ignore-errors', '--', target],
    { allowPartial: true }
  )
  const entries: FlatEntry[] = []
  for (const line of stdout.trim().split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line) as FlatEntry)
    } catch {
      /* skip malformed line */
    }
  }
  return entries
}

function pickThumbnail(entry: FlatEntry, source: TrackSource = 'youtube'): string {
  if (entry.thumbnails?.length) {
    const preferred = entry.thumbnails.find((t) => (t.width ?? 0) >= 480)
    return preferred?.url ?? entry.thumbnails[entry.thumbnails.length - 1].url
  }
  if (entry.thumbnail) return entry.thumbnail
  return source === 'youtube' ? `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg` : ''
}

export function isYouTubeUrl(url: string): boolean {
  return /(^|\.)(youtube\.com|youtu\.be)/i.test(safeHost(url))
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export async function fetchYouTubePlaylist(url: string): Promise<Playlist> {
  const entries = await flat(url)
  if (entries.length === 0) {
    throw new Error(
      'No tracks found. The playlist may be empty, private, or the URL may not be a playlist.'
    )
  }

  const first = entries[0]
  const id = first.playlist_id || safeHost(url) + url
  const title = first.playlist_title || first.title || 'YouTube Playlist'

  const tracks: Track[] = entries.map((e, i) => ({
    id: e.id,
    position: e.playlist_index ?? i + 1,
    title: e.title || 'Unknown Title',
    artist: e.channel || e.uploader || 'Unknown Artist',
    album: title,
    duration: e.duration ?? 0,
    sourceUrl: `https://www.youtube.com/watch?v=${e.id}`,
    source: 'youtube',
    thumbnail: pickThumbnail(e)
  }))

  return {
    id,
    title,
    url,
    provider: 'youtube',
    uploader: first.channel || first.uploader,
    thumbnail: pickThumbnail(first),
    tracks
  }
}

/*
 * YouTube search is the rate-limited part of this app, and a bulk import can
 * ask for thousands of them. Every search goes through one gate with a minimum
 * gap, so no caller can flood it however many workers are running.
 * ponytail: fixed gap; if imports feel slow and nothing is 429ing, lower it.
 */
const SEARCH_GAP_MS = 1200
let searchChain: Promise<unknown> = Promise.resolve()

function throttleSearch<T>(fn: () => Promise<T>): Promise<T> {
  const run = searchChain.then(async () => {
    const result = await fn()
    await new Promise((r) => setTimeout(r, SEARCH_GAP_MS))
    return result
  })
  searchChain = run.catch(() => undefined)
  return run as Promise<T>
}

export interface SearchHit {
  id: string
  title: string
  duration: number
  sourceUrl: string
  source: TrackSource
  thumbnail: string
}

/**
 * Resolve free text to a downloadable audio URL. YouTube first, SoundCloud as a
 * fallback — this is how Spotify and Apple Music tracks become downloadable,
 * since neither service exposes free audio.
 */
/**
 * `cacheKey` lets the caller key the result on the song's identity rather than
 * the raw query string, so the same song found through different phrasings
 * still counts as one lookup.
 */
export async function searchOne(query: string, cacheKey?: string): Promise<SearchHit | null> {
  const key = cacheKey ?? trackKey('', query)
  const cached = SearchCache.get(key)
  // A cache hit costs no request at all, so it must not wait behind the gate.
  if (cached) {
    return {
      id: cached.id,
      title: query,
      duration: cached.duration,
      sourceUrl: cached.sourceUrl,
      source: cached.source,
      thumbnail: cached.thumbnail
    }
  }

  const hit = await throttleSearch(() => searchOneNow(query))
  if (hit) {
    SearchCache.set(key, {
      id: hit.id,
      sourceUrl: hit.sourceUrl,
      source: hit.source,
      duration: hit.duration,
      thumbnail: hit.thumbnail
    })
  }
  return hit
}

async function searchOneNow(query: string): Promise<SearchHit | null> {
  const backends = [
    { prefix: 'ytsearch1:', source: 'youtube' as const },
    { prefix: 'scsearch1:', source: 'soundcloud' as const }
  ]
  for (const { prefix, source } of backends) {
    let entry: FlatEntry | undefined
    try {
      entry = (await flat(`${prefix}${query}`))[0]
    } catch {
      continue // this backend is down or blocked; try the next
    }
    if (!entry) continue
    const sourceUrl =
      source === 'youtube'
        ? `https://www.youtube.com/watch?v=${entry.id}`
        : entry.webpage_url || entry.url || ''
    if (!sourceUrl) continue
    return {
      id: entry.id,
      title: entry.title || query,
      duration: entry.duration ?? 0,
      sourceUrl,
      source,
      thumbnail: pickThumbnail(entry, source)
    }
  }
  return null
}
