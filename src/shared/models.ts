export interface PlaylistInfo {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  trackCount: number
}

export interface Track {
  id: string
  videoId: string
  title: string
  artist: string
  duration: number // seconds
  thumbnailUrl: string
  playlistId: string
  playlistTitle: string
  position: number
  filePath?: string
  format?: AudioFormat
  downloadedAt?: string
  releaseDate?: string
  bitrate?: number
  url?: string
}

export interface Playlist {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  tracks: Track[]
  fetchedAt: string
}

export type AudioFormat = 'flac' | 'opus' | 'mp3'
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD Mon YYYY'
export type ReleaseDateSource = 'youtube' | 'musicbrainz'

export interface DownloadRequest {
  playlist: Playlist
  format: AudioFormat
  outputDir: string
  concurrency: number
  forceRedownload?: boolean
  dateFormat?: DateFormat
  releaseDateSource?: ReleaseDateSource
}

export interface DownloadProgress {
  trackId: string
  videoId: string
  percent: number
  speed: string
  eta: string
  status: 'queued' | 'downloading' | 'converting' | 'tagging' | 'done' | 'skipped' | 'error'
  error?: string
}

export interface LibraryData {
  playlists: Playlist[]
  version: number
}

export interface AppSettings {
  musicDir: string
  audioFormat: AudioFormat
  concurrency: number
  theme: 'dark' | 'light' | 'system'
  dateFormat: DateFormat
  releaseDateSource: ReleaseDateSource
}

export const DEFAULT_SETTINGS: AppSettings = {
  musicDir: '',
  audioFormat: 'mp3',
  concurrency: 2,
  theme: 'dark',
  dateFormat: 'MM/DD/YYYY',
  releaseDateSource: 'youtube'
}

export interface MetadataEntry {
  position: number
  title: string
  artist: string
  videoId: string
  videoUrl: string
  duration: number
  thumbnailUrl: string
  uploadDate?: string
  description?: string
}
