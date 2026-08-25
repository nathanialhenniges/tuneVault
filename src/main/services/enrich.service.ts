import { extname } from 'path'
import type { DeviceFile } from '../../shared/models'
import { DeviceService } from './device.service'
import { MetadataService } from './metadata.service'
import { TagService } from './tag.service'

export interface EnrichProgress {
  done: number
  total: number
  /** File currently being worked on. */
  name: string
  filled: number
}

export interface EnrichSummary {
  scanned: number
  filled: number
  cancelled: boolean
}

const controllers = new Map<string, AbortController>()

/** Only MP3 carries ID3; the other containers are left as yt-dlp wrote them. */
function taggable(file: DeviceFile): boolean {
  return extname(file.path).toLowerCase() === '.mp3'
}

/**
 * Fill in metadata that files on a device are missing.
 *
 * Two things create gaps. Imported files are copied byte-for-byte, so they
 * arrive with whatever the original had — often no genre, year or cover art.
 * And downloads only looked things up when the source had not already supplied
 * a genre and album, which quietly skipped year and artwork too.
 *
 * Only missing fields are written; anything the file already says about itself
 * is left alone.
 */
export class EnrichService {
  static cancel(deviceId: string): void {
    controllers.get(deviceId)?.abort()
  }

  static async run(
    deviceId: string,
    onProgress: (progress: EnrichProgress) => void
  ): Promise<EnrichSummary> {
    const controller = new AbortController()
    controllers.set(deviceId, controller)
    const { signal } = controller

    try {
      const files = (await DeviceService.tracks(deviceId)).filter(taggable)
      // Skip anything already complete, so a second run costs almost nothing.
      const candidates = files.filter(
        (f) => !f.tags || !f.tags.genre || !f.tags.album || !f.tags.year || !f.tags.hasArtwork
      )

      let done = 0
      let filled = 0
      for (const file of candidates) {
        if (signal.aborted) break
        onProgress({ done, total: candidates.length, name: file.name, filled })

        const written = await TagService.fillMissing(
          file.path,
          (artist, title) => MetadataService.lookup(artist, title),
          (urls) => MetadataService.fetchFirstImage(urls)
        ).catch(() => null)

        if (written?.length) filled++
        done++
      }

      onProgress({ done, total: candidates.length, name: '', filled })
      return { scanned: candidates.length, filled, cancelled: signal.aborted }
    } finally {
      controllers.delete(deviceId)
    }
  }
}
