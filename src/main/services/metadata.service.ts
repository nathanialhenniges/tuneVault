import https from 'https'

const USER_AGENT = 'TuneVault/3.0 (19924836+nathanialhenniges@users.noreply.github.com)'

// MusicBrainz asks for no more than one request per second per client. The queue
// lives in the service (not the caller) so no code path can forget it.
const MIN_GAP_MS = 1100
let chain: Promise<unknown> = Promise.resolve()

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const result = await fn()
    await new Promise((r) => setTimeout(r, MIN_GAP_MS))
    return result
  })
  chain = run.catch(() => undefined)
  return run as Promise<T>
}

interface MbTag {
  name?: string
  count?: number
}

export interface TrackMetadata {
  genre: string | null
  /**
   * Cover art candidates, best first. It is a list because the Cover Art
   * Archive happily hands out a URL for a release that has no artwork, which
   * then 404s — so callers try each in turn via `fetchFirstImage`.
   */
  coverUrls: string[]
  /** Artist as MusicBrainz/iTunes spells it — better than a YouTube channel name. */
  artist: string | null
  album: string | null
  /** Four-digit release year. */
  year: string | null
}

const EMPTY: TrackMetadata = { genre: null, coverUrls: [], artist: null, album: null, year: null }

function getJson(url: string): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => (data += chunk.toString()))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(8000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

/** Follows redirects — the Cover Art Archive always 307s to an archive.org host. */
function getBuffer(url: string, redirectsLeft = 5): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume()
        resolve(getBuffer(new URL(res.headers.location, url).toString(), redirectsLeft - 1))
        return
      }
      if (status !== 200) {
        res.resume()
        resolve(null)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', () => resolve(null))
    req.setTimeout(15000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

const searchUrl = (q: string): string =>
  `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=1`

const titleCase = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Best-effort track metadata, all keyless:
 *   MusicBrainz recording search  → genre/tags, album, year, corrected artist
 *   Cover Art Archive             → front cover for that release
 *   iTunes Search API             → fills whatever the first two missed
 *
 * MusicBrainz genre and art coverage is thin for electronic/indie material, and
 * iTunes is generous and almost always has high-res art, hence the fallback.
 * Everything degrades to null rather than throwing — bad metadata must never
 * fail a download.
 */
export class MetadataService {
  static async lookup(artist: string, title: string): Promise<TrackMetadata> {
    if (!title.trim()) return EMPTY
    try {
      return await this.lookupUnsafe(artist, title)
    } catch {
      return EMPTY
    }
  }

  private static async lookupUnsafe(artist: string, title: string): Promise<TrackMetadata> {
    const usable = !!artist?.trim() && artist.trim().toLowerCase() !== 'unknown artist'

    let search = await throttle(() =>
      getJson(searchUrl(usable ? `recording:"${title}" AND artist:"${artist}"` : `recording:"${title}"`))
    )
    let recordings = search?.recordings as Array<Record<string, unknown>> | undefined
    if (!recordings?.length && usable) {
      // Scoped search came up empty — retry by title only.
      search = await throttle(() => getJson(searchUrl(`recording:"${title}"`)))
      recordings = search?.recordings as Array<Record<string, unknown>> | undefined
    }

    const rec0 = recordings?.[0]
    let out: TrackMetadata = { ...EMPTY }

    if (rec0?.id) {
      const release = (rec0.releases as Array<Record<string, unknown>> | undefined)?.[0]
      const releaseId = release?.id as string | undefined
      if (releaseId) out.coverUrls.push(`https://coverartarchive.org/release/${releaseId}/front-500`)
      out.album = typeof release?.title === 'string' ? release.title : null

      const date = (release?.date ?? rec0['first-release-date']) as string | undefined
      out.year = typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null

      const credit = rec0['artist-credit'] as Array<{ name?: string }> | undefined
      out.artist = credit?.map((c) => c.name).filter(Boolean).join(', ') || null

      const detail = await throttle(() =>
        getJson(`https://musicbrainz.org/ws/2/recording/${rec0.id}?fmt=json&inc=genres+tags`)
      )
      const top = (arr: unknown): string | null => {
        if (!Array.isArray(arr) || !arr.length) return null
        const sorted = (arr as MbTag[]).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        return sorted[0]?.name ?? null
      }
      const tag = top(detail?.genres) || top(detail?.tags)
      out.genre = tag ? titleCase(tag) : null
    }

    // Always ask iTunes as well: its art is a live fallback for a dead Cover Art
    // Archive link, and it fills any field MusicBrainz left blank.
    const it = await this.lookupItunes(usable ? artist : '', title)
    if (it) {
      out = {
        genre: out.genre || it.genre,
        coverUrls: [...out.coverUrls, ...it.coverUrls],
        artist: out.artist || it.artist,
        album: out.album || it.album,
        year: out.year || it.year
      }
    }
    return out
  }

  /** iTunes Search API. No key. Top song match's genre, album, year and 600px art. */
  private static async lookupItunes(artist: string, title: string): Promise<TrackMetadata | null> {
    const term = [artist, title].filter(Boolean).join(' ').trim()
    if (!term) return null
    const json = await getJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`
    )
    const r = (json?.results as Array<Record<string, unknown>> | undefined)?.[0]
    if (!r) return null
    const art100 = typeof r.artworkUrl100 === 'string' ? r.artworkUrl100 : null
    const released = typeof r.releaseDate === 'string' ? r.releaseDate : null
    return {
      genre: typeof r.primaryGenreName === 'string' ? r.primaryGenreName : null,
      coverUrls: art100 ? [art100.replace(/100x100(bb)?\.(jpg|png)/, '600x600$1.$2')] : [],
      artist: typeof r.artistName === 'string' ? r.artistName : null,
      album: typeof r.collectionName === 'string' ? r.collectionName : null,
      year: released && /^\d{4}/.test(released) ? released.slice(0, 4) : null
    }
  }

  /**
   * Download the first candidate that actually resolves to an image. Returns
   * null when none do — cover art is optional and must never fail a download.
   */
  static async fetchFirstImage(urls: (string | undefined | null)[]): Promise<Buffer | null> {
    for (const url of urls) {
      if (!url) continue
      const bytes = await getBuffer(url)
      if (bytes?.length) return bytes
    }
    return null
  }
}
