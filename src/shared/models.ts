/** Where a playlist URL came from. */
export type Provider = 'youtube' | 'apple' | 'spotify' | 'music-app'

/** Where the actual audio comes from. `local` means a file already on this Mac. */
export type TrackSource = 'youtube' | 'soundcloud' | 'local'

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
  /** Genre as the source reported it, when it knows. */
  genre?: string
  /**
   * Absolute path to a file already on this Mac (a purchased or uploaded track
   * in the Music app). Present only when `source` is 'local'; such tracks are
   * copied rather than downloaded.
   */
  localPath?: string
  /**
   * True when `sourceUrl` is not known yet and the track must be matched on
   * YouTube at download time.
   *
   * The Music app can hand over a library of thousands of tracks. Searching for
   * every one just to draw a preview would take hours, so matching is deferred
   * to the tracks the user actually selects.
   */
  needsMatch?: boolean
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

/**
 * A playlist this device has been filled from, remembered so it can be checked
 * again later. Playlists get added to over time; re-running one only fetches
 * what is new, because duplicate protection skips the rest.
 */
export interface PlaylistSource {
  url: string
  title: string
  provider: Provider
  addedAt: string
  lastCheckedAt: string
  /** Track count the last time it was resolved. */
  trackCount: number
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
  /** Playlists this device has been filled from. */
  sources?: PlaylistSource[]
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

/**
 * Progress while a pasted link is turned into a track list.
 *
 * `fetching` has no meaningful total — it is one page load or one yt-dlp call.
 * `matching` does: Spotify and Apple Music give names only, so every track costs
 * its own YouTube search, and on a 50-track playlist that is the slow part.
 */
export interface ResolveProgress {
  phase: 'fetching' | 'matching' | 'done'
  /** Tracks matched so far. Only meaningful while matching. */
  done: number
  total: number
  provider?: Provider
  /** Known once the page has been read, before matching starts. */
  title?: string
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

/**
 * Coarse state of a whole run, sent when it changes phase rather than per
 * track. Per-track counts are derived in the renderer from the progress it
 * already has; this carries only what cannot be derived.
 */
export interface RunStatus {
  runId: string
  total: number
  /** Epoch ms the current cooldown ends. Absent while actually working. */
  cooldownUntil?: number
  /** 1-based batch currently running, and how many there are. */
  batch: number
  batchCount: number
}

/** What the renderer sends to start a download run. */
export interface DownloadRequest {
  deviceId: string
  playlist: Playlist
  /** Subset of `playlist.tracks` ids the user actually wants. */
  trackIds: string[]
  forceRedownload?: boolean
  /**
   * Skip the per-track size *estimate* check.
   *
   * The estimate is derived from duration and a nominal bitrate, so it can be
   * wrong in either direction and block a download that would actually fit.
   * This does not lift the device's storage limit: the real on-disk check still
   * stops the run when the folder genuinely reaches capacity.
   */
  ignoreEstimate?: boolean
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
   * Hide tracks already on the device from an import list, rather than showing
   * them greyed out. On by default: they cannot be downloaded again anyway, so
   * showing them is noise and an invitation to tick one by mistake.
   *
   * Ignored when `allowDuplicates` is on, since then nothing is redundant.
   */
  hideAlreadyOnDevice: boolean

  /**
   * Where yt-dlp should get cookies from, if anywhere.
   *
   * Signing in clears most of YouTube's bot checks, which is the single biggest
   * help on the download side. Kept as flat keys rather than a nested object so
   * the shallow merge in SettingsService stays correct.
   *
   * 'browser' reads them live from a local browser profile; 'file' uses an
   * exported cookies.txt, which is how a second account can be used without
   * signing into a browser as that account.
   */
  cookieMode: 'off' | 'browser' | 'file'
  /** chrome | brave | chromium | edge | firefox | opera | safari | vivaldi | whale */
  cookieBrowser: string
  /** Browser profile name — this is what selects between accounts. */
  cookieProfile: string
  /** Path to a Netscape-format cookies.txt. */
  cookieFile: string

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
  hideAlreadyOnDevice: true,
  cookieMode: 'off',
  cookieBrowser: 'chrome',
  cookieProfile: '',
  cookieFile: '',
  disclaimerAccepted: false
}
