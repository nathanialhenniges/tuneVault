import { describe, it, expect } from 'vitest'
import {
  artistVariants,
  isRateLimitMessage,
  hasUsableArtist,
  isAlreadyPresent,
  parseTrackFileName,
  toTrackIndexSets,
  trackKey,
  trackKeysFor,
  trackTitleKey,
  sanitizeFilename,
  trackFileBaseName,
  buildM3U,
  estimateBytes,
  checkCap,
  formatBytes,
  GB
} from './utils'

describe('sanitizeFilename', () => {
  it('strips filesystem-illegal characters', () => {
    expect(sanitizeFilename('AC/DC: Back "In" Black?')).toBe('ACDC Back In Black')
  })
  it('collapses whitespace and trims', () => {
    expect(sanitizeFilename('  a   b  ')).toBe('a b')
  })
})

describe('sanitizeFilename path traversal', () => {
  it('never yields a traversal or hidden entry', () => {
    for (const input of ['..', '.', '../..', '...', './x']) {
      const out = sanitizeFilename(input)
      expect(out.startsWith('.')).toBe(false)
      expect(out).not.toBe('..')
    }
  })
  it('falls back to a usable name when everything is stripped', () => {
    expect(sanitizeFilename('..')).toBe('untitled')
    expect(sanitizeFilename('///')).toBe('untitled')
    expect(sanitizeFilename('   ')).toBe('untitled')
  })
  it('keeps a leading dot out of an otherwise normal name', () => {
    expect(sanitizeFilename('.hidden playlist')).toBe('hidden playlist')
  })
})

describe('isRateLimitMessage', () => {
  it('recognises the ways yt-dlp reports a 429', () => {
    for (const message of [
      'ERROR: HTTP Error 429: Too Many Requests',
      'the server responded with RATE_LIMITED',
      'You have exceeded the rate limit'
    ]) {
      expect(isRateLimitMessage(message)).toBe(true)
    }
  })
  it('does not fire on unrelated failures', () => {
    expect(isRateLimitMessage('ERROR: Video unavailable')).toBe(false)
  })
})

describe('trackFileBaseName', () => {
  it('zero-pads the position', () => {
    expect(trackFileBaseName({ position: 7, artist: 'Muse', title: 'Hysteria' })).toBe(
      '07 - Muse - Hysteria'
    )
  })
  it('does not truncate positions past 99', () => {
    expect(trackFileBaseName({ position: 104, artist: 'A', title: 'B' })).toBe('104 - A - B')
  })
})

describe('parseTrackFileName', () => {
  it('round-trips a name produced by trackFileBaseName', () => {
    const track = { position: 7, artist: 'Muse', title: 'Hysteria' }
    expect(parseTrackFileName(`${trackFileBaseName(track)}.mp3`)).toEqual(track)
  })
  it('keeps a hyphenated title intact', () => {
    expect(parseTrackFileName('03 - Sam Fender - Rein Me In - Live.mp3')).toEqual({
      position: 3,
      artist: 'Sam Fender',
      title: 'Rein Me In - Live'
    })
  })
  it('handles a three-digit position', () => {
    expect(parseTrackFileName('104 - A - B.mp3').position).toBe(104)
  })
  it('falls back to the whole stem for a file the user dropped in', () => {
    expect(parseTrackFileName('my recording.wav')).toEqual({
      position: null,
      artist: null,
      title: 'my recording'
    })
  })
  it('reads a bare "01-name" from a file that came from elsewhere', () => {
    expect(parseTrackFileName('01-alpha-protocol.mp3')).toEqual({
      position: 1,
      artist: null,
      title: 'alpha-protocol'
    })
  })
  it('does not mistake a leading word for a track number', () => {
    expect(parseTrackFileName('Live - Lightning Crashes.mp3')).toEqual({
      position: null,
      artist: 'Live',
      title: 'Lightning Crashes'
    })
  })
  it('leaves a name with no extension alone', () => {
    expect(parseTrackFileName('01 - A - B').title).toBe('B')
  })
})

describe('trackKey', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(trackKey('Tame Impala', 'Loser')).toBe(trackKey('tame  impala', 'LOSER!'))
  })
  it('treats curly quotes and en dashes as their plain equivalents', () => {
    expect(trackKey('Sam Fender', 'Rein Me In \u2013 Live')).toBe(
      trackKey('Sam Fender', "Rein Me In - Live")
    )
  })
  it('keeps different songs by the same artist apart', () => {
    expect(trackKey('Muse', 'Hysteria')).not.toBe(trackKey('Muse', 'Starlight'))
  })
  it('keeps the same title by different artists apart', () => {
    expect(trackKey('Muse', 'Hysteria')).not.toBe(trackKey('Def Leppard', 'Hysteria'))
  })
  it('does not collide across the artist/title boundary', () => {
    expect(trackKey('a b', 'c')).not.toBe(trackKey('a', 'b c'))
  })
})

describe('hasUsableArtist', () => {
  it('rejects the placeholders that mean "we do not know"', () => {
    for (const value of ['', '   ', 'Unknown Artist', 'unknown', 'Various Artists']) {
      expect(hasUsableArtist(value)).toBe(false)
    }
  })
  it('accepts a real name', () => {
    expect(hasUsableArtist('Tame Impala')).toBe(true)
  })
})

describe('isAlreadyPresent', () => {
  const sets = toTrackIndexSets({
    full: [trackKey('Muse', 'Hysteria')],
    titleOnly: [trackTitleKey('alpha-protocol')]
  })

  it('matches on artist and title', () => {
    expect(isAlreadyPresent(sets, 'Muse', 'Hysteria')).toBe(true)
  })
  it('does not match a different song by the same artist', () => {
    expect(isAlreadyPresent(sets, 'Muse', 'Starlight')).toBe(false)
  })
  it('does not match the same title by a different artist', () => {
    expect(isAlreadyPresent(sets, 'Def Leppard', 'Hysteria')).toBe(false)
  })
  it('falls back to the title for a file that had no readable artist', () => {
    // This is the case that used to slip through and re-download every run.
    expect(isAlreadyPresent(sets, 'DevBowser', 'Alpha Protocol')).toBe(true)
  })
  it('matches an incoming track whose artist is a placeholder', () => {
    expect(isAlreadyPresent(sets, 'Unknown Artist', 'alpha protocol')).toBe(true)
  })
  it('reports nothing present for an empty index', () => {
    const empty = toTrackIndexSets({ full: [], titleOnly: [] })
    expect(isAlreadyPresent(empty, 'Muse', 'Hysteria')).toBe(false)
  })
})

describe('artistVariants', () => {
  it('keeps the whole credit and each contributor', () => {
    expect(artistVariants('Avicii, DevBowser')).toEqual(['Avicii, DevBowser', 'Avicii', 'DevBowser'])
  })
  it('splits the usual collaboration markers', () => {
    for (const input of ['A & B', 'A feat. B', 'A ft B', 'A x B', 'A vs. B', 'A with B']) {
      expect(artistVariants(input)).toContain('B')
    }
  })
  it('does not duplicate a single artist', () => {
    expect(artistVariants('Muse')).toEqual(['Muse'])
  })
  it('returns nothing for a placeholder', () => {
    expect(artistVariants('Unknown Artist')).toEqual([])
  })
})

describe('collaboration matching', () => {
  // The real case: the Music app credits the collaboration, the file on disk
  // is tagged with one contributor.
  const sets = toTrackIndexSets({
    full: trackKeysFor('DevBowser', 'The Nights (DevBowser Hardstyle Remix)'),
    titleOnly: []
  })

  it('matches when the incoming credit lists more artists than the file', () => {
    expect(
      isAlreadyPresent(sets, 'Avicii, DevBowser', 'The Nights (DevBowser Hardstyle Remix)')
    ).toBe(true)
  })

  it('still requires the title to match', () => {
    expect(isAlreadyPresent(sets, 'Avicii, DevBowser', 'Levels')).toBe(false)
  })

  it('does not match an unrelated artist sharing nothing', () => {
    expect(isAlreadyPresent(sets, 'Muse', 'The Nights (DevBowser Hardstyle Remix)')).toBe(false)
  })
})

describe('buildM3U', () => {
  it('emits an extended M3U with one EXTINF per entry', () => {
    const out = buildM3U([
      { duration: 210.4, artist: 'Muse', title: 'Hysteria', fileName: '01 - Muse - Hysteria.mp3' }
    ])
    expect(out).toBe('#EXTM3U\n#EXTINF:210,Muse - Hysteria\n01 - Muse - Hysteria.mp3\n')
  })
  it('writes 0 for unknown durations rather than NaN', () => {
    expect(buildM3U([{ duration: 0, artist: 'A', title: 'B', fileName: 'f.mp3' }])).toContain(
      '#EXTINF:0,A - B'
    )
  })
})

describe('estimateBytes', () => {
  it('uses 40kB/s for mp3', () => {
    expect(estimateBytes([{ duration: 100 }], 'mp3')).toBe(4_000_000)
  })
  it('falls back to 4 minutes when duration is unknown', () => {
    expect(estimateBytes([{ duration: 0 }], 'mp3')).toBe(240 * 40_000)
  })
  it('is larger for flac than mp3', () => {
    const t = [{ duration: 300 }]
    expect(estimateBytes(t, 'flac')).toBeGreaterThan(estimateBytes(t, 'mp3'))
  })
})

describe('checkCap', () => {
  it('fits when there is room', () => {
    expect(checkCap(1 * GB, 4 * GB, 1 * GB)).toEqual({
      fits: true,
      freeBytes: 3 * GB,
      shortfallBytes: 0
    })
  })
  it('reports the exact shortfall when it does not fit', () => {
    const r = checkCap(3 * GB, 4 * GB, 2 * GB)
    expect(r.fits).toBe(false)
    expect(r.shortfallBytes).toBe(1 * GB)
  })
  it('treats an already-over-cap device as zero free, never negative', () => {
    const r = checkCap(5 * GB, 4 * GB, 1)
    expect(r.freeBytes).toBe(0)
    expect(r.shortfallBytes).toBe(1)
  })
  it('accepts a download that exactly fills the cap', () => {
    expect(checkCap(3 * GB, 4 * GB, 1 * GB).fits).toBe(true)
  })
})

describe('formatBytes', () => {
  it('formats bytes, KB and GB readably', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2 * GB)).toBe('2.00 GB')
  })
})
