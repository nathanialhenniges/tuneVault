import { describe, it, expect } from 'vitest'
import { buildCookieArgs, type CookieConfig } from './cookies.service'

const config = (over: Partial<CookieConfig> = {}): CookieConfig => ({
  cookieMode: 'off',
  cookieBrowser: 'chrome',
  cookieProfile: '',
  cookieFile: '',
  ...over
})

describe('buildCookieArgs', () => {
  it('passes nothing when cookies are off', () => {
    expect(buildCookieArgs(config())).toEqual([])
  })

  it('reads from a browser with no profile', () => {
    expect(buildCookieArgs(config({ cookieMode: 'browser', cookieBrowser: 'firefox' }))).toEqual([
      '--cookies-from-browser',
      'firefox'
    ])
  })

  it('appends the profile, which is how a second account is selected', () => {
    expect(
      buildCookieArgs(
        config({ cookieMode: 'browser', cookieBrowser: 'chrome', cookieProfile: 'Profile 2' })
      )
    ).toEqual(['--cookies-from-browser', 'chrome:Profile 2'])
  })

  it('ignores a whitespace-only profile rather than emitting a trailing colon', () => {
    expect(
      buildCookieArgs(config({ cookieMode: 'browser', cookieProfile: '   ' }))
    ).toEqual(['--cookies-from-browser', 'chrome'])
  })

  it('falls back to chrome when no browser is set', () => {
    expect(buildCookieArgs(config({ cookieMode: 'browser', cookieBrowser: '' }))).toEqual([
      '--cookies-from-browser',
      'chrome'
    ])
  })

  it('uses a cookie file when one is chosen', () => {
    expect(buildCookieArgs(config({ cookieMode: 'file', cookieFile: '/tmp/c.txt' }))).toEqual([
      '--cookies',
      '/tmp/c.txt'
    ])
  })

  it('stays anonymous in file mode when no file has been chosen', () => {
    expect(buildCookieArgs(config({ cookieMode: 'file' }))).toEqual([])
  })

  it('never emits a bare flag with a missing value', () => {
    for (const mode of ['off', 'browser', 'file'] as const) {
      const args = buildCookieArgs(config({ cookieMode: mode }))
      expect(args.length === 0 || args.length === 2).toBe(true)
    }
  })
})
