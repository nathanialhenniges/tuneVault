import { describe, it, expect } from 'vitest'
import {
  parseSpotifyPlaylistHtml,
  isSpotifyUrl,
  toEmbedUrl,
  extractSpotifyId
} from './spotify-parse'

describe('isSpotifyUrl', () => {
  it('matches real Spotify links', () => {
    expect(isSpotifyUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true)
  })
  it('matches without a scheme', () => {
    expect(isSpotifyUrl('open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toBe(true)
  })
  it('rejects lookalike hosts', () => {
    expect(isSpotifyUrl('https://open.spotify.com.evil.test/playlist/abc')).toBe(false)
    expect(isSpotifyUrl('https://www.youtube.com/playlist?list=PLxyz')).toBe(false)
  })
})

describe('toEmbedUrl', () => {
  it('rewrites a playlist link to its embed page', () => {
    expect(toEmbedUrl('https://open.spotify.com/playlist/37i9dQ?si=abc')).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQ'
    )
  })
  it('handles albums and spotify: URIs', () => {
    expect(toEmbedUrl('spotify:album:1DFix')).toBe('https://open.spotify.com/embed/album/1DFix')
  })
  it('returns null for a link with no playlist or album id', () => {
    expect(toEmbedUrl('https://open.spotify.com/')).toBeNull()
  })
})

describe('extractSpotifyId', () => {
  it('pulls the id out of a full URL', () => {
    expect(extractSpotifyId('https://open.spotify.com/playlist/abc123?si=x')).toBe('abc123')
  })
})

// Mirrors the real Spotify embed `__NEXT_DATA__` shape.
const blob = {
  props: {
    pageProps: {
      state: {
        data: {
          entity: {
            name: 'Road Trip',
            coverArt: {
              sources: [
                { url: 'https://img.test/small.jpg', width: 64 },
                { url: 'https://img.test/big.jpg', width: 640 }
              ]
            },
            trackList: [
              { uri: 'spotify:track:1', title: 'Song A', subtitle: 'Artist One', duration: 210_000 },
              { uri: 'spotify:track:2', title: 'Song B', subtitle: 'Artist Two', duration: 185_500 }
            ]
          }
        }
      }
    }
  }
}

const html = (payload: unknown): string =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    payload
  )}</script></body></html>`

describe('parseSpotifyPlaylistHtml', () => {
  it('extracts title, artwork and tracks', () => {
    const result = parseSpotifyPlaylistHtml(html(blob))
    expect(result.title).toBe('Road Trip')
    expect(result.artworkUrl).toBe('https://img.test/big.jpg')
    expect(result.tracks).toEqual([
      { title: 'Song A', artist: 'Artist One', duration: 210, position: 1 },
      { title: 'Song B', artist: 'Artist Two', duration: 186, position: 2 }
    ])
  })

  it('converts duration from milliseconds to seconds', () => {
    const result = parseSpotifyPlaylistHtml(html(blob))
    expect(result.tracks[0].duration).toBe(210)
  })

  it('falls back to an artists array when subtitle is absent', () => {
    const alt = {
      d: {
        entity: {
          name: 'X',
          trackList: [{ title: 'S', artists: [{ name: 'A' }, { name: 'B' }], duration: 1000 }]
        }
      }
    }
    expect(parseSpotifyPlaylistHtml(html(alt)).tracks[0].artist).toBe('A, B')
  })

  it('survives a missing duration rather than emitting NaN', () => {
    const alt = { d: { entity: { name: 'X', trackList: [{ title: 'S', subtitle: 'A' }] } } }
    expect(parseSpotifyPlaylistHtml(html(alt)).tracks[0].duration).toBe(0)
  })

  it('throws a readable error when the blob is missing', () => {
    expect(() => parseSpotifyPlaylistHtml('<html><body>nope</body></html>')).toThrow(
      /Could not read this Spotify playlist/
    )
  })

  it('throws a readable error when the playlist is private (no tracks)', () => {
    expect(() => parseSpotifyPlaylistHtml(html({ props: {} }))).toThrow(/No tracks found/)
  })

  it('throws when the JSON is malformed', () => {
    expect(() =>
      parseSpotifyPlaylistHtml('<script id="__NEXT_DATA__">{not json}</script>')
    ).toThrow(/malformed/)
  })
})
