import type { AppSettings } from '../../shared/models'
import { SettingsService } from './settings.service'

/**
 * Builds the yt-dlp arguments for using the user's own cookies.
 *
 * Signing in clears most of YouTube's bot checks, which is the biggest single
 * improvement available on the download side — but cookies are credentials.
 * They are only ever handed to the local yt-dlp process: never logged, never
 * written anywhere by this app, never sent off the machine. Nothing in here
 * reads or parses the cookie values themselves.
 *
 * Browser profiles are how a second account is used: `--cookies-from-browser
 * chrome:Profile 2` reads a different signed-in account than the default
 * profile. An exported cookies.txt covers accounts that are not in a browser
 * on this machine at all.
 */
export interface CookieConfig {
  cookieMode: AppSettings['cookieMode']
  cookieBrowser: string
  cookieProfile: string
  cookieFile: string
}

/** Pure so it can be tested without Electron or a settings file. */
export function buildCookieArgs(config: CookieConfig): string[] {
  const { cookieMode, cookieBrowser, cookieProfile, cookieFile } = config

  if (cookieMode === 'file') {
    // A mode of 'file' with no file chosen must stay anonymous rather than
    // handing yt-dlp an empty path.
    return cookieFile.trim() ? ['--cookies', cookieFile] : []
  }
  if (cookieMode === 'browser') {
    const browser = (cookieBrowser || 'chrome').trim()
    const profile = cookieProfile.trim()
    // yt-dlp's format is BROWSER[+KEYRING][:PROFILE][::CONTAINER].
    return ['--cookies-from-browser', profile ? `${browser}:${profile}` : browser]
  }
  return []
}

export function cookieArgs(): string[] {
  return buildCookieArgs(SettingsService.load())
}

/** Human-readable summary for the UI. Never includes cookie contents. */
export function cookieSummary(): string {
  const { cookieMode, cookieBrowser, cookieProfile, cookieFile } = SettingsService.load()
  if (cookieMode === 'file') return cookieFile ? `cookies.txt (${cookieFile})` : 'no file chosen'
  if (cookieMode === 'browser') {
    return cookieProfile ? `${cookieBrowser}, profile "${cookieProfile}"` : cookieBrowser
  }
  return 'not signed in'
}
