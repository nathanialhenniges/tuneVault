import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../shared/models'
import { DEFAULT_SETTINGS } from '../../shared/models'

export class SettingsService {
  private static getFilePath(): string {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    return join(userDataPath, 'settings.json')
  }

  private static getDefaults(): AppSettings {
    return {
      ...DEFAULT_SETTINGS,
      musicDir: join(app.getPath('music'), 'TuneVault')
    }
  }

  static load(): AppSettings {
    const filePath = this.getFilePath()
    const defaults = this.getDefaults()

    if (!existsSync(filePath)) {
      // Try .tmp fallback
      const tmpPath = filePath + '.tmp'
      if (existsSync(tmpPath)) {
        try {
          const raw = readFileSync(tmpPath, 'utf-8')
          const stored = JSON.parse(raw) as Partial<AppSettings>
          try { renameSync(tmpPath, filePath) } catch { /* best effort */ }
          return { ...defaults, ...stored }
        } catch { /* fall through */ }
      }
      return defaults
    }

    try {
      const raw = readFileSync(filePath, 'utf-8')
      const stored = JSON.parse(raw) as Partial<AppSettings>
      return { ...defaults, ...stored }
    } catch {
      // Main file corrupted, try .tmp fallback
      const tmpPath = filePath + '.tmp'
      if (existsSync(tmpPath)) {
        try {
          const raw = readFileSync(tmpPath, 'utf-8')
          const stored = JSON.parse(raw) as Partial<AppSettings>
          try { renameSync(tmpPath, filePath) } catch { /* best effort */ }
          return { ...defaults, ...stored }
        } catch { /* fall through */ }
      }
      return defaults
    }
  }

  static save(partial: Partial<AppSettings>): void {
    const current = this.load()
    const merged = { ...current, ...partial }
    const filePath = this.getFilePath()
    const tmpPath = filePath + '.tmp'
    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, filePath)
  }
}
