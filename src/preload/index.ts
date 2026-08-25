import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  AppSettings,
  Device,
  DeviceFile,
  DeviceUsage,
  DownloadProgress,
  DownloadRequest,
  Playlist,
  ResolveProgress,
  RunStatus,
  Track
} from '../shared/models'

export type { DeviceFile } from '../shared/models'
import type { TrackIndex } from '../shared/utils'
export type { TrackIndex } from '../shared/utils'

/** Subscribe helper — returns an unsubscribe function for use in useEffect. */
function on<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

export interface DownloadSummary {
  runId: string
  completed: number
  skipped: number
  failed: number
  cancelled: boolean
  errors: { title: string; message: string }[]
}

export interface Preflight {
  usedBytes: number
  capacityBytes: number
  freeBytes: number
  incomingBytes: number
  shortfallBytes: number
  fits: boolean
}

export interface ImportResult {
  copied: number
  skipped: number
  rejected: number
  refused: number
  errors: { name: string; message: string }[]
}

const api = {
  platform: process.platform,

  /**
   * Playlists in the Mac's Music app. Import one with
   * `resolvePlaylist('musicapp://playlist/<id>')`.
   */
  musicAppPlaylists: (): Promise<{ id: string; name: string; trackCount: number }[]> =>
    ipcRenderer.invoke(IPC.MUSIC_APP_PLAYLISTS),

  /** `refresh` bypasses the 30-minute cache, for "check for new tracks". */
  resolvePlaylist: (url: string, refresh = false): Promise<Playlist> =>
    ipcRenderer.invoke(IPC.PLAYLIST_RESOLVE, url, refresh),

  /**
   * Resolving a Spotify or Apple Music link costs one YouTube search per track,
   * so it reports as it goes rather than blocking silently.
   */
  onResolveProgress: (handler: (p: ResolveProgress) => void): (() => void) =>
    on(IPC.PLAYLIST_RESOLVE_PROGRESS, handler),

  devices: {
    list: (): Promise<Device[]> => ipcRenderer.invoke(IPC.DEVICE_LIST),
    create: (name: string, capacityBytes: number): Promise<Device> =>
      ipcRenderer.invoke(IPC.DEVICE_CREATE, name, capacityBytes),
    update: (id: string, patch: { name?: string; capacityBytes?: number }): Promise<Device> =>
      ipcRenderer.invoke(IPC.DEVICE_UPDATE, id, patch),
    /** Shows a native confirmation sheet; resolves false if the user cancels. */
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.DEVICE_DELETE, id),
    usage: (id: string): Promise<DeviceUsage> => ipcRenderer.invoke(IPC.DEVICE_USAGE, id),
    openFolder: (id: string): Promise<void> => ipcRenderer.invoke(IPC.DEVICE_OPEN_FOLDER, id),
    tracks: (id: string): Promise<DeviceFile[]> => ipcRenderer.invoke(IPC.DEVICE_TRACKS, id),
    /** Moves the files to the Trash. Confirms natively when deleting several. */
    deleteTracks: (id: string, paths: string[]): Promise<number> =>
      ipcRenderer.invoke(IPC.DEVICE_DELETE_TRACKS, id, paths),
    revealTrack: (id: string, path: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DEVICE_REVEAL_TRACK, id, path),
    /** Identities of every song already on the device, for duplicate marking. */
    trackKeys: (id: string): Promise<TrackIndex> => ipcRenderer.invoke(IPC.DEVICE_TRACK_KEYS, id),
    forgetSource: (id: string, url: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DEVICE_FORGET_SOURCE, id, url),
    importFiles: (id: string, paths: string[]): Promise<ImportResult> =>
      ipcRenderer.invoke(IPC.DEVICE_IMPORT, id, paths),
    pickAudioFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.DEVICE_PICK_AUDIO)
  },

  /**
   * Resolve a dropped File to its absolute path. Electron removed `File.path`
   * in v32; `webUtils.getPathForFile` is the supported replacement and must be
   * called from preload, where `webUtils` exists.
   */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  /**
   * URL for the cover art embedded in a track. Served by the main process on
   * demand, so listings never carry image bytes over IPC.
   */
  artworkUrl: (filePath: string): string => `tvart://art/${encodeURIComponent(filePath)}`,

  /** Start a native drag of real files, so tracks can be dragged into Finder. */
  startDrag: (paths: string[]): void => ipcRenderer.send(IPC.DRAG_OUT, paths),

  /** Menu bar items that need the UI to do something. */
  onMenu: (channel: string, handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  downloads: {
    preflight: (deviceId: string, tracks: Track[]): Promise<Preflight> =>
      ipcRenderer.invoke(IPC.DOWNLOAD_PREFLIGHT, deviceId, tracks),
    start: (request: DownloadRequest): Promise<DownloadSummary> =>
      ipcRenderer.invoke(IPC.DOWNLOAD_START, request),
    cancel: (runId?: string): Promise<void> => ipcRenderer.invoke(IPC.DOWNLOAD_CANCEL, runId),
    onProgress: (handler: (p: DownloadProgress) => void): (() => void) =>
      on(IPC.DOWNLOAD_PROGRESS, handler),
    onDone: (handler: (s: DownloadSummary) => void): (() => void) => on(IPC.DOWNLOAD_DONE, handler),
    onRunStatus: (handler: (s: RunStatus) => void): (() => void) =>
      on(IPC.DOWNLOAD_RUN_STATUS, handler)
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, patch),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.SETTINGS_PICK_FOLDER),
    pickCookieFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.SETTINGS_PICK_COOKIES)
  }
}

export type TuneVaultApi = typeof api

contextBridge.exposeInMainWorld('api', api)
