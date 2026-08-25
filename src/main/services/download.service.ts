import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  AudioFormat,
  DownloadProgress,
  DownloadRequest,
  RunStatus,
  Track
} from '../../shared/models'
import {
  buildM3U,
  checkCap,
  estimateBytes,
  formatBytes,
  hasUsableArtist,
  isRateLimitMessage,
  isAlreadyPresent,
  sanitizeFilename,
  toTrackIndexSets,
  trackFileBaseName,
  trackKeysFor,
  trackTitleKey
} from '../../shared/utils'
import { BinaryService } from './binary.service'
import { cookieArgs } from './cookies.service'
import { DeviceService } from './device.service'
import { searchOne } from './resolve/youtube'
import { flush as flushSearchCache } from './search-cache.service'
import { MetadataService } from './metadata.service'
import { SettingsService } from './settings.service'
import { TagService } from './tag.service'

const binary = new BinaryService()

/** Marker prefix so we can pick our progress lines out of yt-dlp's chatter. */
const PROGRESS_MARK = '[TV]'
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000]

/*
 * Bulk imports are worked through in batches with a cooldown between them.
 *
 * A library import can ask for thousands of tracks, and a long unbroken run of
 * requests is what earns a rate limit. Pausing between batches keeps the
 * average rate low without making small playlists wait for nothing — a run
 * shorter than one batch never pauses at all.
 * ponytail: fixed sizes. If imports are throttled anyway, raise the pause
 * before lowering the batch.
 */
const BATCH_SIZE = 25
const BATCH_PAUSE_MS = 20_000

export interface RunSummary {
  runId: string
  completed: number
  skipped: number
  failed: number
  cancelled: boolean
  /** Per-track failure reasons, for the UI to show after the run. */
  errors: { title: string; message: string }[]
}

type Emit = (progress: DownloadProgress) => void
type EmitStatus = (status: RunStatus) => void

const runs = new Map<string, AbortController>()

function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5))
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('cancelled'))
      },
      { once: true }
    )
  })

/**
 * Run yt-dlp for one track, streaming percentages back through `onPercent`.
 *
 * Progress comes from `--progress-template`, not from regex-scraping yt-dlp's
 * human-readable output like the 2.x app did — the template is a documented,
 * stable contract.
 */
function runYtdlp(
  args: string[],
  signal: AbortSignal,
  onPercent: (percent: number, detail: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('cancelled'))
    const proc = spawn(binary.getYtdlpPath(), args)
    let stderr = ''
    let settled = false

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      fn()
    }
    // The 2.x version rejected on abort without checking whether the promise had
    // already settled, which raced with a process that exited on its own.
    function onAbort(): void {
      proc.kill('SIGKILL')
      finish(() => reject(new Error('cancelled')))
    }
    signal.addEventListener('abort', onAbort, { once: true })

    proc.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        const at = line.indexOf(PROGRESS_MARK)
        if (at < 0) continue
        const [percentRaw, speed, eta] = line.slice(at + PROGRESS_MARK.length).split('|')
        const percent = parseFloat((percentRaw || '').replace('%', '').trim())
        if (Number.isFinite(percent)) {
          const detail = [speed?.trim(), eta?.trim() && `ETA ${eta.trim()}`]
            .filter(Boolean)
            .join(' · ')
          onPercent(percent, detail)
        }
      }
    })
    proc.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))

    proc.on('error', (err) =>
      finish(() => reject(new Error(`Failed to run yt-dlp: ${err.message}`)))
    )
    proc.on('close', (code) =>
      finish(() =>
        code === 0 ? resolve() : reject(new Error(stderr.trim() || `yt-dlp exited with ${code}`))
      )
    )
  })
}

/** Leftovers yt-dlp drops next to the audio when a conversion is interrupted. */
async function sweepTemp(dir: string, base: string): Promise<void> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (!name.startsWith(base)) continue
    if (!/\.(part|ytdl|webm|m4a|jpg|png|webp|temp)$/i.test(name)) continue
    await fs.rm(join(dir, name), { force: true }).catch(() => undefined)
  }
}

export class DownloadService {
  static cancel(runId: string): void {
    runs.get(runId)?.abort()
  }

  static cancelAll(): void {
    for (const controller of runs.values()) controller.abort()
  }

  /**
   * Preflight: what this playlist would cost against the device's cap. The
   * renderer calls this to decide whether to enable the Download button.
   */
  static async preflight(
    deviceId: string,
    tracks: Track[]
  ): Promise<{
    usedBytes: number
    capacityBytes: number
    freeBytes: number
    incomingBytes: number
    shortfallBytes: number
    fits: boolean
  }> {
    const { audioFormat } = SettingsService.load()
    const usage = await DeviceService.usage(deviceId)
    const incomingBytes = estimateBytes(tracks, audioFormat)
    const cap = checkCap(usage.usedBytes, usage.capacityBytes, incomingBytes)
    return {
      usedBytes: usage.usedBytes,
      capacityBytes: usage.capacityBytes,
      freeBytes: cap.freeBytes,
      incomingBytes,
      shortfallBytes: cap.shortfallBytes,
      fits: cap.fits
    }
  }

  static async start(
    request: DownloadRequest,
    emit: Emit,
    emitStatus: EmitStatus = () => {}
  ): Promise<RunSummary> {
    const settings = SettingsService.load()
    const format: AudioFormat = settings.audioFormat
    const device = DeviceService.get(request.deviceId)

    const wanted = new Set(request.trackIds)
    const tracks = request.playlist.tracks.filter((t) => wanted.has(t.id))

    const runId = randomUUID()
    const controller = new AbortController()
    runs.set(runId, controller)
    const { signal } = controller

    const folder = join(device.dir, sanitizeFilename(request.playlist.title) || 'Playlist')
    await fs.mkdir(folder, { recursive: true })

    const summary: RunSummary = {
      runId,
      completed: 0,
      skipped: 0,
      failed: 0,
      cancelled: false,
      errors: []
    }

    /**
     * Songs already on this device, in any playlist folder. Two playlists that
     * share a track download it once by default — the device is a fixed size,
     * and a second copy costs space for nothing.
     *
     * Mutated as the run proceeds so a playlist containing the same song twice
     * also only fetches it once.
     */
    const seen = toTrackIndexSets(
      settings.allowDuplicates
        ? { full: [], titleOnly: [] }
        : await DeviceService.existingTrackIndex(device.id)
    )
    const done: { track: Track; fileName: string }[] = []

    let next = 0
    let batchEnd = 0
    const worker = async (): Promise<void> => {
      while (next < batchEnd && !signal.aborted) {
        const track = tracks[next++]
        const base = trackFileBaseName(track)
        // A local file is copied as-is, so it keeps its own container.
        const extension = track.localPath
          ? (track.localPath.slice(track.localPath.lastIndexOf('.') + 1) || format)
          : format
        const fileName = `${base}.${extension}`
        const filePath = join(folder, fileName)
        const report = (
          status: DownloadProgress['status'],
          percent: number,
          detail?: string
        ): void => emit({ jobId: runId, trackId: track.id, status, percent, detail })

        try {
          if (!request.forceRedownload) {
            const existing = await fs.stat(filePath).catch(() => null)
            if (existing?.isFile() && existing.size > 0) {
              summary.skipped++
              done.push({ track, fileName })
              report('skipped', 100, 'Already downloaded')
              continue
            }
            // Same song, different playlist folder on this device — matched on
            // tags, so a hand-dropped file counts too.
            if (!settings.allowDuplicates && isAlreadyPresent(seen, track.artist, track.title)) {
              summary.skipped++
              report('skipped', 100, 'Already on this device')
              continue
            }
          }

          // Re-check the cap per track against what is actually on disk. This,
          // not the preflight estimate, is what guarantees the limit holds.
          const usage = await DeviceService.usage(device.id)
          if (usage.usedBytes >= usage.capacityBytes) {
            const message = `Device is full (${formatBytes(usage.usedBytes)} of ${formatBytes(
              usage.capacityBytes
            )}).`
            summary.failed++
            summary.errors.push({ title: track.title, message })
            report('error', 0, message)
            controller.abort() // genuinely out of room; nothing else will fit
            break
          }

          // Would this track take it over? Checked before writing, so the cap
          // holds rather than being noticed one file too late. Skipped rather
          // than fatal: a shorter track later in the run may still fit.
          if (!request.ignoreEstimate) {
            const projected = usage.usedBytes + estimateBytes([track], format)
            if (projected > usage.capacityBytes) {
              const message = `Would exceed the ${formatBytes(usage.capacityBytes)} limit.`
              summary.skipped++
              report('skipped', 0, message)
              continue
            }
          }

          // Music app tracks arrive without a source URL: matching every track
          // in a library just to draw a preview would take hours, so it happens
          // here, for the tracks actually chosen.
          if (track.needsMatch && !track.sourceUrl) {
            report('downloading', 0, 'Finding a match…')
            const hit = await searchOne(
              `${track.artist} ${track.title}`,
              trackKeysFor(track.artist, track.title)[0] ?? trackTitleKey(track.title)
            )
            if (!hit) {
              const message = 'No match found on YouTube or SoundCloud.'
              summary.failed++
              summary.errors.push({ title: track.title, message })
              report('error', 0, message)
              continue
            }
            track.sourceUrl = hit.sourceUrl
            track.source = hit.source
            if (!track.thumbnail) track.thumbnail = hit.thumbnail
          }

          report('downloading', 0)
          if (track.localPath) {
            // Already on this Mac: copy it rather than re-downloading a worse
            // copy of a file the user already owns.
            await fs.copyFile(track.localPath, filePath)
            report('downloading', 100)
          } else {
            await this.downloadOne(track, filePath, base, format, signal, (percent, detail) =>
              report('downloading', percent, detail)
            )
          }

          report('tagging', 99)
          if (!track.localPath) {
            await this.tagOne(
              track,
              filePath,
              folder,
              format,
              tracks.length,
              settings.metadataEnrichment
            )
          }

          summary.completed++
          if (hasUsableArtist(track.artist)) {
            for (const k of trackKeysFor(track.artist, track.title)) seen.full.add(k)
          } else {
            seen.titleOnly.add(trackTitleKey(track.title))
          }
          done.push({ track, fileName })
          report('complete', 100)
        } catch (err) {
          const message = (err as Error).message
          if (message === 'cancelled' || signal.aborted) {
            report('cancelled', 0)
            await sweepTemp(folder, base)
            break
          }
          summary.failed++
          summary.errors.push({ title: track.title, message })
          report('error', 0, message)
          await sweepTemp(folder, base)
        }
      }
    }

    const batchCount = Math.max(1, Math.ceil(tracks.length / BATCH_SIZE))

    try {
      for (let start = 0; start < tracks.length && !signal.aborted; start += BATCH_SIZE) {
        batchEnd = Math.min(start + BATCH_SIZE, tracks.length)
        const size = batchEnd - start
        const batch = Math.floor(start / BATCH_SIZE) + 1
        emitStatus({ runId, total: tracks.length, batch, batchCount })

        await Promise.all(
          Array.from({ length: Math.min(settings.concurrency, size || 1) }, worker)
        )

        if (tracks.length - batchEnd > 0 && !signal.aborted) {
          // One status event with an end time, not one message per waiting
          // track — a library run would otherwise emit thousands per pause.
          emitStatus({
            runId,
            total: tracks.length,
            batch,
            batchCount,
            cooldownUntil: Date.now() + BATCH_PAUSE_MS
          })
          await sleep(BATCH_PAUSE_MS, signal).catch(() => undefined)
        }
      }
    } finally {
      runs.delete(runId)
      flushSearchCache()
    }

    summary.cancelled = signal.aborted
    if (done.length) await this.writeM3U(folder, request.playlist.title, done)

    // Remember where this came from so the device can be topped up later.
    if (!summary.cancelled && request.playlist.url) {
      DeviceService.rememberSource(device.id, {
        url: request.playlist.url,
        title: request.playlist.title,
        provider: request.playlist.provider,
        trackCount: request.playlist.tracks.length
      })
    }
    return summary
  }

  private static async downloadOne(
    track: Track,
    filePath: string,
    base: string,
    format: AudioFormat,
    signal: AbortSignal,
    onPercent: (percent: number, detail: string) => void
  ): Promise<void> {
    // A crafted sourceUrl could otherwise be read as a flag rather than a
    // target. Validated here and passed after `--` below.
    if (!/^https?:\/\//i.test(track.sourceUrl)) {
      throw new Error(`Refusing to download a non-http(s) source: ${track.sourceUrl}`)
    }

    const args = [
      ...cookieArgs(),
      '-f',
      // Fall back to a muxed stream: some videos expose no audio-only format.
      'bestaudio/best',
      '--extract-audio',
      '--audio-format',
      format,
      '--audio-quality',
      '0',
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '--ffmpeg-location',
      binary.getFfmpegPath(),
      '--progress-template',
      `download:${PROGRESS_MARK}%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s`,
      '-o',
      filePath.replace(new RegExp(`\\.${format}$`), '.%(ext)s'),
      // `--` terminates options; the URL is the only positional argument.
      '--',
      track.sourceUrl
    ]
    // ID3 is MP3-only; for flac/opus let yt-dlp do the tagging since we can't.
    if (!TagService.supports(format)) args.push('--embed-metadata', '--embed-thumbnail')

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        await runYtdlp(args, signal, onPercent)
        await sweepTemp(join(filePath, '..'), base)
        return
      } catch (err) {
        lastError = err as Error
        if (lastError.message === 'cancelled') throw lastError
        if (!isRateLimitMessage(lastError.message) || attempt === RETRY_DELAYS_MS.length) break
        // Backoff with jitter, so a queue of workers doesn't retry in lockstep.
        await sleep(jitter(RETRY_DELAYS_MS[attempt]), signal)
      }
    }
    throw lastError ?? new Error('Download failed')
  }

  private static async tagOne(
    track: Track,
    filePath: string,
    folder: string,
    format: AudioFormat,
    trackTotal: number,
    enrich: boolean
  ): Promise<void> {
    if (!TagService.supports(format)) return

    let genre: string | null = null
    let year: string | null = null
    let album = track.album
    let cover: Buffer | null = null

    // The Music app already told us the genre; no need to ask the internet.
    genre = track.genre ?? null

    if (enrich && !(track.genre && track.album)) {
      const meta = await MetadataService.lookup(track.artist, track.title)
      genre = genre ?? meta.genre
      year = meta.year
      if (meta.album && !track.album) album = meta.album
      // The source thumbnail is the last resort: real cover art beats a video
      // still, but a video still beats no art at all.
      cover = await MetadataService.fetchFirstImage([...meta.coverUrls, track.thumbnail])
      if (cover) await this.cacheArt(folder, track.id, cover)
    } else if (track.thumbnail) {
      cover = await MetadataService.fetchFirstImage([track.thumbnail])
    }

    TagService.write(filePath, {
      title: track.title,
      artist: track.artist,
      album,
      albumArtist: track.artist,
      trackNumber: track.position,
      trackTotal,
      genre,
      year,
      comment: `Downloaded with TuneVault from ${track.sourceUrl}`,
      cover
    })
  }

  /** Keep a copy of the artwork so the UI can show it without re-fetching. */
  private static async cacheArt(folder: string, trackId: string, cover: Buffer): Promise<void> {
    const dir = join(folder, '.art')
    await fs.mkdir(dir, { recursive: true }).catch(() => undefined)
    await fs
      .writeFile(join(dir, `${sanitizeFilename(trackId) || 'art'}.jpg`), cover)
      .catch(() => undefined)
  }

  private static async writeM3U(
    folder: string,
    playlistTitle: string,
    done: { track: Track; fileName: string }[]
  ): Promise<void> {
    const name = `${sanitizeFilename(playlistTitle) || 'Playlist'}.m3u8`
    const body = buildM3U(
      done
        .slice()
        .sort((a, b) => a.track.position - b.track.position)
        .map((d) => ({
          duration: d.track.duration,
          artist: d.track.artist,
          title: d.track.title,
          fileName: d.fileName
        }))
    )
    await fs.writeFile(join(folder, name), body, 'utf-8').catch(() => undefined)
  }
}
