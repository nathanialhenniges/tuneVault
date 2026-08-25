import type { AudioFormat, Provider } from './models'

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 2)} ${units[i]}`
}

export const GB = 1024 ** 3

/**
 * Strips characters that are illegal in filenames on macOS/Windows.
 *
 * Leading dots go too, so a sanitised name can never come out as `.`, `..` or a
 * hidden entry: a playlist or device titled ".." must not be able to walk out
 * of its folder. Ported from the 2.6.1 audit.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()
  const safe = cleaned.replace(/^\.+/, '').trim()
  return safe.length ? safe : 'untitled'
}

/**
 * True when a yt-dlp stderr line or download error signals HTTP 429. Shared so
 * the place that first sees the signal and the place that decides whether to
 * retry cannot drift apart. Ported from the 2.6.1 audit.
 */
export function isRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('rate_limited') ||
    message.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit')
  )
}

/** Canonical on-disk base name (no extension) for a track: "NN - Artist - Title". */
export function trackFileBaseName(track: {
  position: number
  artist: string
  title: string
}): string {
  const pos = String(track.position).padStart(2, '0')
  return `${pos} - ${sanitizeFilename(track.artist)} - ${sanitizeFilename(track.title)}`
}

/**
 * Inverse of `trackFileBaseName`: read "07 - Muse - Hysteria.mp3" back into its
 * parts so a file on disk can be listed the same way a playlist track is.
 *
 * Artist names legitimately contain " - " (e.g. "Sam Fender & Olivia Dean"),
 * so the split is anchored: the leading "NN - " is taken only when the prefix
 * really is digits, and the first remaining " - " separates artist from title.
 * Anything that does not match returns the bare filename as the title, which is
 * the right answer for a file the user dropped in themselves.
 */
export function parseTrackFileName(fileName: string): {
  position: number | null
  artist: string | null
  title: string
} {
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName

  // Accept both our own "07 - " and the bare "07-" / "07 " that files from
  // elsewhere use.
  const numbered = stem.match(/^(\d{1,3})(?: - | ?- ?| )(.*)$/)
  const position = numbered ? Number(numbered[1]) : null
  const rest = numbered ? numbered[2] : stem

  const split = rest.indexOf(' - ')
  if (split <= 0) return { position, artist: null, title: rest }
  return {
    position,
    artist: rest.slice(0, split),
    title: rest.slice(split + 3)
  }
}

/** Display names for each source a playlist can come from. */
export const PROVIDER_LABEL: Record<Provider, string> = {
  youtube: 'YouTube',
  apple: 'Apple Music',
  spotify: 'Spotify',
  'music-app': 'Music app'
}

/**
 * A playlist in the Mac's Music app, addressed as a pseudo-URL so it travels
 * through the same resolve, preview and re-check machinery as a pasted link.
 */
export const MUSIC_APP_URL_PREFIX = 'musicapp://playlist/'

export function musicAppPlaylistUrl(playlistId: string): string {
  return `${MUSIC_APP_URL_PREFIX}${playlistId}`
}

/**
 * Identity of a song for duplicate detection, independent of which playlist it
 * arrived in.
 *
 * The track number is deliberately excluded — the same song sits at position 3
 * in one playlist and 17 in another, and it is still the same song. Case,
 * punctuation and spacing are normalised so "Tame Impala - Loser" and
 * "tame impala – loser" collapse to one key.
 */
export function trackKey(artist: string, title: string): string {
  const normalise = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return `${normalise(artist)}\u0000${normalise(title)}`
}

/**
 * Every artist string a credit could reasonably be filed under.
 *
 * A collaboration is credited inconsistently across sources: the Music app says
 * "Avicii, DevBowser" while the file on disk is tagged just "DevBowser". Keying
 * on the exact string alone means the two never meet and the track is fetched
 * again. Indexing each contributor separately lets either spelling match.
 *
 * The title still has to match, so this cannot merge two different songs — the
 * worst case is a solo version and a collaboration that share a title exactly.
 */
export function artistVariants(artist: string): string[] {
  if (!hasUsableArtist(artist)) return []
  const whole = artist.trim()
  const parts = whole
    // `\b` goes before the optional dot: "feat\.?\b" never matches "feat. B",
    // because there is no word boundary between the dot and the space.
    .split(/\s*(?:,|&|\+|\bfeat\b\.?|\bft\b\.?|\bwith\b|\bvs\b\.?|\bx\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => hasUsableArtist(part))

  const seen = new Set<string>()
  const out: string[] = []
  for (const candidate of [whole, ...parts]) {
    const normalised = trackKey(candidate, '')
    if (seen.has(normalised)) continue
    seen.add(normalised)
    out.push(candidate)
  }
  return out
}

/** Normalised title alone, for files that carry no artist at all. */
export function trackTitleKey(title: string): string {
  return trackKey('', title)
}

/**
 * What a device already holds, in the two forms a match can take.
 *
 * `full` is artist + title, which is the reliable comparison. `titleOnly` holds
 * entries for files whose artist could not be determined — an import named
 * "01-alpha-protocol.mp3" with no tags, say. Those cannot be compared on
 * artist, so they are matched on title, which is looser but far better than the
 * previous behaviour: a file with no readable artist was simply left out of the
 * index and downloaded again every time.
 */
export interface TrackIndex {
  full: string[]
  titleOnly: string[]
}

export const EMPTY_TRACK_INDEX: TrackIndex = { full: [], titleOnly: [] }

/** Set-backed view of a TrackIndex, for repeated lookups. */
export function toTrackIndexSets(index: TrackIndex): {
  full: Set<string>
  titleOnly: Set<string>
} {
  return { full: new Set(index.full), titleOnly: new Set(index.titleOnly) }
}

const UNKNOWN_ARTIST = /^(unknown artist|unknown|various artists|va)$/i

export function hasUsableArtist(artist: string | undefined | null): boolean {
  return !!artist && artist.trim().length > 0 && !UNKNOWN_ARTIST.test(artist.trim())
}

/** Is this song already accounted for by the index? */
export function isAlreadyPresent(
  sets: { full: Set<string>; titleOnly: Set<string> },
  artist: string,
  title: string
): boolean {
  for (const candidate of artistVariants(artist)) {
    if (sets.full.has(trackKey(candidate, title))) return true
  }
  // Either side missing an artist falls back to a title comparison.
  return sets.titleOnly.has(trackTitleKey(title))
}

/** The keys a track should be filed under when adding it to an index. */
export function trackKeysFor(artist: string, title: string): string[] {
  return artistVariants(artist).map((candidate) => trackKey(candidate, title))
}

/**
 * Build an extended-M3U playlist (the universal format MP3 players and
 * iPods-via-iTunes understand). fileName entries are relative — the audio is
 * expected to sit alongside the .m3u8 file.
 */
export function buildM3U(
  entries: { duration: number; artist: string; title: string; fileName: string }[]
): string {
  const lines = ['#EXTM3U']
  for (const e of entries) {
    lines.push(`#EXTINF:${Math.round(e.duration) || 0},${e.artist} - ${e.title}`)
    lines.push(e.fileName)
  }
  return lines.join('\n') + '\n'
}

// --- Storage cap math -------------------------------------------------------

/**
 * Average encoded bytes per second of audio, per format. Used only to *estimate*
 * a download before it starts; the real size is checked again on disk as each
 * file lands, so an optimistic estimate can never overflow a device.
 *
 * mp3 = 320kbps CBR, opus ~160kbps VBR, flac ~900kbps for typical 44.1/16 music.
 */
const BYTES_PER_SECOND: Record<AudioFormat, number> = {
  mp3: 40_000,
  opus: 20_000,
  flac: 112_500
}

/** Estimated on-disk size of a set of tracks. Tracks with unknown duration count as 4 min. */
export function estimateBytes(
  tracks: { duration: number }[],
  format: AudioFormat = 'mp3'
): number {
  const rate = BYTES_PER_SECOND[format]
  return tracks.reduce((sum, t) => sum + (t.duration > 0 ? t.duration : 240) * rate, 0)
}

export interface CapCheck {
  fits: boolean
  freeBytes: number
  /** Bytes over the cap. 0 when it fits. */
  shortfallBytes: number
}

/** Does `incomingBytes` fit in what's left of the device's cap? */
export function checkCap(
  usedBytes: number,
  capacityBytes: number,
  incomingBytes: number
): CapCheck {
  const freeBytes = Math.max(0, capacityBytes - usedBytes)
  const shortfallBytes = Math.max(0, incomingBytes - freeBytes)
  return { fits: shortfallBytes === 0, freeBytes, shortfallBytes }
}
