import type { Playlist, ResolveProgress, Track } from '../../../shared/models'
import { trackKey } from '../../../shared/utils'
import { fetchYouTubePlaylist, isYouTubeUrl, searchOne } from './youtube'
import { parseApplePlaylistHtml, extractAppleListId, isAppleMusicUrl } from './apple-parse'
import {
  parseSpotifyPlaylistHtml,
  extractSpotifyId,
  isSpotifyUrl,
  toEmbedUrl
} from './spotify-parse'
import {
  isMusicAppUrl,
  musicAppPlaylistId,
  readMusicAppPlaylist,
  listMusicAppPlaylists
} from './music-app'

export { listMusicAppPlaylists, musicAppUrl } from './music-app'

// Pretend to be a desktop browser — both Apple and Spotify serve a stripped page
// to unknown agents, without the JSON blob we need.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ponytail: tiny inline concurrency limiter, no p-limit dep for two callers.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const idx = next++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchHtml(url: string, service: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' }
    })
  } catch (err) {
    throw new Error(`Could not reach ${service}: ${(err as Error).message}`)
  }
  if (!res.ok) throw new Error(`Could not load the ${service} page (HTTP ${res.status}).`)
  return res.text()
}

interface Scraped {
  title: string
  artist: string
  duration?: number
  position: number
  /** Known up front for Music app tracks; absent for scraped web pages. */
  album?: string
  genre?: string
  /** A file already on this Mac. Such tracks skip the YouTube search entirely. */
  localPath?: string
}

/**
 * Spotify and Apple Music expose no free audio, so a scraped tracklist is only
 * names. Each one gets searched on YouTube (SoundCloud as fallback) to become a
 * downloadable Track. Tracks with no match anywhere are dropped.
 * ponytail: fixed concurrency 4 — bump if large playlists feel slow.
 */
async function resolveScraped(
  scraped: Scraped[],
  album: string,
  onProgress?: (done: number, total: number) => void
): Promise<Track[]> {
  let done = 0
  const resolved = await mapLimit(scraped, 4, async (t): Promise<Track | null> => {
    // A track already on this Mac needs no search and no download.
    if (t.localPath) {
      onProgress?.(++done, scraped.length)
      return {
        id: `local:${t.localPath}`,
        position: t.position,
        title: t.title,
        artist: t.artist,
        album: t.album || album,
        genre: t.genre,
        duration: t.duration ?? 0,
        sourceUrl: t.localPath,
        source: 'local',
        localPath: t.localPath
      }
    }

    const hit = await searchOne(`${t.artist} ${t.title}`, trackKey(t.artist, t.title))
    onProgress?.(++done, scraped.length)
    if (!hit) return null
    return {
      id: hit.id,
      position: t.position,
      title: t.title,
      artist: t.artist,
      album: t.album || album,
      genre: t.genre,
      // Prefer the source's own duration; it describes the actual song, not a
      // search hit that might be a 10-hour loop.
      duration: t.duration && t.duration > 0 ? t.duration : hit.duration,
      sourceUrl: hit.sourceUrl,
      source: hit.source,
      thumbnail: hit.thumbnail
    }
  })
  return resolved.filter((t): t is Track => t !== null)
}

async function fetchApplePlaylist(url: string, report: Report): Promise<Playlist> {
  const parsed = parseApplePlaylistHtml(await fetchHtml(url, 'Apple Music'))
  report({
    phase: 'matching',
    done: 0,
    total: parsed.tracks.length,
    provider: 'apple',
    title: parsed.title
  })
  const tracks = await resolveScraped(parsed.tracks, parsed.title, (done, total) =>
    report({ phase: 'matching', done, total, provider: 'apple', title: parsed.title })
  )
  if (!tracks.length) {
    throw new Error('Could not find any of these tracks on YouTube or SoundCloud.')
  }
  return {
    id: extractAppleListId(url) || url,
    title: parsed.title,
    url,
    provider: 'apple',
    uploader: 'Apple Music',
    thumbnail: parsed.artworkUrl || tracks[0].thumbnail,
    tracks
  }
}

async function fetchSpotifyPlaylist(url: string, report: Report): Promise<Playlist> {
  const embed = toEmbedUrl(url)
  if (!embed) {
    throw new Error('That Spotify link is not a playlist or album URL.')
  }
  const parsed = parseSpotifyPlaylistHtml(await fetchHtml(embed, 'Spotify'))
  report({
    phase: 'matching',
    done: 0,
    total: parsed.tracks.length,
    provider: 'spotify',
    title: parsed.title
  })
  const tracks = await resolveScraped(parsed.tracks, parsed.title, (done, total) =>
    report({ phase: 'matching', done, total, provider: 'spotify', title: parsed.title })
  )
  if (!tracks.length) {
    throw new Error('Could not find any of these tracks on YouTube or SoundCloud.')
  }
  return {
    id: extractSpotifyId(url) || url,
    title: parsed.title,
    url,
    provider: 'spotify',
    uploader: 'Spotify',
    thumbnail: parsed.artworkUrl || tracks[0].thumbnail,
    tracks
  }
}

// Resolving a playlist is slow (one yt-dlp search per track for Spotify/Apple),
// so remember the result briefly — the user will bounce between preview screens.
const CACHE_TTL_MS = 30 * 60 * 1000
const cache = new Map<string, { at: number; playlist: Playlist }>()

/**
 * A playlist in the Mac's Music app. This is the only source that sees a
 * playlist in full: Apple's public web page for a personal playlist exposes
 * just a handful of tracks (its own `trackCount` field agrees), while the
 * Music app reports every one, with real album and genre attached.
 */
async function fetchMusicAppPlaylist(url: string, report: Report): Promise<Playlist> {
  const id = musicAppPlaylistId(url)
  if (!id) throw new Error('That is not a Music app playlist.')

  const [{ tracks: rows }, playlists] = await Promise.all([
    readMusicAppPlaylist(id),
    listMusicAppPlaylists().catch(() => [])
  ])
  const title = playlists.find((p) => p.id === id)?.name ?? 'Music app playlist'

  /*
   * No YouTube searching here, deliberately.
   *
   * The Music app hands over the full library if asked — thousands of tracks —
   * and searching for each one just to draw a preview would take hours and
   * invite a rate limit for tracks the user may never select. Everything needed
   * for the preview and the size estimate (title, artist, album, genre,
   * duration) is already in the library, so matching is deferred to download
   * time and only for the tracks actually chosen.
   */
  const tracks: Track[] = rows.map((row, i) => {
    const base = {
      // Playlist position, not the album track number the Music app reports —
      // that repeats across albums and would scramble the "NN - " ordering.
      position: i + 1,
      title: row.name,
      artist: row.artist || 'Unknown Artist',
      album: row.album || title,
      genre: row.genre || undefined,
      duration: row.duration
    }
    if (row.location) {
      // Already a file on this Mac: copy it, never re-download it.
      return {
        ...base,
        id: `local:${row.location}`,
        sourceUrl: row.location,
        source: 'local' as const,
        localPath: row.location
      }
    }
    return {
      ...base,
      id: `musicapp:${id}:${i}`,
      sourceUrl: '',
      source: 'youtube' as const,
      needsMatch: true
    }
  })

  report({
    phase: 'done',
    done: tracks.length,
    total: tracks.length,
    provider: 'music-app',
    title
  })

  return {
    id,
    title,
    url,
    provider: 'music-app',
    uploader: 'Music app',
    tracks
  }
}

type Report = (progress: ResolveProgress) => void

export async function resolvePlaylist(
  rawUrl: string,
  report: Report = () => {},
  opts: { refresh?: boolean } = {}
): Promise<Playlist> {
  const url = rawUrl.trim()
  if (!url) throw new Error('Paste a playlist link first.')

  // "Check for new tracks" must see the playlist as it is now, not as it was
  // half an hour ago.
  const hit = opts.refresh ? undefined : cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.playlist

  report({ phase: 'fetching', done: 0, total: 0 })

  let playlist: Playlist
  if (isMusicAppUrl(url)) {
    playlist = await fetchMusicAppPlaylist(url, report)
  } else if (isAppleMusicUrl(url)) {
    playlist = await fetchApplePlaylist(url, report)
  } else if (isSpotifyUrl(url)) {
    playlist = await fetchSpotifyPlaylist(url, report)
  } else if (isYouTubeUrl(url)) {
    // yt-dlp returns the whole list in one call; there is nothing to count.
    playlist = await fetchYouTubePlaylist(url)
  } else {
    throw new Error(
      'Unrecognised link. Paste a Spotify, YouTube or Apple Music playlist or album URL.'
    )
  }

  cache.set(url, { at: Date.now(), playlist })
  report({
    phase: 'done',
    done: playlist.tracks.length,
    total: playlist.tracks.length,
    provider: playlist.provider,
    title: playlist.title
  })
  return playlist
}

export function clearResolveCache(): void {
  cache.clear()
}
