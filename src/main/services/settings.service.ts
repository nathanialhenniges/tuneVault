import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../shared/models'
import { DEFAULT_SETTINGS } from '../../shared/models'

/**
 * Settings live in a single JSON file in userData, written atomically
 * (tmp + rename) so a crash mid-write can never truncate the real file.
 *
 * Every value is flat or a whole-array replacement (`devices`), so a shallow
 * merge over the defaults is correct. Don't add nested objects without
 * revisiting `save`.
 */
export class SettingsService {
  private static filePath(): string {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    return join(dir, 'settings.json')
  }

  private static defaults(): AppSettings {
    return { ...DEFAULT_SETTINGS, musicRoot: join(app.getPath('music'), 'TuneVault') }
  }

  private static readFrom(path: string): Partial<AppSettings> | null {
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as Partial<AppSettings>
    } catch {
      return null
    }
  }

  static load(): AppSettings {
    const file = this.filePath()
    const tmp = file + '.tmp'
    const defaults = this.defaults()

    const stored = (existsSync(file) && this.readFrom(file)) || null
    if (stored) return this.normalize({ ...defaults, ...stored })

    // Main file missing or corrupt — a tmp file means we crashed mid-write.
    if (existsSync(tmp)) {
      const recovered = this.readFrom(tmp)
      if (recovered) {
        try {
          renameSync(tmp, file)
        } catch {
          /* best effort; we still have the values in memory */
        }
        return this.normalize({ ...defaults, ...recovered })
      }
    }
    return defaults
  }

  static save(partial: Partial<AppSettings>): AppSettings {
    const merged = this.normalize({ ...this.load(), ...partial })
    const file = this.filePath()
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmp, file)
    return merged
  }

  /**
   * Clamp anything a hand-edited settings.json could set to a nonsense value,
   * and drop keys that are not part of the schema.
   *
   * The pruning matters: this file is inherited from 2.x installs, which wrote
   * `musicDir`, `sync`, `theme`, `accent`, `youtubeApiKey` and friends. Spreading
   * the stored object would carry those dead keys forward on every save,
   * forever.
   */
  private static normalize(s: AppSettings): AppSettings {
    return {
      musicRoot: s.musicRoot,
      devices: (s.devices ?? []).filter((d) => d && d.id && d.dir),
      audioFormat: s.audioFormat,
      concurrency: Math.min(8, Math.max(1, Math.round(s.concurrency) || 1)),
      metadataEnrichment: !!s.metadataEnrichment,
      allowDuplicates: !!s.allowDuplicates,
      cookieMode: s.cookieMode === 'browser' || s.cookieMode === 'file' ? s.cookieMode : 'off',
      cookieBrowser: s.cookieBrowser || 'chrome',
      cookieProfile: s.cookieProfile ?? '',
      cookieFile: s.cookieFile ?? '',
      disclaimerAccepted: !!s.disclaimerAccepted
    }
  }
}
