import { describe, it, expect } from 'vitest'
import {
  parseTrackFileName,
  trackKey,
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
