import type { Playlist, Track } from '../../../shared/models'
import { fetchYouTubePlaylist, isYouTubeUrl, searchOne } from './youtube'
import { parseApplePlaylistHtml, extractAppleListId, isAppleMusicUrl } from './apple-parse'
import {
  parseSpotifyPlaylistHtml,
  extractSpotifyId,
  isSpotifyUrl,
  toEmbedUrl
} from './spotify-parse'

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
}

/**
 * Spotify and Apple Music expose no free audio, so a scraped tracklist is only
 * names. Each one gets searched on YouTube (SoundCloud as fallback) to become a
 * downloadable Track. Tracks with no match anywhere are dropped.
 * ponytail: fixed concurrency 4 — bump if large playlists feel slow.
 */
async function resolveScraped(
  scraped: Scraped[],
  album: string
): Promise<Track[]> {
  const resolved = await mapLimit(scraped, 4, async (t): Promise<Track | null> => {
    const hit = await searchOne(`${t.artist} ${t.title}`)
    if (!hit) return null
    return {
      id: hit.id,
      position: t.position,
      title: t.title,
      artist: t.artist,
      album,
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

async function fetchApplePlaylist(url: string): Promise<Playlist> {
  const parsed = parseApplePlaylistHtml(await fetchHtml(url, 'Apple Music'))
  const tracks = await resolveScraped(parsed.tracks, parsed.title)
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

async function fetchSpotifyPlaylist(url: string): Promise<Playlist> {
  const embed = toEmbedUrl(url)
  if (!embed) {
    throw new Error('That Spotify link is not a playlist or album URL.')
  }
  const parsed = parseSpotifyPlaylistHtml(await fetchHtml(embed, 'Spotify'))
  const tracks = await resolveScraped(parsed.tracks, parsed.title)
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

export async function resolvePlaylist(rawUrl: string): Promise<Playlist> {
  const url = rawUrl.trim()
  if (!url) throw new Error('Paste a playlist link first.')

  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.playlist

  let playlist: Playlist
  if (isAppleMusicUrl(url)) {
    playlist = await fetchApplePlaylist(url)
  } else if (isSpotifyUrl(url)) {
    playlist = await fetchSpotifyPlaylist(url)
  } else if (isYouTubeUrl(url)) {
    playlist = await fetchYouTubePlaylist(url)
  } else {
    throw new Error(
      'Unrecognised link. Paste a Spotify, YouTube or Apple Music playlist or album URL.'
    )
  }

  cache.set(url, { at: Date.now(), playlist })
  return playlist
}

export function clearResolveCache(): void {
  cache.clear()
}
