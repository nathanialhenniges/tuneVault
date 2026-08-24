import { promises as fs } from 'fs'
import NodeID3 from 'node-id3'
import type { AudioFormat } from '../../shared/models'

export interface TagInput {
  title: string
  artist: string
  album: string
  albumArtist?: string
  trackNumber: number
  trackTotal: number
  genre?: string | null
  year?: string | null
  comment?: string
  /** JPEG/PNG bytes for the embedded front cover. */
  cover?: Buffer | null
}

export interface ReadTags {
  title?: string
  artist?: string
  album?: string
  genre?: string
  year?: string
  trackNumber?: number
  hasArtwork: boolean
}

/**
 * ID3v2 headers are synchsafe: seven data bits per byte, so a size never
 * contains a 0xFF byte that could be mistaken for an MPEG frame sync.
 */
export function decodeSynchsafe(bytes: Buffer): number {
  return (
    ((bytes[0] & 0x7f) << 21) |
    ((bytes[1] & 0x7f) << 14) |
    ((bytes[2] & 0x7f) << 7) |
    (bytes[3] & 0x7f)
  )
}

/**
 * Read just the ID3v2 tag off the front of a file.
 *
 * node-id3 reads the *entire* file into memory when handed a path. Listing a
 * device of 500 tracks that way would pull several gigabytes through memory to
 * look at a few kilobytes of header. The header states its own length, so we
 * read 10 bytes, decode the size, and read exactly that much.
 *
 * Returns null when the file has no ID3v2 tag at all (FLAC, WAV, an untagged
 * MP3), which the caller treats as "fall back to the filename".
 */
async function readTagBuffer(filePath: string): Promise<Buffer | null> {
  let handle: import('fs').promises.FileHandle
  try {
    handle = await fs.open(filePath, 'r')
  } catch {
    return null
  }
  try {
    const header = Buffer.alloc(10)
    const { bytesRead } = await handle.read(header, 0, 10, 0)
    if (bytesRead < 10 || header.toString('latin1', 0, 3) !== 'ID3') return null

    const size = decodeSynchsafe(header.subarray(6, 10))
    if (size <= 0 || size > 64 * 1024 * 1024) return null

    const body = Buffer.alloc(10 + size)
    header.copy(body, 0)
    await handle.read(body, 10, size, 10)
    return body
  } catch {
    return null
  } finally {
    await handle.close().catch(() => undefined)
  }
}

/**
 * Write ID3v2 tags in a single pass.
 *
 * The old app re-muxed the file through ffmpeg once per tag change (three
 * passes during enrichment) and could not embed cover art in Opus at all.
 * node-id3 rewrites the tag frames in place instead — no transcode, no temp
 * file, no quality loss.
 *
 * ID3 is an MP3 thing. For flac/opus we let yt-dlp's own `--embed-metadata
 * --embed-thumbnail` do the tagging at download time and skip this.
 */
export class TagService {
  static supports(format: AudioFormat): boolean {
    return format === 'mp3'
  }

  static write(filePath: string, tags: TagInput): void {
    const payload: NodeID3.Tags = {
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
      performerInfo: tags.albumArtist || tags.artist,
      trackNumber: `${tags.trackNumber}/${tags.trackTotal}`,
      encodedBy: 'TuneVault'
    }
    if (tags.genre) payload.genre = tags.genre
    if (tags.year) payload.year = tags.year
    if (tags.comment) payload.comment = { language: 'eng', text: tags.comment }
    if (tags.cover?.length) {
      payload.image = {
        mime: tags.cover.subarray(0, 4).toString('hex') === '89504e47' ? 'image/png' : 'image/jpeg',
        type: { id: 3, name: 'front cover' },
        description: 'Cover',
        imageBuffer: tags.cover
      }
    }

    const result = NodeID3.update(payload, filePath)
    if (result !== true) {
      throw new Error(`Could not write tags: ${result instanceof Error ? result.message : result}`)
    }
  }

  /** Text tags only — the embedded picture is skipped so listing stays cheap. */
  static async read(filePath: string): Promise<ReadTags | null> {
    const buffer = await readTagBuffer(filePath)
    if (!buffer) return null
    let tags: NodeID3.Tags
    try {
      tags = NodeID3.read(buffer, { noRaw: true, exclude: ['APIC'] })
    } catch {
      return null
    }

    // "3/12" -> 3
    const track = Number.parseInt(String(tags.trackNumber ?? ''), 10)

    return {
      title: tags.title || undefined,
      artist: tags.artist || undefined,
      album: tags.album || undefined,
      genre: tags.genre || undefined,
      year: tags.year || undefined,
      trackNumber: Number.isFinite(track) ? track : undefined,
      // The APIC frame identifier appears in the tag body whenever a picture is
      // embedded; checking for it avoids decoding the image just to know it exists.
      hasArtwork: buffer.includes('APIC', 0, 'latin1')
    }
  }

  /** The embedded front cover, read on demand. */
  static async readArtwork(filePath: string): Promise<{ mime: string; data: Buffer } | null> {
    const buffer = await readTagBuffer(filePath)
    if (!buffer) return null
    try {
      const tags = NodeID3.read(buffer, { noRaw: true, include: ['APIC'] })
      const image = tags.image
      if (!image || typeof image === 'string' || !image.imageBuffer?.length) return null
      return { mime: image.mime || 'image/jpeg', data: image.imageBuffer }
    } catch {
      return null
    }
  }
}
