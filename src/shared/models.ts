/** Where a playlist URL came from. */
export type Provider = 'youtube' | 'apple' | 'spotify'

/** Where the actual audio stream is pulled from. */
export type TrackSource = 'youtube' | 'soundcloud'

export type AudioFormat = 'mp3' | 'flac' | 'opus'

/**
 * A track after resolution: it always has a `sourceUrl` yt-dlp can download.
 * Spotify/Apple only give us title+artist, so those go through a YouTube search
 * before they become a ResolvedTrack.
 */
export interface Track {
  /** Stable id — the YouTube video id, or `${provider}:${index}` if unresolved. */
  id: string
  /** 1-based position in the playlist; drives the "NN - " filename prefix. */
  position: number
  title: string
  artist: string
  album: string
  /** Seconds. 0 when the provider did not report one. */
  duration: number
  sourceUrl: string
  source: TrackSource
  thumbnail?: string
}

export interface Playlist {
  id: string
  title: string
  /** The URL the user pasted. */
  url: string
  provider: Provider
  uploader?: string
  thumbnail?: string
  tracks: Track[]
}

/** A named destination folder with a hard size budget. */
export interface Device {
  id: string
  /** Display name, e.g. "Nathanial's iPod". */
  name: string
  /** Absolute path. Always inside `musicRoot`. */
  dir: string
  /** Hard cap in bytes. Downloads that would exceed it are refused. */
  capacityBytes: number
  createdAt: string
}

export interface DeviceUsage {
  deviceId: string
  usedBytes: number
  capacityBytes: number
  trackCount: number
}

/** Metadata read back out of a file's own ID3 tags. */
export interface FileTags {
  title?: string
  artist?: string
  album?: string
  genre?: string
  year?: string
  trackNumber?: number
  hasArtwork: boolean
}

/** One audio file sitting on a device. */
export interface DeviceFile {
  path: string
  /** Filename, no directory part. */
  name: string
  /** Folder relative to the device root; '' for a file in the root. */
  folder: string
  size: number
  /** Absent when the file carries no readable ID3 tag. */
  tags?: FileTags
}

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'tagging'
  | 'complete'
  | 'error'
  | 'cancelled'
  | 'skipped'
  | 'rate-limited'

export interface DownloadProgress {
  jobId: string
  trackId: string
  status: DownloadStatus
  /** 0-100. */
  percent: number
  /** Human-readable detail: speed, ETA, or an error message. */
  detail?: string
}

/** What the renderer sends to start a download run. */
export interface DownloadRequest {
  deviceId: string
  playlist: Playlist
  /** Subset of `playlist.tracks` ids the user actually wants. */
  trackIds: string[]
  forceRedownload?: boolean
}

export interface AppSettings {
  /** Root folder that holds one subfolder per device. */
  musicRoot: string
  devices: Device[]
  audioFormat: AudioFormat
  /** Parallel yt-dlp processes, 1-8. */
  concurrency: number
  /** Look up genre + cover art from MusicBrainz/iTunes while downloading. */
  metadataEnrichment: boolean
  /**
   * Allow the same song to exist more than once on one device. Off by default:
   * a track already on the device is skipped even when a second playlist wants
   * it, so shared songs are not downloaded and stored twice.
   */
  allowDuplicates: boolean
  disclaimerAccepted: boolean
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'musicRoot'> = {
  devices: [],
  audioFormat: 'mp3',
  concurrency: 3,
  metadataEnrichment: true,
  allowDuplicates: false,
  disclaimerAccepted: false
}
