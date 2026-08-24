// Pure parser for public Spotify playlist/album pages. No electron/node deps so it
// stays unit-testable.
//
// Spotify has no free, keyless API for reading a public playlist, but their
// *embed* page ships the full tracklist inside a `__NEXT_DATA__` JSON blob — the
// same data the little embeddable player hydrates from. We fetch that page and
// walk the blob generically rather than by fixed key paths, so it survives
// Spotify reshuffling their Next.js props.
// ponytail: heuristics on `trackList` / `coverArt`. If Spotify renames those this
// throws a friendly error rather than silently returning an empty playlist.

export interface ParsedSpotifyTrack {
  title: string
  artist: string
  /** Seconds. 0 when Spotify did not report one. */
  duration: number
  position: number
}

export interface ParsedSpotifyPlaylist {
  title: string
  artworkUrl?: string
  tracks: ParsedSpotifyTrack[]
}

export function isSpotifyUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'open.spotify.com' || host.endsWith('.spotify.com')
  } catch {
    return /(^|\/\/|\.)open\.spotify\.com\b/i.test(url)
  }
}

/**
 * Map any Spotify playlist/album/track URL to its embed equivalent, which is the
 * page that carries the JSON blob. Returns null for URLs we can't read.
 */
export function toEmbedUrl(url: string): string | null {
  const m = url.match(/(playlist|album)[/:]([A-Za-z0-9]+)/)
  if (!m) return null
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`
}

export function extractSpotifyId(url: string): string | null {
  const m = url.match(/(?:playlist|album)[/:]([A-Za-z0-9]+)/)
  return m ? m[1] : null
}

function isObj(node: unknown): node is Record<string, unknown> {
  return !!node && typeof node === 'object'
}

/** First array found under a `trackList` key, anywhere in the blob. */
function findTrackList(node: unknown): unknown[] | undefined {
  if (!isObj(node)) return undefined
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findTrackList(n)
      if (found) return found
    }
    return undefined
  }
  if (Array.isArray(node.trackList) && node.trackList.length) {
    return node.trackList as unknown[]
  }
  for (const k of Object.keys(node)) {
    const found = findTrackList(node[k])
    if (found) return found
  }
  return undefined
}

/** The entity node describing the playlist itself — it has a name and cover art. */
function findEntity(node: unknown): Record<string, unknown> | undefined {
  if (!isObj(node)) return undefined
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findEntity(n)
      if (found) return found
    }
    return undefined
  }
  if (
    (typeof node.name === 'string' || typeof node.title === 'string') &&
    ('coverArt' in node || 'trackList' in node)
  ) {
    return node
  }
  for (const k of Object.keys(node)) {
    const found = findEntity(node[k])
    if (found) return found
  }
  return undefined
}

/** Spotify cover art comes as `{ sources: [{url, width, height}, ...] }`. */
function pickCover(entity: Record<string, unknown> | undefined): string | undefined {
  const cover = entity?.coverArt as { sources?: { url?: string; width?: number }[] } | undefined
  const sources = cover?.sources
  if (!sources?.length) return undefined
  const preferred = sources.find((s) => (s.width ?? 0) >= 300) ?? sources[sources.length - 1]
  return preferred?.url
}

function artistOf(row: Record<string, unknown>): string {
  // Newer blobs use `subtitle`; some use an `artists: [{name}]` array.
  if (typeof row.subtitle === 'string' && row.subtitle.trim()) return row.subtitle.trim()
  const artists = row.artists as { name?: unknown }[] | undefined
  if (Array.isArray(artists)) {
    const names = artists.map((a) => a?.name).filter((n): n is string => typeof n === 'string')
    if (names.length) return names.join(', ')
  }
  return 'Unknown Artist'
}

export function parseSpotifyPlaylistHtml(html: string): ParsedSpotifyPlaylist {
  const block = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!block) {
    throw new Error(
      'Could not read this Spotify playlist. Make sure the link is a public playlist or album.'
    )
  }

  let data: unknown
  try {
    data = JSON.parse(block[1].trim())
  } catch {
    throw new Error('Spotify playlist data was malformed.')
  }

  const rows = findTrackList(data)
  if (!rows?.length) {
    throw new Error('No tracks found in this Spotify playlist. Private playlists cannot be read.')
  }

  const tracks: ParsedSpotifyTrack[] = []
  for (const raw of rows) {
    if (!isObj(raw)) continue
    const title = typeof raw.title === 'string' ? raw.title.trim() : ''
    if (!title) continue
    // `duration` is milliseconds in every blob shape seen so far.
    const ms = typeof raw.duration === 'number' ? raw.duration : 0
    tracks.push({
      title,
      artist: artistOf(raw),
      duration: ms > 0 ? Math.round(ms / 1000) : 0,
      position: tracks.length + 1
    })
  }
  if (!tracks.length) throw new Error('No playable tracks found in this Spotify playlist.')

  const entity = findEntity(data)
  const name = entity?.name ?? entity?.title
  return {
    title: typeof name === 'string' && name.trim() ? name.trim() : 'Spotify Playlist',
    artworkUrl: pickCover(entity),
    tracks
  }
}
