import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../shared/models'
import { DEFAULT_SETTINGS } from '../../shared/models'

export class SettingsService {
  private static getFilePath(): string {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    return join(userDataPath, 'settings.json')
  }

  static load(): AppSettings {
    const filePath = this.getFilePath()
    if (!existsSync(filePath)) {
      // Set default music dir
      const defaultSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        musicDir: join(app.getPath('music'), 'TuneVault')
      }
      return defaultSettings
    }
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const stored = JSON.parse(raw) as Partial<AppSettings>
      return {
        ...DEFAULT_SETTINGS,
        musicDir: join(app.getPath('music'), 'TuneVault'),
        ...stored
      }
    } catch {
      return { ...DEFAULT_SETTINGS, musicDir: join(app.getPath('music'), 'TuneVault') }
    }
  }

  static save(partial: Partial<AppSettings>): void {
    const current = this.load()
    const merged = { ...current, ...partial }
    writeFileSync(this.getFilePath(), JSON.stringify(merged, null, 2), 'utf-8')
  }
}
