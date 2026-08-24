import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { basename, extname, join, resolve, sep } from 'path'
import { shell } from 'electron'
import type { Device, DeviceFile, DeviceUsage } from '../../shared/models'
import { TagService } from './tag.service'
import { parseTrackFileName, sanitizeFilename, trackKey } from '../../shared/utils'
import { SettingsService } from './settings.service'

const AUDIO_EXT = new Set(['.mp3', '.flac', '.opus', '.m4a', '.ogg', '.wav', '.aac', '.aiff', '.m4b'])

/** Where hand-dropped files land, so they stay separate from downloaded playlists. */
const IMPORT_FOLDER = 'Imported'

/**
 * Tags keyed by path, invalidated by mtime and size. Re-listing a device is a
 * common action and the tags cannot change unless the file does.
 */
const tagCache = new Map<string, { mtimeMs: number; size: number; tags: DeviceFile['tags'] }>()

export interface ImportResult {
  copied: number
  /** Already present with identical size. */
  skipped: number
  /** Not an audio file. */
  rejected: number
  /** Would have exceeded the device's storage limit. */
  refused: number
  errors: { name: string; message: string }[]
}

async function readTagsCached(
  path: string,
  size: number,
  mtimeMs: number
): Promise<DeviceFile['tags']> {
  const hit = tagCache.get(path)
  if (hit && hit.size === size && hit.mtimeMs === mtimeMs) return hit.tags

  const read = await TagService.read(path)
  const tags = read
    ? {
        title: read.title,
        artist: read.artist,
        album: read.album,
        genre: read.genre,
        year: read.year,
        trackNumber: read.trackNumber,
        hasArtwork: read.hasArtwork
      }
    : undefined
  tagCache.set(path, { mtimeMs, size, tags })
  return tags
}

/**
 * Pick a free filename in `dir`. Returns null when a byte-identical file is
 * already there, so re-dropping the same folder is a no-op instead of a pile of
 * " (2)" duplicates.
 */
async function uniquePath(dir: string, name: string): Promise<string | null> {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  for (let n = 1; n < 100; n++) {
    const candidate = join(dir, n === 1 ? name : `${stem} (${n})${ext}`)
    const existing = await fs.stat(candidate).catch(() => null)
    if (!existing) return candidate
  }
  return null
}

/**
 * Guard against a device name (or a hand-edited settings.json) escaping the
 * music root via `..` or an absolute path. Every filesystem operation in this
 * service goes through here first.
 */
function assertInside(root: string, candidate: string): string {
  const r = resolve(root)
  const c = resolve(candidate)
  if (c !== r && !c.startsWith(r + sep)) {
    throw new Error(`Refusing to touch "${candidate}" — it is outside the music folder.`)
  }
  return c
}

async function walk(dir: string): Promise<{ path: string; size: number; mtimeMs: number }[]> {
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return [] // folder deleted out from under us — treat as empty, not an error
  }
  const out: { path: string; size: number; mtimeMs: number }[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.art') continue // cached artwork isn't user music
      out.push(...(await walk(full)))
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.')
      if (dot < 0 || !AUDIO_EXT.has(entry.name.slice(dot).toLowerCase())) continue
      try {
        const st = await fs.stat(full)
        out.push({ path: full, size: st.size, mtimeMs: st.mtimeMs })
      } catch {
        /* vanished between readdir and stat */
      }
    }
  }
  return out
}

export class DeviceService {
  static list(): Device[] {
    return SettingsService.load().devices
  }

  static get(id: string): Device {
    const device = this.list().find((d) => d.id === id)
    if (!device) throw new Error(`No device with id ${id}`)
    return device
  }

  static async create(name: string, capacityBytes: number): Promise<Device> {
    const clean = sanitizeFilename(name)
    if (!clean) throw new Error('Device name cannot be empty.')
    if (!(capacityBytes > 0)) throw new Error('Storage limit must be greater than zero.')

    const settings = SettingsService.load()
    if (settings.devices.some((d) => d.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error(`A device called "${clean}" already exists.`)
    }

    const dir = assertInside(settings.musicRoot, join(settings.musicRoot, clean))
    await fs.mkdir(dir, { recursive: true })

    const device: Device = {
      id: randomUUID(),
      name: clean,
      dir,
      capacityBytes,
      createdAt: new Date().toISOString()
    }
    SettingsService.save({ devices: [...settings.devices, device] })
    return device
  }

  /** Rename and/or re-cap. Renaming moves the folder so the two never drift apart. */
  static async update(
    id: string,
    patch: { name?: string; capacityBytes?: number }
  ): Promise<Device> {
    const settings = SettingsService.load()
    const device = this.get(id)
    let { name, dir } = device

    if (patch.name !== undefined) {
      const clean = sanitizeFilename(patch.name)
      if (!clean) throw new Error('Device name cannot be empty.')
      if (
        settings.devices.some(
          (d) => d.id !== id && d.name.toLowerCase() === clean.toLowerCase()
        )
      ) {
        throw new Error(`A device called "${clean}" already exists.`)
      }
      if (clean !== name) {
        const nextDir = assertInside(settings.musicRoot, join(settings.musicRoot, clean))
        await fs.mkdir(settings.musicRoot, { recursive: true })
        try {
          await fs.rename(dir, nextDir)
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code
          if (code !== 'ENOENT') throw err
          await fs.mkdir(nextDir, { recursive: true }) // folder was gone; just recreate it
        }
        name = clean
        dir = nextDir
      }
    }

    if (patch.capacityBytes !== undefined) {
      if (!(patch.capacityBytes > 0)) throw new Error('Storage limit must be greater than zero.')
    }

    const updated: Device = {
      ...device,
      name,
      dir,
      capacityBytes: patch.capacityBytes ?? device.capacityBytes
    }
    SettingsService.save({
      devices: settings.devices.map((d) => (d.id === id ? updated : d))
    })
    return updated
  }

  /**
   * Forget a device. `deleteFiles` also removes its folder — the UI gates that
   * behind a type-the-name confirmation, it never happens silently.
   */
  static async remove(id: string, opts: { deleteFiles?: boolean } = {}): Promise<void> {
    const settings = SettingsService.load()
    const device = this.get(id)
    if (opts.deleteFiles) {
      const dir = assertInside(settings.musicRoot, device.dir)
      // Trash, not rm -rf: this is a whole music folder, and it must be
      // recoverable if the user picked the wrong device.
      await shell.trashItem(dir).catch(async () => {
        await fs.rm(dir, { recursive: true, force: true })
      })
    }
    SettingsService.save({ devices: settings.devices.filter((d) => d.id !== id) })
  }

  /** Real on-disk usage. The folder is the source of truth, not a cached count. */
  static async usage(id: string): Promise<DeviceUsage> {
    const device = this.get(id)
    const files = await walk(device.dir)
    return {
      deviceId: id,
      usedBytes: files.reduce((sum, f) => sum + f.size, 0),
      capacityBytes: device.capacityBytes,
      trackCount: files.length
    }
  }

  /**
   * Every audio file on the device, with the metadata read back out of the file
   * itself rather than guessed from its name.
   */
  static async tracks(id: string): Promise<DeviceFile[]> {
    const device = this.get(id)
    const files = await walk(device.dir)

    return Promise.all(
      files.map(async (f) => {
        const rel = f.path.slice(device.dir.length + 1)
        const cut = rel.lastIndexOf(sep)
        return {
          path: f.path,
          name: cut < 0 ? rel : rel.slice(cut + 1),
          folder: cut < 0 ? '' : rel.slice(0, cut),
          size: f.size,
          tags: await readTagsCached(f.path, f.size, f.mtimeMs)
        }
      })
    )
  }

  /**
   * Identities of every song already on the device, across all its playlist
   * folders. Built from filenames rather than tags: our own downloads are named
   * "NN - Artist - Title", so this needs no file reads at all.
   */
  static async existingTrackKeys(id: string): Promise<Set<string>> {
    const device = this.get(id)
    const files = await walk(device.dir)
    const keys = new Set<string>()
    for (const f of files) {
      const name = f.path.slice(f.path.lastIndexOf(sep) + 1)
      const parsed = parseTrackFileName(name)
      if (parsed.artist) keys.add(trackKey(parsed.artist, parsed.title))
    }
    return keys
  }

  /**
   * Move tracks to the Trash rather than unlinking them. Deletion stays
   * undoable from Finder, which is both the macOS convention and the reason
   * this action does not need a confirmation sheet in front of it.
   */
  static async deleteTracks(id: string, paths: string[]): Promise<number> {
    const device = this.get(id)
    let deleted = 0
    for (const p of paths) {
      const safe = assertInside(device.dir, p)
      try {
        await shell.trashItem(safe)
        deleted++
      } catch {
        /* already gone, or Trash unavailable on this volume */
      }
    }
    return deleted
  }

  /** Reveal one file in Finder with it selected. */
  static async revealTrack(id: string, path: string): Promise<void> {
    const device = this.get(id)
    shell.showItemInFolder(assertInside(device.dir, path))
  }

  /**
   * Copy local audio files into the device, honouring the storage cap. Used by
   * the drag-and-drop target and the "Add files" picker.
   *
   * Files are copied, never moved — the originals stay where they are. A name
   * that already exists gets a " (2)" suffix rather than overwriting.
   */
  static async importFiles(id: string, paths: string[]): Promise<ImportResult> {
    const device = this.get(id)
    const target = assertInside(device.dir, join(device.dir, IMPORT_FOLDER))
    await fs.mkdir(target, { recursive: true })

    const result: ImportResult = { copied: 0, skipped: 0, rejected: 0, refused: 0, errors: [] }
    let used = (await this.usage(id)).usedBytes

    // Importing obeys the same duplicate rule as downloading.
    const { allowDuplicates } = SettingsService.load()
    const seen = allowDuplicates ? new Set<string>() : await this.existingTrackKeys(id)

    for (const source of paths) {
      const name = basename(source)
      if (!AUDIO_EXT.has(extname(name).toLowerCase())) {
        result.rejected++
        continue
      }

      let size: number
      try {
        const stat = await fs.stat(source)
        if (!stat.isFile()) {
          result.rejected++
          continue
        }
        size = stat.size
      } catch {
        result.errors.push({ name, message: 'Could not read the file.' })
        continue
      }

      // Same hard cap the downloader obeys — importing must not be a way around it.
      if (used + size > device.capacityBytes) {
        result.refused++
        continue
      }

      const parsed = parseTrackFileName(name)
      const key = parsed.artist ? trackKey(parsed.artist, parsed.title) : null
      if (!allowDuplicates && key && seen.has(key)) {
        result.skipped++
        continue
      }

      const dest = await uniquePath(target, name)
      if (!dest) {
        result.skipped++
        continue
      }
      try {
        await fs.copyFile(source, dest)
        used += size
        if (key) seen.add(key)
        result.copied++
      } catch (err) {
        result.errors.push({ name, message: (err as Error).message })
      }
    }
    return result
  }

  static async openFolder(id: string): Promise<void> {
    const device = this.get(id)
    await fs.mkdir(device.dir, { recursive: true }) // opening a deleted folder should just work
    const err = await shell.openPath(device.dir)
    if (err) throw new Error(err)
  }
}
