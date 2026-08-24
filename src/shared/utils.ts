import type { AudioFormat } from './models'

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

/** Strips characters that are illegal in filenames on macOS/Windows. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()
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
