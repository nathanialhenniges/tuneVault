import { execFile } from 'child_process'
import type { Provider } from '../../../shared/models'
import { MUSIC_APP_URL_PREFIX, musicAppPlaylistUrl } from '../../../shared/utils'

export interface MusicAppPlaylist {
  id: string
  name: string
  trackCount: number
}

export interface MusicAppTrack {
  name: string
  artist: string
  album: string
  genre: string
  duration: number
  trackNumber: number
  /** Set only for tracks backed by a real file on disk. */
  location: string | null
}

export const MUSIC_APP_PROVIDER: Provider = 'music-app'
const URL_PREFIX = MUSIC_APP_URL_PREFIX

export const musicAppUrl = musicAppPlaylistUrl

export function isMusicAppUrl(url: string): boolean {
  return url.startsWith(URL_PREFIX)
}

export function musicAppPlaylistId(url: string): string | null {
  return isMusicAppUrl(url) ? url.slice(URL_PREFIX.length) || null : null
}

/**
 * Run a JXA script through osascript.
 *
 * Arguments are embedded into the script as JSON rather than passed as argv,
 * because reading the script from stdin and taking argv at the same time is
 * fragile. Everything we embed is a Music app persistent ID.
 */
function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'osascript',
      ['-l', 'JavaScript', '-'],
      { maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        const message = (stderr || error.message).trim()
        // -1743 is the macOS Automation consent refusal.
        if (/-1743|not authori[sz]ed/i.test(message)) {
          reject(
            new Error(
              'macOS blocked TuneVault from controlling the Music app. Allow it in System Settings > Privacy & Security > Automation, then try again.'
            )
          )
          return
        }
        if (/-600|application isn't running/i.test(message)) {
          reject(new Error('The Music app could not be started.'))
          return
        }
        reject(new Error(message || 'The Music app did not respond.'))
      }
    )
    child.stdin?.end(script)
  })
}

/** The whole library, addressed by this reserved id rather than a real one. */
export const LIBRARY_ID = 'library'

const LIST_SCRIPT = `
function run() {
  const Music = Application('Music')
  const out = []

  // The entire library first, so it is reachable without hunting for it.
  try {
    const lib = Music.libraryPlaylists[0]
    out.push({ id: ${JSON.stringify(LIBRARY_ID)}, name: 'Entire library', trackCount: lib.tracks().length })
  } catch (e) {}

  const pls = Music.userPlaylists
  const names = pls.name()
  const ids = pls.persistentID()
  const kinds = pls.specialKind()
  for (let i = 0; i < names.length; i++) {
    // Skip the built-in library playlist; it is already listed above.
    if (String(kinds[i]) === 'Music') continue
    let count = 0
    try { count = pls[i].tracks().length } catch (e) {}
    out.push({ id: ids[i], name: names[i], trackCount: count })
  }
  return JSON.stringify(out)
}
`

export async function listMusicAppPlaylists(): Promise<MusicAppPlaylist[]> {
  if (process.platform !== 'darwin') {
    throw new Error('The Music app is only available on macOS.')
  }
  const raw = await osascript(LIST_SCRIPT)
  try {
    return (JSON.parse(raw) as MusicAppPlaylist[]).filter((p) => p.trackCount > 0)
  } catch {
    throw new Error('Could not read the playlists in the Music app.')
  }
}

/**
 * Read one playlist's tracks.
 *
 * Properties are fetched as bulk arrays (one Apple Event each) rather than
 * per-track, which for a 156-track playlist is the difference between six
 * events and a thousand. `location` is the exception: it throws for Apple Music
 * streaming tracks, so it is only asked for on tracks whose class is fileTrack.
 */
function tracksScript(playlistId: string): string {
  const source =
    playlistId === LIBRARY_ID
      ? `Music.libraryPlaylists[0]`
      : `(Music.userPlaylists.whose({ persistentID: ${JSON.stringify(playlistId)} })[0])`
  return `
function run() {
  const Music = Application('Music')
  const container = ${source}
  if (!container) return JSON.stringify({ error: 'notfound' })
  const tracks = container.tracks
  const bulk = (fn) => { try { return fn() } catch (e) { return null } }

  const names = bulk(() => tracks.name()) || []
  const artists = bulk(() => tracks.artist()) || []
  const albums = bulk(() => tracks.album()) || []
  const genres = bulk(() => tracks.genre()) || []
  const durations = bulk(() => tracks.duration()) || []
  const numbers = bulk(() => tracks.trackNumber()) || []
  const classes = bulk(() => tracks.class()) || []

  const out = []
  for (let i = 0; i < names.length; i++) {
    let location = null
    if (String(classes[i]) === 'fileTrack') {
      try {
        const loc = tracks[i].location()
        if (loc) location = loc.toString()
      } catch (e) {}
    }
    out.push({
      name: names[i] || '',
      artist: artists[i] || '',
      album: albums[i] || '',
      genre: genres[i] || '',
      duration: Math.round(durations[i] || 0),
      trackNumber: numbers[i] || 0,
      location: location
    })
  }
  return JSON.stringify(out)
}
`
}

export async function readMusicAppPlaylist(
  playlistId: string
): Promise<{ tracks: MusicAppTrack[] }> {
  if (process.platform !== 'darwin') {
    throw new Error('The Music app is only available on macOS.')
  }
  const raw = await osascript(tracksScript(playlistId))
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Could not read that playlist from the Music app.')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('That playlist no longer exists in the Music app.')
  }
  const tracks = (parsed as MusicAppTrack[]).filter((t) => t.name)
  if (!tracks.length) throw new Error('That playlist is empty.')
  return { tracks }
}
